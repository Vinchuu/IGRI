import { db } from '../database/db.js';

export interface TeamEntity {
  id: number;
  name: string;
  group_name: string | null;
}

export class TeamGroupService {
  /**
   * Returns all registered tournament teams
   */
  static getAllTeams(): TeamEntity[] {
    return db.prepare('SELECT * FROM teams ORDER BY name COLLATE NOCASE ASC').all() as TeamEntity[];
  }

  /**
   * Returns all teams belonging to a specific group (e.g. 'Group A')
   */
  static getTeamsByGroup(groupName: string): string[] {
    const rows = db.prepare('SELECT name FROM teams WHERE LOWER(group_name) = LOWER(?) ORDER BY name ASC').all(groupName) as { name: string }[];
    return rows.map((r) => r.name);
  }

  /**
   * Returns all distinct group names
   */
  static getGroupNames(): string[] {
    const rows = db.prepare('SELECT DISTINCT group_name FROM teams WHERE group_name IS NOT NULL ORDER BY group_name ASC').all() as { group_name: string }[];
    return rows.map((r) => r.group_name);
  }

  /**
   * Returns all groups and their assigned teams
   */
  static getGroupsSummary(): Record<string, string[]> {
    const teams = this.getAllTeams();
    const summary: Record<string, string[]> = {};

    for (const t of teams) {
      const g = t.group_name || 'Ungrouped';
      if (!summary[g]) summary[g] = [];
      summary[g].push(t.name);
    }

    return summary;
  }

  /**
   * Assigns a list of teams to a specific group
   */
  static assignTeamsToGroup(groupName: string, teamNames: string[]): { assigned: string[]; notFound: string[] } {
    const assigned: string[] = [];
    const notFound: string[] = [];

    const updateTx = db.transaction(() => {
      const updateStmt = db.prepare('UPDATE teams SET group_name = ? WHERE LOWER(name) = LOWER(?)');

      for (const rawName of teamNames) {
        const trimmed = rawName.trim();
        if (!trimmed) continue;

        const info = updateStmt.run(groupName.trim(), trimmed);
        if (info.changes > 0) {
          assigned.push(trimmed);
        } else {
          // If team doesn't exist, create it with this group
          db.prepare('INSERT INTO teams (name, group_name) VALUES (?, ?)').run(trimmed, groupName.trim());
          assigned.push(trimmed);
        }
      }
    });

    updateTx();
    return { assigned, notFound };
  }

  /**
   * Automatically splits all teams evenly into N groups (e.g., Group A, Group B, Group C...)
   */
  static autoSplitIntoGroups(numGroups = 3): Record<string, string[]> {
    const teams = this.getAllTeams();
    const groupLetters = ['Group A', 'Group B', 'Group C', 'Group D', 'Group E', 'Group F'];
    const groups: Record<string, string[]> = {};

    const count = Math.min(numGroups, groupLetters.length);
    for (let i = 0; i < count; i++) {
      groups[groupLetters[i]] = [];
    }

    const updateTx = db.transaction(() => {
      const updateStmt = db.prepare('UPDATE teams SET group_name = ? WHERE id = ?');

      teams.forEach((team, index) => {
        const assignedGroup = groupLetters[index % count];
        updateStmt.run(assignedGroup, team.id);
        groups[assignedGroup].push(team.name);
      });
    });

    updateTx();
    return groups;
  }

  /**
   * Resets all teams to ungrouped (group_name = NULL)
   */
  static resetAllGroups(): number {
    const info = db.prepare('UPDATE teams SET group_name = NULL').run();
    return info.changes;
  }

  /**
   * Searches teams for Discord slash command autocomplete
   */
  static searchTeams(query: string, limit = 25): string[] {
    const rows = db.prepare(`
      SELECT name FROM teams 
      WHERE name LIKE ? 
      ORDER BY name ASC 
      LIMIT ?
    `).all(`%${query}%`, limit) as { name: string }[];

    return rows.map((r) => r.name);
  }

  /**
   * Adds a new team
   */
  static addTeam(name: string, groupName: string | null = null): void {
    db.prepare('INSERT OR REPLACE INTO teams (name, group_name) VALUES (?, ?)').run(name.trim(), groupName);
  }

  /**
   * Removes a team
   */
  static removeTeam(name: string): boolean {
    const info = db.prepare('DELETE FROM teams WHERE LOWER(name) = LOWER(?)').run(name.trim());
    return info.changes > 0;
  }
}
