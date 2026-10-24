import dotenv from 'dotenv';
import path from 'path';

dotenv.config();

export const config = {
  discord: {
    token: process.env.DISCORD_TOKEN || '',
    clientId: process.env.CLIENT_ID || '',
    guildId: process.env.GUILD_ID || '',
    adminRoleId: process.env.ADMIN_ROLE_ID || '',
    prefix: process.env.PREFIX || '!',
    logChannelId: process.env.LOG_CHANNEL_ID || '1563127937249710110',
  },
  economy: {
    startingBalance: parseInt(process.env.STARTING_BALANCE || '10000', 10),
    dailyClaimBase: parseInt(process.env.DAILY_CLAIM_BASE || '250', 10),
    maxTicketStake: parseInt(process.env.MAX_TICKET_STAKE || '1000', 10),
    minTicketStake: 50,
    maxOpenStakeLimit: parseInt(process.env.MAX_OPEN_STAKE_LIMIT || '3000', 10),
    minComboSize: parseInt(process.env.MIN_COMBO_SIZE || '1', 10),
    maxComboSize: parseInt(process.env.MAX_COMBO_SIZE || '5', 10),
    seasonCoinSinkPercent: parseInt(process.env.SEASON_COIN_SINK_PERCENT || '5', 10),
    rolloverCap: parseInt(process.env.ROLLOVER_CAP || '100000', 10),
    minSelectionsForRanked: 10,
    minWinFloorMultiplier: 1.05,
  },
  database: {
    path: process.env.DATABASE_PATH || path.join(process.cwd(), 'data', 'igri_arena.db'),
  },
};
