import { db } from '../database/db.js';
import { config } from '../config.js';
import { LegStatus, MarketType, Match, Ticket, TicketLeg } from '../types/index.js';
import { MatchService } from './MatchService.js';
import { UserService } from './UserService.js';
import { AuditLogService } from './AuditLogService.js';

export interface SettlementSummary {
  seasonId: number;
  seasonName: string;
  totalPool: number;
  coinSinkAmount: number;
  distributablePool: number;
  winningTicketsCount: number;
  totalDistributed: number;
  rolloverAmount: number;
  winners: {
    userId: string;
    username: string;
    ticketId: number;
    stake: number;
    payout: number;
    comboWeight: number;
  }[];
}

export interface MatchWinningTicket {
  ticketId: number;
  userId: string;
  username: string;
  stake: number;
  multiplier: number;
  payout: number;
  netProfit: number;
  newBalance: number;
  legs: {
    marketType: MarketType;
    selectedTarget: string;
    lockedOdds: number;
    status: LegStatus;
  }[];
}

export interface MatchEliminatedTicket {
  ticketId: number;
  userId: string;
  username: string;
  stake: number;
}

export interface MatchResultOutcome {
  match: Match;
  winner: string;
  second: string;
  third: string;
  top3: string[];
  standings: string[];
  resolvedLegsCount: number;
  eliminatedTicketsCount: number;
  winningTickets: MatchWinningTicket[];
  eliminatedTickets: MatchEliminatedTicket[];
  imageUrl?: string;
}

