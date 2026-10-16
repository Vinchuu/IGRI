import { db } from '../database/db.js';
import { config } from '../config.js';
import { LegStatus, Match, Ticket, TicketLeg } from '../types/index.js';
import { MatchService } from './MatchService.js';
import { UserService } from './UserService.js';

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

export class SettlementService {
  /**
   * Records match outcome (1st, 2nd, 3rd, and Top Fragger) and resolves all related ticket legs.
   */
  static recordMatchResult(
    matchId: number,
    winnerTeam: string,
    secondTeam: string,
    thirdTeam: string,
    topFragger: string
  ): { resolvedLegsCount: number; eliminatedTicketsCount: number } {
    const match = MatchService.getMatchById(matchId);
    if (!match) {
      throw new Error(`Match #${matchId} not found.`);
    }

    if (match.status === 'SETTLED') {
      throw new Error(`Match #${matchId} is already settled.`);
    }

    const top3 = [winnerTeam, secondTeam, thirdTeam];

    let resolvedLegsCount = 0;
    let eliminatedTicketsCount = 0;

    const executeResolution = db.transaction(() => {
      // 1. Update match record
      db.prepare(`
        UPDATE matches 
        SET status = 'SETTLED',
            result_winner = ?,
            result_second = ?,
            result_third = ?,
            result_top_fragger = ?
        WHERE id = ?
      `).run(winnerTeam, secondTeam, thirdTeam, topFragger, matchId);

      // 2. Fetch all legs for this match
      const legs = db.prepare(`SELECT * FROM ticket_legs WHERE match_id = ?`).all(matchId) as TicketLeg[];

      const userStatsUpdate: Record<string, { resolved: number; correct: number }> = {};

      for (const leg of legs) {
        let isWon = false;
        if (leg.market_type === 'WINNER') {
          isWon = leg.selected_target.toLowerCase() === winnerTeam.toLowerCase();
        } else if (leg.market_type === 'TOP_3') {
          isWon = top3.some((t) => t.toLowerCase() === leg.selected_target.toLowerCase());
        } else if (leg.market_type === 'TOP_FRAGGER') {
          isWon = leg.selected_target.toLowerCase() === topFragger.toLowerCase();
        }

        const newStatus: LegStatus = isWon ? 'WON' : 'LOST';
        db.prepare('UPDATE ticket_legs SET status = ? WHERE id = ?').run(newStatus, leg.id);
        resolvedLegsCount++;

        // Get user who owns this ticket to track accuracy stats
        const ticketOwner = db.prepare('SELECT user_id FROM tickets WHERE id = ?').get(leg.ticket_id) as { user_id: string };
        if (ticketOwner) {
          if (!userStatsUpdate[ticketOwner.user_id]) {
            userStatsUpdate[ticketOwner.user_id] = { resolved: 0, correct: 0 };
          }
          userStatsUpdate[ticketOwner.user_id].resolved++;
          if (isWon) userStatsUpdate[ticketOwner.user_id].correct++;
        }

        // If leg is lost, check ticket status
        if (!isWon) {
          const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(leg.ticket_id) as Ticket;
          if (ticket && ticket.status === 'ACTIVE') {
            db.prepare("UPDATE tickets SET status = 'LOST' WHERE id = ?").run(ticket.id);
            // Release reserved stake
            db.prepare(`
              UPDATE users 
              SET reserved_stake = MAX(0, reserved_stake - ?),
                  lifetime_stakes = lifetime_stakes + ?,
                  lifetime_profit = lifetime_profit - ?
              WHERE id = ?
            `).run(ticket.stake, ticket.stake, ticket.stake, ticket.user_id);
            eliminatedTicketsCount++;
          }
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
    });

    executeResolution();

    return { resolvedLegsCount, eliminatedTicketsCount };
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

    // Fetch all active tickets for this season
    const activeTickets = db.prepare(`SELECT * FROM tickets WHERE season_id = ? AND status = 'ACTIVE'`).all(seasonId) as Ticket[];

    // Identify winners: tickets where every single leg is either WON or VOID (with at least 1 WON leg)
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
      winningTicketsCount: winningTickets.length,
      totalDistributed: 0,
      rolloverAmount: 0,
      winners: [],
    };

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
      } else {
        // Zero winners: Roll over to next season up to cap
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
