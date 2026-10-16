import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { MatchService } from '../../services/MatchService.js';
import { UserService } from '../../services/UserService.js';

export const igriCommand = {
  data: new SlashCommandBuilder()
    .setName('igri')
    .setDescription('Open the iGRI Fantasy Arena central command dashboard'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = UserService.getOrCreateUser(interaction.user.id, interaction.user.username);
    const season = MatchService.getActiveSeason();
    const openMatches = MatchService.getOpenMatches();

    const embed = new EmbedBuilder()
      .setColor('#7289DA')
      .setTitle('🎮 iGRI Fantasy Arena — Dashboard')
      .setDescription(
        `Welcome to the arena, **${user.username}** [${user.equipped_title}]!\n` +
        'Predict FiveM multi-lobby tournament results, construct combo tickets, and conquer the leaderboard.'
      )
      .addFields(
        {
          name: '🪙 Your Wallet',
          value: `Balance: **${user.balance.toLocaleString()}** | Open Stakes: **${user.reserved_stake.toLocaleString()}**`,
          inline: true,
        },
        {
          name: '🏆 Season Prize Pool',
          value: `**${season.total_pool.toLocaleString()}** coins *(+${season.rollover_amount.toLocaleString()} rollover)*`,
          inline: true,
        },
        {
          name: '📍 Open Lobbies',
          value: openMatches.length > 0 ? `**${openMatches.length}** matches accepting predictions` : 'No open matches currently',
          inline: true,
        }
      )
      .setFooter({ text: 'Strictly virtual coins • No real money value' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_matches').setLabel('View Matches').setStyle(ButtonStyle.Primary).setEmoji('🎮'),
      new ButtonBuilder().setCustomId('btn_mytickets').setLabel('My Slips').setStyle(ButtonStyle.Secondary).setEmoji('🎫'),
      new ButtonBuilder().setCustomId('btn_balance').setLabel('Wallet').setStyle(ButtonStyle.Secondary).setEmoji('💳'),
      new ButtonBuilder().setCustomId('btn_daily').setLabel('Daily Mystery Box').setStyle(ButtonStyle.Success).setEmoji('🎁')
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_leaderboard').setLabel('Leaderboard').setStyle(ButtonStyle.Secondary).setEmoji('🏆'),
      new ButtonBuilder().setCustomId('btn_shop').setLabel('Vanity Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛍️')
    );

    await interaction.reply({ embeds: [embed], components: [row1, row2] });
  },
};
