import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { MatchService } from '../../services/MatchService.js';

export const matchesCommand = {
  data: new SlashCommandBuilder()
    .setName('matches')
    .setDescription('View open iGRI tournament lobbies, participating crews, and deadlines'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const matches = MatchService.getOpenMatches();

    const embed = new EmbedBuilder()
      .setColor('#00E676')
      .setTitle('🎮 Upcoming iGRI Tournament Lobbies')
      .setDescription('Place your combo predictions with `/predict` before the deadline strikes!');

    if (matches.length === 0) {
      embed.addFields({
        name: 'No Active Lobbies Open',
        value: 'All current matches are locked or settled. Check back soon for the next tournament day schedule!',
      });
    } else {
      for (const m of matches) {
        const deadlineTimestamp = Math.floor(m.deadline / 1000);
        const scheduledTimestamp = Math.floor(m.scheduled_time / 1000);

        embed.addFields({
          name: `📍 Match #${m.match_number}: ${m.lobby_name} [ID: ${m.id}]`,
          value:
            `• **Starts:** <t:${scheduledTimestamp}:t> (<t:${scheduledTimestamp}:R>)\n` +
            `• **Locks:** <t:${deadlineTimestamp}:R>\n` +
            `• **Teams (${m.participating_teams.length}):** ${m.participating_teams.join(', ')}\n` +
            `• **Available Markets:** \`1st Place (Winner)\`, \`Top 3 Finish\`, \`Top Fragger\``,
          inline: false,
        });
      }
    }

    embed.setFooter({ text: 'Tip: Combine 2 to 5 distinct matches for a combo ticket!' });

    await interaction.reply({ embeds: [embed] });
  },
};
