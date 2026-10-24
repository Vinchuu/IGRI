import { db } from '../database/db.js';
import { config } from '../config.js';
import { MarketType, Ticket, TicketLeg } from '../types/index.js';
import { MatchService } from './MatchService.js';
import { OddsService } from './OddsService.js';
import { UserService } from './UserService.js';
import { AuditLogService } from './AuditLogService.js';

export interface LegDraft {
  matchId: number;
  marketType: MarketType;
  selectedTarget: string;
}

export class PredictionService {
  /**
   * Validates and submits a combo ticket with atomic state transitions.
   */
  static submitTicket(
    userId: string,
    username: string,
    stake: number,
    legsDraft: LegDraft[],
    isInsured = false
  ): Ticket {
    const user = UserService.getOrCreateUser(userId, username);
    const season = MatchService.getActiveSeason();

    // 1. Validate combo size (1 to 5 selections)
    if (legsDraft.length < config.economy.minComboSize || legsDraft.length > config.economy.maxComboSize) {
      throw new Error(`A ticket must contain between ${config.economy.minComboSize} and ${config.economy.maxComboSize} selections.`);
    }

    // 2. Validate NO REPEATED TEAMS in the slip: "one team cannot be repeated"
    const selectedTeams = new Set(legsDraft.map((l) => l.selectedTarget.toLowerCase().trim()));
    if (selectedTeams.size !== legsDraft.length) {
      throw new Error('One team cannot be repeated! You must pick a distinct team for each bracket position.');
    }

    // 3. Validate distinct brackets for the same match
    const matchMarketCombos = new Set(legsDraft.map((l) => `${l.matchId}_${l.marketType}`));
    if (matchMarketCombos.size !== legsDraft.length) {
      throw new Error('You cannot pick the same position bracket multiple times in the same match.');
    }

    // 4. Validate stake limits
    if (stake < config.economy.minTicketStake || stake > config.economy.maxTicketStake) {
      throw new Error(`Stake must be between ${config.economy.minTicketStake} and ${config.economy.maxTicketStake} coins.`);
    }

    // 5. Validate open stake limit (max 3,000 across all unresolved tickets)
    if (user.reserved_stake + stake > config.economy.maxOpenStakeLimit) {
      throw new Error(
        `Open stake limit exceeded! Current open: ${user.reserved_stake} coins. Max allowed: ${config.economy.maxOpenStakeLimit} coins.`
      );
    }

    // 6. Validate user balance
    if (user.balance < stake) {
      throw new Error(`Insufficient balance! You have ${user.balance} coins, but tried to stake ${stake}.`);
    }

    // 7. Validate each match is still OPEN and deadline has not passed
    const now = Date.now();
    const legsToInsert: { matchId: number; marketType: MarketType; target: string; odds: number }[] = [];
    let multiplierProduct = 1.0;

    for (const draft of legsDraft) {
      const match = MatchService.getMatchById(draft.matchId);
      if (!match) {
        throw new Error(`Match #${draft.matchId} not found.`);
      }

      if (match.status !== 'OPEN' || match.deadline <= now) {
        throw new Error(`Match #${match.match_number} (${match.lobby_name}) is already locked or closed for predictions.`);
      }

      // Validate target is in participating teams
      const validTargets = match.participating_teams;

      if (!validTargets.some((t) => t.toLowerCase().trim() === draft.selectedTarget.toLowerCase().trim())) {
        throw new Error(`"${draft.selectedTarget}" is not a valid team in Match #${match.match_number}.`);
      }

      const odds = OddsService.getOdds(match.id, draft.marketType, draft.selectedTarget, match.participating_teams.length);
      multiplierProduct *= odds;

      legsToInsert.push({
        matchId: match.id,
        marketType: draft.marketType,
        target: draft.selectedTarget,
        odds,
      });
    }

    const comboWeight = Number((stake * multiplierProduct).toFixed(2));

    // 7. Execute atomic database transaction
    let createdTicketId = 0;

    const executeSubmission = db.transaction(() => {
      // Deduct balance and add to reserved_stake
      const newBalance = user.balance - stake;
      const newReserved = user.reserved_stake + stake;
      db.prepare('UPDATE users SET balance = ?, reserved_stake = ? WHERE id = ?').run(newBalance, newReserved, userId);

      // Record in ledger
      db.prepare(`
        INSERT INTO transactions_ledger (user_id, type, amount, balance_after, reference_id, notes, created_at)
        VALUES (?, 'TICKET_STAKE', ?, ?, NULL, 'Stake reserved for combo ticket', ?)
      `).run(userId, -stake, newBalance, now);

      // Add to season total pool
      db.prepare('UPDATE seasons SET total_pool = total_pool + ? WHERE id = ?').run(stake, season.id);

      // Create ticket
      const ticketInfo = db.prepare(`
        INSERT INTO tickets (user_id, season_id, stake, status, combo_weight, payout, is_insured, created_at)
        VALUES (?, ?, ?, 'ACTIVE', ?, 0, ?, ?)
      `).run(userId, season.id, stake, comboWeight, isInsured ? 1 : 0, now);

      createdTicketId = Number(ticketInfo.lastInsertRowid);

      // Insert legs
      const insertLeg = db.prepare(`
        INSERT INTO ticket_legs (ticket_id, match_id, market_type, selected_target, locked_odds, status)
        VALUES (?, ?, ?, ?, ?, 'PENDING')
      `);

      for (const leg of legsToInsert) {
        insertLeg.run(createdTicketId, leg.matchId, leg.marketType, leg.target, leg.odds);
      }
    });

    executeSubmission();

    const createdTicket = this.getTicketById(createdTicketId)!;
    AuditLogService.logTicketPlaced(createdTicket, username).catch(() => {});

    return createdTicket;
  }

