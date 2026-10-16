import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { config } from '../config.js';

const dbDir = path.dirname(config.database.path);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

export const db = new Database(config.database.path);

// Optimize performance & enforce ACID guarantees
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');
db.pragma('synchronous = NORMAL');

export function initDatabase(): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 10000,
      reserved_stake INTEGER NOT NULL DEFAULT 0,
      last_daily_claim INTEGER DEFAULT NULL,
      daily_streak INTEGER NOT NULL DEFAULT 0,
      lifetime_profit INTEGER NOT NULL DEFAULT 0,
      lifetime_won_payouts INTEGER NOT NULL DEFAULT 0,
      lifetime_stakes INTEGER NOT NULL DEFAULT 0,
      resolved_selections INTEGER NOT NULL DEFAULT 0,
      correct_selections INTEGER NOT NULL DEFAULT 0,
      biggest_win_payout INTEGER NOT NULL DEFAULT 0,
      equipped_title TEXT NOT NULL DEFAULT 'Rookie Analyst',
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- DRAFT, ACTIVE, SETTLED, CANCELLED
      total_pool INTEGER NOT NULL DEFAULT 0,
      distributable_pool INTEGER NOT NULL DEFAULT 0,
      rollover_amount INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      settled_at INTEGER DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS matches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL REFERENCES seasons(id),
      match_number INTEGER NOT NULL,
      lobby_name TEXT NOT NULL,
      scheduled_time INTEGER NOT NULL,
      deadline INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'OPEN', -- DRAFT, OPEN, LOCKED, SETTLED, CANCELLED
      participating_teams TEXT NOT NULL, -- JSON string array
      participating_players TEXT, -- JSON string array
      result_winner TEXT DEFAULT NULL,
      result_second TEXT DEFAULT NULL,
      result_third TEXT DEFAULT NULL,
      result_top_fragger TEXT DEFAULT NULL,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tickets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      season_id INTEGER NOT NULL REFERENCES seasons(id),
      stake INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'ACTIVE', -- SUBMITTED, ACTIVE, WON, LOST, REFUNDED
      combo_weight REAL NOT NULL DEFAULT 1.0,
      payout INTEGER NOT NULL DEFAULT 0,
      is_insured INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ticket_legs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ticket_id INTEGER NOT NULL REFERENCES tickets(id) ON DELETE CASCADE,
      match_id INTEGER NOT NULL REFERENCES matches(id),
      market_type TEXT NOT NULL, -- WINNER, TOP_3, TOP_FRAGGER
      selected_target TEXT NOT NULL,
      locked_odds REAL NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING' -- PENDING, WON, LOST, VOID
    );

    CREATE TABLE IF NOT EXISTS transactions_ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      balance_after INTEGER NOT NULL,
      reference_id TEXT,
      notes TEXT,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shop_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      cost INTEGER NOT NULL,
      type TEXT NOT NULL, -- ROLE, TITLE, BADGE
      role_id TEXT,
      badge_emoji TEXT
    );

    CREATE TABLE IF NOT EXISTS user_inventory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL REFERENCES users(id),
      item_id TEXT NOT NULL REFERENCES shop_items(id),
      acquired_at INTEGER NOT NULL,
      UNIQUE(user_id, item_id)
    );

    CREATE TABLE IF NOT EXISTS teams (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      group_name TEXT DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS admin_roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      role_identifier TEXT NOT NULL UNIQUE,
      added_at INTEGER NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_tickets_user ON tickets(user_id);
    CREATE INDEX IF NOT EXISTS idx_tickets_season ON tickets(season_id);
    CREATE INDEX IF NOT EXISTS idx_legs_match ON ticket_legs(match_id);
    CREATE INDEX IF NOT EXISTS idx_transactions_user ON transactions_ledger(user_id);
    CREATE INDEX IF NOT EXISTS idx_teams_group ON teams(group_name);
  `);

  // Seed default Season 1 if none exists
  const activeSeason = db.prepare("SELECT id FROM seasons WHERE status = 'ACTIVE' LIMIT 1").get();
  if (!activeSeason) {
    db.prepare(`
      INSERT INTO seasons (name, status, total_pool, distributable_pool, rollover_amount, created_at)
      VALUES (?, 'ACTIVE', 0, 0, 0, ?)
    `).run('iGRI Season 1: FiveM Championship', Date.now());
  }

  // Seed default vanity shop items
  const seedShopItem = db.prepare(`
    INSERT OR IGNORE INTO shop_items (id, name, description, cost, type, badge_emoji)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  seedShopItem.run('title_oracle', '🔮 FiveM Oracle', 'Title: Predictor with unmatched foresight', 15000, 'TITLE', '🔮');
  seedShopItem.run('title_degen', '🎲 High Roller', 'Title: Lives on maximum 1,000 stake combos', 25000, 'TITLE', '🎲');
  seedShopItem.run('title_champion', '👑 Arena Champion', 'Title: Revered champion of the iGRI lobby', 50000, 'TITLE', '👑');
  seedShopItem.run('badge_sharpshooter', '🎯 Sharpshooter Badge', 'Badge displayed proudly on your profile card', 5000, 'BADGE', '🎯');
  seedShopItem.run('badge_whale', '🐋 Whale Badge', 'Show the Discord server your virtual wealth', 20000, 'BADGE', '🐋');

  // Seed default admin roles ('.', '...', 'Crew')
  const defaultAdminRoles = ['.', '...', 'Crew'];
  const insertAdminRole = db.prepare(`
    INSERT OR IGNORE INTO admin_roles (role_identifier, added_at)
    VALUES (?, ?)
  `);
  for (const role of defaultAdminRoles) {
    insertAdminRole.run(role, Date.now());
  }

  // Seed the 43 official iGRI tournament teams
  const officialTeams = [
    'NXT8',
    'No Rules',
    'REDLINE',
    'Washed out',
    'Mangalyaan',
    'Red network',
    'Pew Pew',
    'Guns n roses',
    'Sayless',
    'Black reign',
    'Pookie.Exe',
    'Wardogs',
    'No limit',
    'Sapola',
    '1Invictuz',
    'Silent trigger',
    '2Fast',
    'W Esports',
    'Team Healers',
    'Underlords',
    'Nothing2lose',
    'Kalyug',
    'Wz Demons',
    'Team rip',
    'Just chill',
    'Team og',
    'Phantoms',
    'Whiffgods',
    'We gucci',
    'Onlypanic',
    'Skillz',
    'The escapers',
    'Death brigade',
    'Team bbg',
    'Ravenx',
    'Santra Esports',
    'Goat protocol',
    'Early eliminators',
    'Code 999',
    'The final dispatch',
    'Zero plans',
    'Low fps',
    'Road killers',
  ];

  const insertTeam = db.prepare(`
    INSERT OR IGNORE INTO teams (name, group_name)
    VALUES (?, NULL)
  `);

  const seedTeamsTx = db.transaction(() => {
    for (const team of officialTeams) {
      insertTeam.run(team);
    }
  });
  seedTeamsTx();
}
