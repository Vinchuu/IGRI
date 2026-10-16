import { db } from '../database/db.js';
import { UserService } from './UserService.js';

export interface MysteryBoxReward {
  baseAmount: number;
  streakBonus: number;
  totalCoins: number;
  tierName: string;
  tierEmoji: string;
  streakDays: number;
  nextClaimTime: number;
}

export class MysteryBoxService {
  private static COOLDOWN_MS = 24 * 60 * 60 * 1000; // 24 hours
  private static STREAK_RESET_MS = 48 * 60 * 60 * 1000; // 48 hours

  /**
   * Checks if user can claim their daily mystery box
   */
  static getCooldownInfo(userId: string): { canClaim: boolean; remainingMs: number } {
    const user = db.prepare('SELECT last_daily_claim FROM users WHERE id = ?').get(userId) as { last_daily_claim: number | null } | undefined;
    if (!user || !user.last_daily_claim) {
      return { canClaim: true, remainingMs: 0 };
    }

    const elapsed = Date.now() - user.last_daily_claim;
    if (elapsed >= this.COOLDOWN_MS) {
      return { canClaim: true, remainingMs: 0 };
    }

    return { canClaim: false, remainingMs: this.COOLDOWN_MS - elapsed };
  }

  /**
   * Opens the daily mystery box
   */
  static openBox(userId: string, username: string): MysteryBoxReward {
    const user = UserService.getOrCreateUser(userId, username);
    const now = Date.now();

    const cooldown = this.getCooldownInfo(userId);
    if (!cooldown.canClaim) {
      const hours = Math.floor(cooldown.remainingMs / (1000 * 60 * 60));
      const minutes = Math.floor((cooldown.remainingMs % (1000 * 60 * 60)) / (1000 * 60));
      throw new Error(`Mystery Box is on cooldown! You can open another box in ${hours}h ${minutes}m.`);
    }

    // Determine streak
    let newStreak = 1;
    if (user.last_daily_claim) {
      const timeSinceLast = now - user.last_daily_claim;
      if (timeSinceLast <= this.STREAK_RESET_MS) {
        newStreak = user.daily_streak + 1;
      }
    }

    // Roll loot table
    const roll = Math.random() * 100;
    let baseAmount = 250;
    let tierName = 'Standard Crate';
    let tierEmoji = '📦';

    if (roll < 2) {
      // 2% chance
      baseAmount = 2500;
      tierName = '👑 LEGENDARY MEGA JACKPOT';
      tierEmoji = '💎';
    } else if (roll < 10) {
      // 8% chance
      baseAmount = 1000;
      tierName = '🔥 High Roller Vault';
      tierEmoji = '🏆';
    } else if (roll < 30) {
      // 20% chance
      baseAmount = 500;
      tierName = '✨ Lucky Supply Drop';
      tierEmoji = '🎁';
    } else if (roll < 75) {
      // 45% chance
      baseAmount = 250;
      tierName = '📦 Standard Loot Crate';
      tierEmoji = '📦';
    } else {
      // 25% chance
      baseAmount = 150;
      tierName = '💼 Small Pouch';
      tierEmoji = '💼';
    }

    // Streak bonus: +5% per streak day, max +35% (7 days)
    const streakPercent = Math.min(35, (newStreak - 1) * 5);
    const streakBonus = Math.floor(baseAmount * (streakPercent / 100));
    const totalCoins = baseAmount + streakBonus;

    const executeClaim = db.transaction(() => {
      const newBalance = user.balance + totalCoins;

      db.prepare(`
        UPDATE users 
        SET balance = ?,
            last_daily_claim = ?,
            daily_streak = ?
        WHERE id = ?
      `).run(newBalance, now, newStreak, userId);

      db.prepare(`
        INSERT INTO transactions_ledger (user_id, type, amount, balance_after, reference_id, notes, created_at)
        VALUES (?, 'DAILY_REWARD', ?, ?, NULL, ?, ?)
      `).run(
        userId,
        totalCoins,
        newBalance,
        `Daily Mystery Box (${tierName}, Day ${newStreak} Streak Bonus: +${streakBonus})`,
        now
      );
    });

    executeClaim();

    return {
      baseAmount,
      streakBonus,
      totalCoins,
      tierName,
      tierEmoji,
      streakDays: newStreak,
      nextClaimTime: now + this.COOLDOWN_MS,
    };
  }
}