export class SettlementService {
  /**
   * Records match outcome (1st, 2nd, 3rd, and standings) and resolves all related ticket legs.
   * Immediately credits winning predictors with their payout and returns them for notifications!
   */
  static recordMatchResult(
    matchId: number,
    standingsOrWinner: string[] | string,
    secondTeam?: string,
    thirdTeam?: string,
    imageUrl?: string
  ): MatchResultOutcome {
    const match = MatchService.getMatchById(matchId);
    if (!match) {
      throw new Error(`Match #${matchId} not found.`);
    }

    if (match.status === 'SETTLED') {
      throw new Error(`Match #${matchId} is already settled.`);
    }

    let standings: string[] = [];
    if (Array.isArray(standingsOrWinner)) {
      standings = standingsOrWinner.map((t) => t.trim()).filter((t) => t.length > 0);
    } else {
      standings = [standingsOrWinner, secondTeam || '', thirdTeam || ''].filter((t) => t.length > 0);
    }

    const winner = standings[0] || '';
    const second = standings[1] || '';
    const third = standings[2] || '';
    const top3 = [winner, second, third].filter((t) => t.length > 0);

    let resolvedLegsCount = 0;
    let eliminatedTicketsCount = 0;
    const winningTickets: MatchWinningTicket[] = [];
    const eliminatedTickets: MatchEliminatedTicket[] = [];
    const now = Date.now();

    const executeResolution = db.transaction(() => {
      // 1. Update match record
      db.prepare(`
        UPDATE matches 
        SET status = 'SETTLED',
            result_winner = ?,
            result_second = ?,
            result_third = ?,
            result_image_url = ?
        WHERE id = ?
      `).run(winner, second, third, imageUrl || null, matchId);

      // 2. Fetch all legs for this match
      const legs = db.prepare(`SELECT * FROM ticket_legs WHERE match_id = ?`).all(matchId) as TicketLeg[];

      const userStatsUpdate: Record<string, { resolved: number; correct: number }> = {};
      const affectedTicketIds = new Set<number>();

      for (const leg of legs) {
        affectedTicketIds.add(leg.ticket_id);
        let isWon = false;
        const targetLower = leg.selected_target.toLowerCase().trim();
        const rank = standings.findIndex((t) => t.toLowerCase().trim() === targetLower) + 1;

        if (rank > 0) {
          if (leg.market_type === 'POS_1' || (leg.market_type as any) === 'WINNER') {
            isWon = rank === 1;
          } else if (leg.market_type === 'POS_2_3') {
            isWon = rank === 2 || rank === 3;
          } else if (leg.market_type === 'POS_3_5') {
            isWon = rank >= 3 && rank <= 5;
          } else if (leg.market_type === 'POS_5_10' || leg.market_type === 'POS_6_10') {
            isWon = rank >= 5 && rank <= 10;
          } else if (leg.market_type === 'POS_11_16') {
            isWon = rank >= 11 && rank <= 16;
          } else if ((leg.market_type as any) === 'TOP_3') {
            isWon = rank >= 1 && rank <= 3;
          }
        }

        const newStatus: LegStatus = isWon ? 'WON' : 'LOST';
        db.prepare('UPDATE ticket_legs SET status = ? WHERE id = ?').run(newStatus, leg.id);
        resolvedLegsCount++;

        // Track accuracy stats
        const ticketOwner = db.prepare('SELECT user_id FROM tickets WHERE id = ?').get(leg.ticket_id) as { user_id: string } | undefined;
        if (ticketOwner) {
          if (!userStatsUpdate[ticketOwner.user_id]) {
            userStatsUpdate[ticketOwner.user_id] = { resolved: 0, correct: 0 };
          }
          userStatsUpdate[ticketOwner.user_id].resolved++;
          if (isWon) userStatsUpdate[ticketOwner.user_id].correct++;
        }
      }

      // Update users' resolved/correct selection counters
      const updateUserStats = db.prepare(`
        UPDATE users 
        SET resolved_selections = resolved_selections + ?,
            correct_selections = correct_selections + ?
        WHERE id = ?
      `);

      for (const [userId, stats] of Object.entries(userStatsUpdate)) {
        updateUserStats.run(stats.resolved, stats.correct, userId);
      }

      // 3. Re-evaluate all affected tickets for WIN or LOSS
      for (const ticketId of affectedTicketIds) {
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket | undefined;
        if (!ticket || ticket.status !== 'ACTIVE') continue;

        const allLegs = db.prepare('SELECT * FROM ticket_legs WHERE ticket_id = ?').all(ticketId) as TicketLeg[];
        const hasLost = allLegs.some((l) => l.status === 'LOST');
        const hasPending = allLegs.some((l) => l.status === 'PENDING');
        const hasWon = allLegs.some((l) => l.status === 'WON');

        if (hasLost) {
          // Ticket is eliminated
          db.prepare("UPDATE tickets SET status = 'LOST' WHERE id = ?").run(ticket.id);
          db.prepare(`
            UPDATE users 
            SET reserved_stake = MAX(0, reserved_stake - ?),
                lifetime_stakes = lifetime_stakes + ?,
                lifetime_profit = lifetime_profit - ?
            WHERE id = ?
          `).run(ticket.stake, ticket.stake, ticket.stake, ticket.user_id);

          eliminatedTicketsCount++;
          const user = UserService.getUser(ticket.user_id);
          eliminatedTickets.push({
            ticketId: ticket.id,
            userId: ticket.user_id,
            username: user ? user.username : ticket.user_id,
            stake: ticket.stake,
          });
        } else if (!hasPending && hasWon) {
          // All legs resolved and at least 1 won, none lost! TICKET WON!
          let multiplier = 1.0;
          for (const l of allLegs) {
            multiplier *= l.status === 'VOID' ? 1.0 : l.locked_odds;
          }

          const rawPayout = Math.floor(ticket.stake * multiplier);
          const minPayout = Math.floor(ticket.stake * config.economy.minWinFloorMultiplier);
          const payout = Math.max(rawPayout, minPayout);
          const netProfit = payout - ticket.stake;

          // Update ticket status and recorded payout
          db.prepare("UPDATE tickets SET status = 'WON', payout = ? WHERE id = ?").run(payout, ticket.id);

          // Credit user balance, update stats and ledger
          const user = UserService.getUser(ticket.user_id);
          if (user) {
            const newBalance = user.balance + payout;
            const newReserved = Math.max(0, user.reserved_stake - ticket.stake);
            const biggestWin = Math.max(user.biggest_win_payout, payout);

            db.prepare(`
              UPDATE users 
              SET balance = ?,
                  reserved_stake = ?,
                  lifetime_won_payouts = lifetime_won_payouts + ?,
                  lifetime_stakes = lifetime_stakes + ?,
                  lifetime_profit = lifetime_profit + ?,
                  biggest_win_payout = ?
              WHERE id = ?
            `).run(newBalance, newReserved, payout, ticket.stake, netProfit, biggestWin, user.id);

            db.prepare(`
              INSERT INTO transactions_ledger (user_id, type, amount, balance_after, reference_id, notes, created_at)
              VALUES (?, 'TICKET_PAYOUT', ?, ?, ?, ?, ?)
            `).run(
              user.id,
              payout,
              newBalance,
              String(ticket.id),
              `Winning ticket #${ticket.id} on Match #${match.match_number} (Multiplier: ${multiplier.toFixed(2)}x)`,
              now
            );

            winningTickets.push({
              ticketId: ticket.id,
              userId: user.id,
              username: user.username,
              stake: ticket.stake,
              multiplier: Number(multiplier.toFixed(2)),
              payout,
              netProfit,
              newBalance,
              legs: allLegs.map((l) => ({
                marketType: l.market_type,
                selectedTarget: l.selected_target,
                lockedOdds: l.locked_odds,
                status: l.status,
              })),
            });
          }
        }
      }
    });

    executeResolution();

    const outcome: MatchResultOutcome = {
      match,
      winner,
      second,
      third,
      top3,
      standings,
      resolvedLegsCount,
      eliminatedTicketsCount,
      winningTickets,
      eliminatedTickets,
      imageUrl,
    };

    AuditLogService.logMatchSettled(outcome).catch(() => {});

    return outcome;
  }

