import { db } from '../database/db.js';
import { MarketType } from '../types/index.js';

export class OddsService {
  /**
   * Calculates odds for a selection in a match.
   * If there are tickets placed, calculates dynamic selection-frequency odds.
   * Otherwise falls back to balanced multi-lobby base odds.
   */
  static getOdds(matchId: number, marketType: MarketType, target: string, totalTeamsCount = 16): number {
    // Check how many selections have been made for this match and market
    const totalLegs = db.prepare(`
      SELECT COUNT(*) as count 
      FROM ticket_legs 
      WHERE match_id = ? AND market_type = ?
    `).get(matchId, marketType) as { count: number };

    // Default base odds when market is fresh
    let baseOdds = 6.0;
    if (marketType === 'WINNER') {
      baseOdds = Math.max(3.5, Math.min(12.0, totalTeamsCount * 0.45)); // ~7.2x for 16 teams
    } else if (marketType === 'TOP_3') {
      baseOdds = Math.max(1.8, Math.min(4.5, (totalTeamsCount / 3) * 0.55)); // ~2.9x for 16 teams
    } else if (marketType === 'TOP_FRAGGER') {
      baseOdds = Math.max(3.0, Math.min(8.5, totalTeamsCount * 0.35)); // ~5.6x
    }

    if (!totalLegs || totalLegs.count < 5) {
      return Number(baseOdds.toFixed(2));
    }

    // Dynamic odds: based on selection popularity
    const targetLegs = db.prepare(`
      SELECT COUNT(*) as count 
      FROM ticket_legs 
      WHERE match_id = ? AND market_type = ? AND selected_target = ?
    `).get(matchId, marketType, target) as { count: number };

    const fraction = targetLegs.count / totalLegs.count;
    if (fraction <= 0) {
      return Number(baseOdds.toFixed(2));
    }

    // Inverse ratio with bounds
    const rawOdds = (1 / fraction) * 0.85; // with 15% margin
    const minOdd = marketType === 'TOP_3' ? 1.3 : 1.8;
    const maxOdd = marketType === 'WINNER' ? 18.0 : 12.0;

    const dynamic = Math.max(minOdd, Math.min(maxOdd, rawOdds));
    return Number(dynamic.toFixed(2));
  }
}