  /**
   * Retrieves a full ticket with its legs
   */
  static getTicketById(ticketId: number): Ticket | null {
    const ticket = db.prepare('SELECT * FROM tickets WHERE id = ?').get(ticketId) as Ticket | undefined;
    if (!ticket) return null;

    const legs = db.prepare('SELECT * FROM ticket_legs WHERE ticket_id = ?').all(ticketId) as TicketLeg[];
    ticket.legs = legs;
    return ticket;
  }

  /**
   * Gets a user's active/open tickets
   */
  static getUserActiveTickets(userId: string): Ticket[] {
    const tickets = db.prepare(`
      SELECT * FROM tickets 
      WHERE user_id = ? AND status IN ('SUBMITTED', 'ACTIVE') 
      ORDER BY created_at DESC
    `).all(userId) as Ticket[];

    for (const ticket of tickets) {
      ticket.legs = db.prepare('SELECT * FROM ticket_legs WHERE ticket_id = ?').all(ticket.id) as TicketLeg[];
    }

    return tickets;
  }

  /**
   * Gets all tickets for a user
   */
  static getUserTickets(userId: string, limit = 5): Ticket[] {
    const tickets = db.prepare(`
      SELECT * FROM tickets 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit) as Ticket[];

    for (const ticket of tickets) {
      ticket.legs = db.prepare('SELECT * FROM ticket_legs WHERE ticket_id = ?').all(ticket.id) as TicketLeg[];
    }

    return tickets;
  }

  /**
   * Submits multiple independent single-bracket tickets atomically.
   */
  static submitMultipleSingleTickets(
    userId: string,
    username: string,
    bets: { matchId: number; marketType: MarketType; selectedTarget: string; stake: number }[]
  ): Ticket[] {
    const user = UserService.getOrCreateUser(userId, username);
    const totalStake = bets.reduce((sum, b) => sum + b.stake, 0);

    if (user.balance < totalStake) {
      throw new Error(`Insufficient balance! You need ${totalStake.toLocaleString()} coins, but currently have ${user.balance.toLocaleString()} coins.`);
    }

    if (user.reserved_stake + totalStake > config.economy.maxOpenStakeLimit) {
      throw new Error(
        `Open stake limit exceeded! Current open: ${user.reserved_stake} coins. Total with new bets: ${user.reserved_stake + totalStake} coins. Max allowed: ${config.economy.maxOpenStakeLimit} coins.`
      );
    }

    const createdTickets: Ticket[] = [];
    for (const b of bets) {
      const ticket = this.submitTicket(userId, username, b.stake, [
        {
          matchId: b.matchId,
          marketType: b.marketType,
          selectedTarget: b.selectedTarget,
        },
      ]);
      createdTickets.push(ticket);
    }

    return createdTickets;
  }
}
