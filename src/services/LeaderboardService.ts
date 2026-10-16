import { db } from '../database/db.js';
import { config } from '../config.js';

export interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  equippedTitle: string;
  netProfit: number;
  balance: number;
  accuracyScore: number;
  profitScore: number;
  compositeScore: number;
  resolvedSelections: number;
  correctSelections: number;
  isQualified: boolean;
}

export class LeaderboardService {
  /**
   * Fetches ranked leaderboard computed according to GDD formula:
   * Rank Score = 0.60 * P + 0.40 * A
   * Requires min 10 resolved selections to qualify for top ranks.
   */
  static getRankings(limit = 10): LeaderboardEntry[] {
    const users = db.prepare(`
      SELECT 
        id, username, equipped_title, balance, lifetime_profit,
        resolved_selections, correct_selections
      FROM users
      ORDER BY lifetime_profit DESC
    `).all() as any[];

    if (users.length === 0) return [];

    // Find min and max profits for normalization
    const profits = users.map((u) => u.lifetime_profit);
    const maxProfit = Math.max(...profits, 1);
    const minProfit = Math.min(...profits, 0);

    const entries: LeaderboardEntry[] = users.map((u) => {
      const resolved = u.resolved_selections || 0;
      const correct = u.correct_selections || 0;
      const accuracy = resolved > 0 ? (correct / resolved) * 100 : 0;

      // Normalization of profit to 0-100 scale:
      // If all profits are equal, default to 50
      let normProfit = 50;
      if (maxProfit !== minProfit) {
        normProfit = Math.max(0, Math.min(100, ((u.lifetime_profit - minProfit) / (maxProfit - minProfit)) * 100));
      } else if (u.lifetime_profit > 0) {
        normProfit = 100;
      }

      const composite = Number((0.6 * normProfit + 0.4 * accuracy).toFixed(2));
      const isQualified = resolved >= config.economy.minSelectionsForRanked;

      return {
        rank: 0,
        userId: u.id,
        username: u.username,
        equippedTitle: u.equipped_title || 'Rookie Analyst',
        netProfit: u.lifetime_profit,
        balance: u.balance,
        accuracyScore: Number(accuracy.toFixed(1)),
        profitScore: Number(normProfit.toFixed(1)),
        compositeScore: composite,
        resolvedSelections: resolved,
        correctSelections: correct,
        isQualified,
      };
    });

    // Qualified players rank first, sorted by composite score, then accuracy, then profit
    entries.sort((a, b) => {
      if (a.isQualified && !b.isQualified) return -1;
      if (!a.isQualified && b.isQualified) return 1;

      if (b.compositeScore !== a.compositeScore) {
        return b.compositeScore - a.compositeScore;
      }
      if (b.accuracyScore !== a.accuracyScore) {
        return b.accuracyScore - a.accuracyScore;
      }
      return b.netProfit - a.netProfit;
    });

    // Assign 1-indexed ranks
    entries.forEach((e, idx) => {
      e.rank = idx + 1;
    });

    return entries.slice(0, limit);
  }
}
