import { db } from '../database/db.js';
import { TransactionLedgerEntry, TransactionType } from '../types/index.js';

export class LedgerService {
  /**
   * Atomically records a transaction and updates the user balance.
   * Must be called inside or as an atomic db operation.
   */
  static record(
    userId: string,
    type: TransactionType,
    amount: number,
    referenceId: string | null = null,
    notes: string | null = null
  ): number {
    const user = db.prepare('SELECT balance FROM users WHERE id = ?').get(userId) as { balance: number } | undefined;
    if (!user) {
      throw new Error(`Cannot record transaction: User ${userId} not found.`);
    }

    const newBalance = user.balance + amount;
    if (newBalance < 0) {
      throw new Error(`Insufficient funds: User ${userId} has ${user.balance} coins, attempted ${amount}.`);
    }

    db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, userId);

    db.prepare(`
      INSERT INTO transactions_ledger (user_id, type, amount, balance_after, reference_id, notes, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, type, amount, newBalance, referenceId, notes, Date.now());

    return newBalance;
  }

  /**
   * Fetches recent transactions for a user
   */
  static getUserHistory(userId: string, limit = 10): TransactionLedgerEntry[] {
    return db.prepare(`
      SELECT * FROM transactions_ledger 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(userId, limit) as TransactionLedgerEntry[];
  }
}