  /**
   * Cancels a match and applies the VOID LEG (Push) Rule.
   * If ticket drops below 2 active legs, refunds the ticket.
   */
  static cancelMatch(matchId: number, reason = 'Match cancelled by admin'): { voidedLegs: number; refundedTickets: number } {
    const match = MatchService.getMatchById(matchId);
    if (!match) throw new Error(`Match #${matchId} not found.`);

    let voidedLegs = 0;
    let refundedTickets = 0;
    const now = Date.now();

    const executeCancel = db.transaction(() => {
      db.prepare(`UPDATE matches SET status = 'CANCELLED' WHERE id = ?`).run(matchId);

      const legs = db.prepare(`SELECT * FROM ticket_legs WHERE match_id = ?`).all(matchId) as TicketLeg[];

      const affectedTicketIds = new Set<number>();
      for (const leg of legs) {
        db.prepare("UPDATE ticket_legs SET status = 'VOID', locked_odds = 1.0 WHERE id = ?").run(leg.id);
        voidedLegs++;
        affectedTicketIds.add(leg.ticket_id);
      }

      // Re-evaluate affected tickets
      for (const ticketId of affectedTicketIds) {
        const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket;
        if (!ticket || ticket.status !== 'ACTIVE') continue;

        const allLegs = db.prepare('SELECT * FROM ticket_legs WHERE ticket_id = ?').all(ticketId) as TicketLeg[];
        const nonVoidLegs = allLegs.filter((l) => l.status !== 'VOID');

        if (nonVoidLegs.length < config.economy.minComboSize) {
          // Refund ticket stake
          db.prepare("UPDATE tickets SET status = 'REFUNDED' WHERE id = ?").run(ticket.id);

          // Refund user balance & release reserved stake
          const user = UserService.getUser(ticket.user_id);
          if (user) {
            const newBalance = user.balance + ticket.stake;
            const newReserved = Math.max(0, user.reserved_stake - ticket.stake);
            db.prepare('UPDATE users SET balance = ?, reserved_stake = ? WHERE id = ?').run(newBalance, newReserved, user.id);

            db.prepare(`
              INSERT INTO transactions_ledger (user_id, type, amount, balance_after, reference_id, notes, created_at)
              VALUES (?, 'TICKET_REFUND', ?, ?, ?, ?, ?)
            `).run(user.id, ticket.stake, newBalance, String(ticket.id), `Refund due to cancelled match: ${reason}`, now);

            // Deduct from season pool
            db.prepare('UPDATE seasons SET total_pool = MAX(0, total_pool - ?) WHERE id = ?').run(ticket.stake, ticket.season_id);
          }
          refundedTickets++;
        } else {
          // Recalculate combo weight with 1.0x on voided legs
          let newMultiplier = 1.0;
          for (const l of allLegs) {
            newMultiplier *= l.status === 'VOID' ? 1.0 : l.locked_odds;
          }
          const newWeight = Number((ticket.stake * newMultiplier).toFixed(2));
          db.prepare('UPDATE tickets SET combo_weight = ? WHERE id = ?').run(newWeight, ticket.id);
        }
      }
    });

    executeCancel();

    AuditLogService.logMatchCancelled(match, reason, voidedLegs, refundedTickets).catch(() => {});

    return { voidedLegs, refundedTickets };
  }

