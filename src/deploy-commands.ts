import { REST, Routes } from 'discord.js';
import { config } from './config.js';
import { adminCommand } from './commands/admin/admin.js';
import { balanceCommand } from './commands/user/balance.js';
import { dailyCommand } from './commands/user/daily.js';
import { igriCommand } from './commands/user/igri.js';
import { leaderboardCommand } from './commands/user/leaderboard.js';
import { matchesCommand } from './commands/user/matches.js';
import { myTicketsCommand } from './commands/user/mytickets.js';
import { predictCommand } from './commands/user/predict.js';
import { profileCommand } from './commands/user/profile.js';
import { shopCommand } from './commands/user/shop.js';

const commands = [
  adminCommand.data.toJSON(),
  balanceCommand.data.toJSON(),
  dailyCommand.data.toJSON(),
  igriCommand.data.toJSON(),
  leaderboardCommand.data.toJSON(),
  matchesCommand.data.toJSON(),
  myTicketsCommand.data.toJSON(),
  predictCommand.data.toJSON(),
  profileCommand.data.toJSON(),
  shopCommand.data.toJSON(),
];

if (!config.discord.token || !config.discord.clientId) {
  console.error('❌ DISCORD_TOKEN and CLIENT_ID must be set in .env to deploy commands.');
  process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(config.discord.token);

async function deploy(): Promise<void> {
  try {
    console.log(`🚀 Refreshing ${commands.length} application (/) commands...`);

    if (config.discord.guildId) {
      // Fast guild-scoped deployment for immediate testing
      await rest.put(
        Routes.applicationGuildCommands(config.discord.clientId, config.discord.guildId),
        { body: commands }
      );
      console.log(`✅ Successfully reloaded application commands for guild: ${config.discord.guildId}`);
    } else {
      // Global deployment
      await rest.put(Routes.applicationCommands(config.discord.clientId), { body: commands });
      console.log('✅ Successfully reloaded application commands globally.');
    }
  } catch (error) {
    console.error('❌ Failed to deploy commands:', error);
  }
}

deploy();
