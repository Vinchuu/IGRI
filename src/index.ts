import {
  Client,
  Collection,
  GatewayIntentBits,
  Interaction,
  Partials,
} from 'discord.js';
import { config } from './config.js';
import { initDatabase, db } from './database/db.js';
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
import { handleButtonInteraction, handleSelectMenuInteraction } from './interactions/buttonHandler.js';
import { MatchService } from './services/MatchService.js';

console.log('⚡ Initializing iGRI Fantasy Arena Bot...');

// Initialize database & tables
initDatabase();
console.log('📦 Database initialized and tables verified (WAL mode enabled).');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ],
  partials: [Partials.Channel, Partials.Message],
});

// Register slash commands into collection
const commands = new Collection<string, any>();
const commandList = [
  adminCommand,
  balanceCommand,
  dailyCommand,
  igriCommand,
  leaderboardCommand,
  matchesCommand,
  myTicketsCommand,
  predictCommand,
  profileCommand,
  shopCommand,
];

for (const cmd of commandList) {
  commands.set(cmd.data.name, cmd);
}

// Ready event
client.once('ready', (c) => {
  console.log(`🤖 Logged in as ${c.user.tag}! Active across ${c.guilds.cache.size} server(s).`);

  // Check for expired matches every 60 seconds and lock them
  setInterval(() => {
    try {
      MatchService.getOpenMatches(); // Automatically locks any matches past deadline
    } catch (e) {
      console.error('Error running match auto-lock check:', e);
    }
  }, 60 * 1000);
});

// Interaction Dispatcher
client.on('interactionCreate', async (interaction: Interaction) => {
  try {
    if (interaction.isAutocomplete()) {
      const command = commands.get(interaction.commandName);
      if (command && typeof command.autocomplete === 'function') {
        await command.autocomplete(interaction);
      }
      return;
    }

    if (interaction.isChatInputCommand()) {
      const command = commands.get(interaction.commandName);
      if (!command) {
        console.warn(`Unknown command executed: ${interaction.commandName}`);
        return;
      }
      await command.execute(interaction);
      return;
    }

    if (interaction.isButton()) {
      await handleButtonInteraction(interaction);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      await handleSelectMenuInteraction(interaction);
      return;
    }
  } catch (err: any) {
    console.error('Unhandled interaction error:', err);
    const replyPayload = {
      content: `⚠️ An unexpected error occurred: ${err.message || 'Unknown error'}`,
      ephemeral: true,
    };

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(replyPayload).catch(() => {});
      } else {
        await interaction.reply(replyPayload).catch(() => {});
      }
    }
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n🛑 Gracefully closing database and disconnecting bot...');
  db.close();
  client.destroy();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Gracefully closing database and disconnecting bot...');
  db.close();
  client.destroy();
  process.exit(0);
});

// Start bot
if (config.discord.token) {
  client.login(config.discord.token).catch((err) => {
    console.error('❌ Failed to log into Discord:', err.message);
  });
} else {
  console.warn('⚠️ No DISCORD_TOKEN found in .env. Please set your token to connect to Discord.');
}