  /**
   * Finalizes the season/day pool:
   * Deducts 5% coin sink, calculates proportional payouts with combo weights,
   * enforces minimum win floor, and deposits coins directly to users!
   */
  static settleSeason(seasonId: number): SettlementSummary {
    const season = db.prepare('SELECT * FROM seasons WHERE id = ?').get(seasonId) as any;
    if (!season) {
      throw new Error(`Season #${seasonId} not found.`);
    }

    if (season.status === 'SETTLED') {
      throw new Error(`Season #${seasonId} is already settled.`);
    }

    const now = Date.now();
    const totalPool = season.total_pool + (season.rollover_amount || 0);

    // Apply 5% virtual coin sink
    const sinkRate = config.economy.seasonCoinSinkPercent / 100;
    const coinSinkAmount = Math.floor(totalPool * sinkRate);
    const distributablePool = totalPool - coinSinkAmount;

    // Fetch tickets for this season: already settled WON tickets and remaining ACTIVE tickets
    const alreadyWonTickets = db.prepare(`SELECT * FROM tickets WHERE season_id = ? AND status = 'WON'`).all(seasonId) as Ticket[];
    const activeTickets = db.prepare(`SELECT * FROM tickets WHERE season_id = ? AND status = 'ACTIVE'`).all(seasonId) as Ticket[];

    // Identify winners among active tickets: tickets where every single leg is either WON or VOID (with at least 1 WON leg)
    const winningTickets: (Ticket & { legs: TicketLeg[] })[] = [];

    for (const t of activeTickets) {
      const legs = db.prepare('SELECT * FROM ticket_legs WHERE ticket_id = ?').all(t.id) as TicketLeg[];
      const hasLost = legs.some((l) => l.status === 'LOST' || l.status === 'PENDING');
      const hasWon = legs.some((l) => l.status === 'WON');

      if (!hasLost && hasWon) {
        winningTickets.push({ ...t, legs });
      } else if (hasLost) {
        // Mark remaining un-eliminated lost tickets
        db.prepare("UPDATE tickets SET status = 'LOST' WHERE id = ?").run(t.id);
        db.prepare(`
          UPDATE users 
          SET reserved_stake = MAX(0, reserved_stake - ?),
              lifetime_stakes = lifetime_stakes + ?,
              lifetime_profit = lifetime_profit - ?
          WHERE id = ?
        `).run(t.stake, t.stake, t.stake, t.user_id);
      }
    }

    const summary: SettlementSummary = {
      seasonId,
      seasonName: season.name,
      totalPool,
      coinSinkAmount,
      distributablePool,
      winningTicketsCount: alreadyWonTickets.length + winningTickets.length,
      totalDistributed: 0,
      rolloverAmount: 0,
      winners: [],
    };

    // Pre-populate already won tickets from match settlements
    for (const wt of alreadyWonTickets) {
      const user = UserService.getUser(wt.user_id);
      if (user) {
        summary.winners.push({
          userId: user.id,
          username: user.username,
          ticketId: wt.id,
          stake: wt.stake,
          payout: wt.payout,
          comboWeight: wt.combo_weight,
        });
        summary.totalDistributed += wt.payout;
      }
    }

    const executeSettlement = db.transaction(() => {
      if (winningTickets.length > 0) {
        // Sum total combo weights of winners
        const sumWeights = winningTickets.reduce((acc, t) => acc + t.combo_weight, 0);

        for (const wt of winningTickets) {
          // Proportional share: P_i = D * (W_i / sumWeights)
          const weightRatio = sumWeights > 0 ? wt.combo_weight / sumWeights : 1 / winningTickets.length;
          let payout = Math.floor(distributablePool * weightRatio);

          // Enforce minimum win floor: at least 1.05x original stake
          const minPayout = Math.floor(wt.stake * config.economy.minWinFloorMultiplier);
          if (payout < minPayout) {
            payout = minPayout;
          }

          // Mark ticket WON
          db.prepare("UPDATE tickets SET status = 'WON', payout = ? WHERE id = ?").run(payout, wt.id);

          // Deposit coins to user and update lifetime records
          const user = UserService.getUser(wt.user_id);
          if (user) {
            const netProfit = payout - wt.stake;
            const newBalance = user.balance + payout;
            const newReserved = Math.max(0, user.reserved_stake - wt.stake);
            const biggestWin = Math.max(user.biggest_win_payout, payout);

            db.prepare(`
              UPDATE users 
              SET balance = ?,
                  reserved_stake = ?,
                  lifetime_won_payouts = lifetime_won_payouts + ?,
                  lifetime_stakes = lifetime_stakes + ?,
                  lifetime_profit = lifetime_profit + ?,
                  biggest_win_payout = ?
              WHERE id = ?
            `).run(newBalance, newReserved, payout, wt.stake, netProfit, biggestWin, user.id);

            // Record transaction
            db.prepare(`
              INSERT INTO transactions_ledger (user_id, type, amount, balance_after, reference_id, notes, created_at)
              VALUES (?, 'TICKET_PAYOUT', ?, ?, ?, ?, ?)
            `).run(
              user.id,
              payout,
              newBalance,
              String(wt.id),
              `Season winning ticket payout (Combo weight: ${wt.combo_weight})`,
              now
            );

            summary.winners.push({
              userId: user.id,
              username: user.username,
              ticketId: wt.id,
              stake: wt.stake,
              payout,
              comboWeight: wt.combo_weight,
            });

            summary.totalDistributed += payout;
          }
        }
      } else if (summary.winners.length === 0) {
        // Zero winners in entire season: Roll over to next season up to cap
        const rollover = Math.min(config.economy.rolloverCap, distributablePool);
        summary.rolloverAmount = rollover;

        // Create new active season with rollover
        db.prepare(`
          INSERT INTO seasons (name, status, total_pool, distributable_pool, rollover_amount, created_at)
          VALUES (?, 'ACTIVE', 0, 0, ?, ?)
        `).run(`iGRI Season ${seasonId + 1}`, rollover, now);
      }

      // Mark current season as settled
      db.prepare(`
        UPDATE seasons 
        SET status = 'SETTLED',
            distributable_pool = ?,
            settled_at = ?
        WHERE id = ?
      `).run(distributablePool, now, seasonId);
    });

    executeSettlement();

    return summary;
  }
}
