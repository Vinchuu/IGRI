import { db } from '../database/db.js';
import { Match, MatchStatus, Season } from '../types/index.js';

export class MatchService {
  /**
   * Retrieves the currently active season
   */
  static getActiveSeason(): Season {
    const season = db.prepare("SELECT * FROM seasons WHERE status = 'ACTIVE' ORDER BY id DESC LIMIT 1").get() as Season | undefined;
    if (!season) {
      const now = Date.now();
      const info = db.prepare(`
        INSERT INTO seasons (name, status, total_pool, distributable_pool, rollover_amount, created_at)
        VALUES ('iGRI Championship Season', 'ACTIVE', 0, 0, 0, ?)
      `).run(now);
      return db.prepare('SELECT * FROM seasons WHERE id = ?').get(info.lastInsertRowid) as Season;
    }
    return season;
  }

  /**
   * Creates a new match lobby for the active season
   */
  static createMatch(
    matchNumber: number,
    lobbyName: string,
    scheduledTime: number,
    deadline: number,
    teams: string[],
    players: string[] = []
  ): Match {
    const season = this.getActiveSeason();
    const now = Date.now();

    const info = db.prepare(`
      INSERT INTO matches (
        season_id, match_number, lobby_name, scheduled_time, deadline, status,
        participating_teams, participating_players, created_at
      ) VALUES (?, ?, ?, ?, ?, 'OPEN', ?, ?, ?)
    `).run(
      season.id,
      matchNumber,
      lobbyName,
      scheduledTime,
      deadline,
      JSON.stringify(teams),
      JSON.stringify(players.length > 0 ? players : teams),
      now
    );

    return this.getMatchById(Number(info.lastInsertRowid))!;
  }

  /**
   * Gets a match by ID
   */
  static getMatchById(id: number): Match | null {
    const row = db.prepare('SELECT * FROM matches WHERE id = ?').get(id) as any;
    if (!row) return null;

    return {
      ...row,
      participating_teams: JSON.parse(row.participating_teams || '[]'),
      participating_players: JSON.parse(row.participating_players || '[]'),
    };
  }

  /**
   * Gets all currently open matches whose deadline has not passed
   */
  static getOpenMatches(): Match[] {
    const now = Date.now();
    // Auto-lock expired matches
    db.prepare(`UPDATE matches SET status = 'LOCKED' WHERE status = 'OPEN' AND deadline <= ?`).run(now);

    const rows = db.prepare(`
      SELECT * FROM matches 
      WHERE status = 'OPEN' AND deadline > ? 
      ORDER BY scheduled_time ASC
    `).all(now) as any[];

    return rows.map((row) => ({
      ...row,
      participating_teams: JSON.parse(row.participating_teams || '[]'),
      participating_players: JSON.parse(row.participating_players || '[]'),
    }));
  }

  /**
   * Gets all matches for the current season
   */
  static getAllSeasonMatches(seasonId: number): Match[] {
    const rows = db.prepare(`
      SELECT * FROM matches 
      WHERE season_id = ? 
      ORDER BY match_number ASC
    `).all(seasonId) as any[];

    return rows.map((row) => ({
      ...row,
      participating_teams: JSON.parse(row.participating_teams || '[]'),
      participating_players: JSON.parse(row.participating_players || '[]'),
    }));
  }

  /**
   * Update match status
   */
  static updateStatus(matchId: number, status: MatchStatus): void {
    db.prepare('UPDATE matches SET status = ? WHERE id = ?').run(status, matchId);
  }
}
