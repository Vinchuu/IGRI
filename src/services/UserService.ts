import { db } from '../database/db.js';
import { config } from '../config.js';
import { UserAccount } from '../types/index.js';
import { LedgerService } from './LedgerService.js';

export class UserService {
  /**
   * Retrieves an existing user or creates one with initial starting coins (10,000)
   */
  static getOrCreateUser(userId: string, username: string): UserAccount {
    const existing = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserAccount | undefined;
    if (existing) {
      // Update username if changed
      if (existing.username !== username) {
        db.prepare('UPDATE users SET username = ? WHERE id = ?').run(username, userId);
        existing.username = username;
      }
      return existing;
    }

    const now = Date.now();
    const startingCoins = config.economy.startingBalance;

    const createTransaction = db.transaction(() => {
      db.prepare(`
        INSERT INTO users (
          id, username, balance, reserved_stake, last_daily_claim, daily_streak,
          lifetime_profit, lifetime_won_payouts, lifetime_stakes,
          resolved_selections, correct_selections, biggest_win_payout,
          equipped_title, created_at
        ) VALUES (
          ?, ?, ?, 0, NULL, 0,
          0, 0, 0,
          0, 0, 0,
          'Rookie Analyst', ?
        )
      `).run(userId, username, startingCoins, now);

      db.prepare(`
        INSERT INTO transactions_ledger (user_id, type, amount, balance_after, reference_id, notes, created_at)
        VALUES (?, 'STARTING_GRANT', ?, ?, NULL, 'Welcome bonus for joining iGRI Arena', ?)
      `).run(userId, startingCoins, startingCoins, now);
    });

    createTransaction();

    return db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserAccount;
  }

  /**
   * Get user account by ID
   */
  static getUser(userId: string): UserAccount | null {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as UserAccount | undefined;
    return user || null;
  }

  /**
   * Updates user title
   */
  static setTitle(userId: string, title: string): void {
    db.prepare('UPDATE users SET equipped_title = ? WHERE id = ?').run(title, userId);
  }

  /**
   * Get user inventory items
   */
  static getUserInventory(userId: string): string[] {
    const items = db.prepare('SELECT item_id FROM user_inventory WHERE user_id = ?').all(userId) as { item_id: string }[];
    return items.map((i) => i.item_id);
  }
}
