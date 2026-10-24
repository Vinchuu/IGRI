import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { MatchService } from '../../services/MatchService.js';
import { SERVER_EMOJIS, formatTeamWithEmoji } from '../../utils/emojis.js';

export const matchesCommand = {
  data: new SlashCommandBuilder()
    .setName('matches')
    .setDescription('View open iGRI tournament lobbies, participating crews, and deadlines'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const matches = MatchService.getOpenMatches();

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Match Schedule`)
      .setDescription(
        `Open tournament lobbies ready for predictions. Lock in your slips before the deadline!`
      );

    if (matches.length === 0) {
      embed.addFields({
        name: '⏳ No Active Matches',
        value: 'All lobbies are currently locked or concluded. Admins will open the next match soon!',
      });
      await interaction.reply({ embeds: [embed] });
      return;
    }

    const actionRow = new ActionRowBuilder<ButtonBuilder>();

    for (const m of matches) {
      const deadlineTimestamp = Math.floor(m.deadline / 1000);

      const teamListFormatted = m.participating_teams
        .slice(0, 10)
        .map((t) => formatTeamWithEmoji(t))
        .join(', ') + (m.participating_teams.length > 10 ? ` *+${m.participating_teams.length - 10} more*` : '');

      embed.addFields({
        name: `🎮 Match #${m.match_number} • ${m.lobby_name}`,
        value:
          `• **Closes:** <t:${deadlineTimestamp}:R> (<t:${deadlineTimestamp}:t>)\n` +
          `• **Teams (${m.participating_teams.length}):** ${teamListFormatted}`,
        inline: false,
      });

      if (actionRow.components.length < 4) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`btn_predict_match_${m.id}`)
            .setLabel(`Predict #${m.match_number}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎯')
        );
      }
    }

    actionRow.addComponents(
      new ButtonBuilder().setCustomId('user_ui_home').setLabel('Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠')
    );

    embed.setFooter({ text: 'VC Arena • Select a match to predict' });

    await interaction.reply({ embeds: [embed], components: [actionRow] });
  },
};
