import { Guild, GuildMember, Role } from 'discord.js';
import { db } from '../database/db.js';
import { TeamGroupService } from './TeamGroupService.js';

export interface FanbaseScore {
  teamName: string;
  roleId: string | null;
  totalFans: number;
  totalProfit: number;
  avgAccuracy: number;
}

export class FanService {
  /**
   * Finds the user's crew/team role by comparing their Discord roles to registered tournament teams
   */
  static getUserTeamRole(member: any): { teamName: string; roleId: string } | null {
    if (!member || !member.roles?.cache) return null;

    const allTeams = TeamGroupService.getAllTeams();

    const roleValues = typeof member.roles.cache.values === 'function'
      ? Array.from(member.roles.cache.values())
      : Array.isArray(member.roles.cache)
      ? member.roles.cache
      : [];

    for (const role of roleValues as any[]) {
      if (!role?.name) continue;
      const matched = allTeams.find(
        (t) => t.name.toLowerCase().trim() === role.name.toLowerCase().trim()
      );
      if (matched) {
        return { teamName: matched.name, roleId: role.id };
      }
    }

    return null;
  }

  /**
   * Finds the Discord role IDs corresponding to a list of team names
   */
  static getRoleIdsForTeams(guild: Guild, teamNames: string[]): Role[] {
    const matchedRoles: Role[] = [];
    const lowerNames = teamNames.map((t) => t.toLowerCase().trim());

    guild.roles.cache.forEach((role) => {
      if (lowerNames.includes(role.name.toLowerCase().trim())) {
        matchedRoles.push(role);
      }
    });

    return matchedRoles;
  }

  /**
   * Calculates the Fanbase Leaderboard: which team's fans are dominating in profit & accuracy!
   */
  static async getFanbaseLeaderboard(guild: Guild): Promise<FanbaseScore[]> {
    const allTeams = TeamGroupService.getAllTeams();
    const scores: Record<string, { roleId: string | null; profits: number[]; accuracies: number[] }> = {};

    for (const team of allTeams) {
      scores[team.name] = { roleId: null, profits: [], accuracies: [] };
    }

    // Match role IDs in the guild
    guild.roles.cache.forEach((role) => {
      const matched = allTeams.find((t) => t.name.toLowerCase().trim() === role.name.toLowerCase().trim());
      if (matched) {
        scores[matched.name].roleId = role.id;
      }
    });

    // Fetch all users with their stats
    const users = db.prepare(`
      SELECT id, lifetime_profit, resolved_selections, correct_selections 
      FROM users
    `).all() as any[];

    // Fetch guild members to check roles
    const members = await guild.members.fetch().catch(() => guild.members.cache);

    for (const u of users) {
      const member = members.get(u.id);
      if (!member) continue;

      const userRole = this.getUserTeamRole(member);
      if (userRole && scores[userRole.teamName]) {
        scores[userRole.teamName].profits.push(u.lifetime_profit);
        const acc = u.resolved_selections > 0 ? (u.correct_selections / u.resolved_selections) * 100 : 0;
        scores[userRole.teamName].accuracies.push(acc);
      }
    }

    const leaderboard: FanbaseScore[] = [];

    for (const [teamName, data] of Object.entries(scores)) {
      if (data.profits.length > 0) {
        const totalProfit = data.profits.reduce((a, b) => a + b, 0);
        const avgAccuracy = data.accuracies.reduce((a, b) => a + b, 0) / data.accuracies.length;

        leaderboard.push({
          teamName,
          roleId: data.roleId,
          totalFans: data.profits.length,
          totalProfit,
          avgAccuracy: Number(avgAccuracy.toFixed(1)),
        });
      }
    }

    // Sort by total profit
    leaderboard.sort((a, b) => b.totalProfit - a.totalProfit);

    return leaderboard;
  }
}
