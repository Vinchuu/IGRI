import { PermissionFlagsBits } from 'discord.js';
import { db } from '../database/db.js';
import { config } from '../config.js';
import { AuditLogService } from './AuditLogService.js';

export class AdminRoleService {
  /**
   * Fetches all registered admin role names or IDs from the database
   */
  static getAdminRoles(): string[] {
    const rows = db.prepare('SELECT role_identifier FROM admin_roles ORDER BY role_identifier ASC').all() as { role_identifier: string }[];
    return rows.map((r) => r.role_identifier);
  }

  /**
   * Adds a new role identifier (role name or role ID) to the admin access list
   */
  static addAdminRole(roleIdentifier: string, adminTag = 'Admin'): boolean {
    const info = db.prepare(`
      INSERT OR IGNORE INTO admin_roles (role_identifier, added_at)
      VALUES (?, ?)
    `).run(roleIdentifier.trim(), Date.now());

    if (info.changes > 0) {
      AuditLogService.logAdminRoleChange(adminTag, 'ADDED', roleIdentifier.trim()).catch(() => {});
    }

    return info.changes > 0;
  }

  /**
   * Removes a role identifier from the admin access list
   */
  static removeAdminRole(roleIdentifier: string, adminTag = 'Admin'): boolean {
    const info = db.prepare('DELETE FROM admin_roles WHERE LOWER(role_identifier) = LOWER(?)').run(roleIdentifier.trim());

    if (info.changes > 0) {
      AuditLogService.logAdminRoleChange(adminTag, 'REMOVED', roleIdentifier.trim()).catch(() => {});
    }

    return info.changes > 0;
  }

  /**
   * Verifies if a Discord GuildMember possesses admin privileges.
   * Checks for:
   * 1. Discord Administrator permission
   * 2. Configured ADMIN_ROLE_ID from .env
   * 3. Configured admin role names/IDs from DB (defaults: '.', '...', 'Crew')
   */
  static isUserAdmin(member: any): boolean {
    if (!member) return false;

    // 1. Native Discord Administrator permission check
    if (member.permissions?.has(PermissionFlagsBits.Administrator)) {
      return true;
    }

    // 2. Specific ADMIN_ROLE_ID from environment
    if (config.discord.adminRoleId && member.roles?.cache?.has(config.discord.adminRoleId)) {
      return true;
    }

    // 3. Check against database role list (matches by role name OR role ID)
    const dbAdminRoles = this.getAdminRoles();
    if (!member.roles?.cache) return false;

    for (const adminIdentifier of dbAdminRoles) {
      const lowerIdentifier = adminIdentifier.toLowerCase();
      // Match by ID
      if (member.roles.cache.has(adminIdentifier)) {
        return true;
      }
      // Match by Name (case-insensitive) - handles Discord Collection, Map, and Array
      const roleList = typeof member.roles.cache.values === 'function'
        ? Array.from(member.roles.cache.values())
        : Array.isArray(member.roles.cache)
        ? member.roles.cache
        : [];

      const hasByName = roleList.some(
        (role: any) => role?.name && role.name.trim().toLowerCase() === lowerIdentifier
      );
      if (hasByName) {
        return true;
      }
    }

    return false;
  }
}
