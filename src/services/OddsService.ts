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
    let baseOdds = 3.5;
    if (marketType === 'POS_1') {
      baseOdds = Math.max(5.0, Math.min(15.0, totalTeamsCount * 0.5)); // ~8.0x for 16 teams
    } else if (marketType === 'POS_2_3') {
      baseOdds = Math.max(2.8, Math.min(7.0, (totalTeamsCount / 2) * 0.55)); // ~4.4x
    } else if (marketType === 'POS_3_5') {
      baseOdds = Math.max(2.0, Math.min(5.0, (totalTeamsCount / 3) * 0.6)); // ~3.2x
    } else if (marketType === 'POS_5_10' || marketType === 'POS_6_10') {
      baseOdds = Math.max(1.5, Math.min(3.5, (totalTeamsCount / 5) * 0.65)); // ~2.1x
    } else if (marketType === 'POS_11_16') {
      baseOdds = Math.max(1.3, Math.min(2.5, (totalTeamsCount / 6) * 0.65)); // ~1.7x
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
    const minOdd = marketType === 'POS_11_16' ? 1.2 : (marketType === 'POS_5_10' || marketType === 'POS_6_10') ? 1.4 : 1.8;
    const maxOdd = marketType === 'POS_1' ? 20.0 : 12.0;

    const dynamic = Math.max(minOdd, Math.min(maxOdd, rawOdds));
    return Number(dynamic.toFixed(2));
  }
}
