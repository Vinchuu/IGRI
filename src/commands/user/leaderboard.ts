import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { LeaderboardService } from '../../services/LeaderboardService.js';

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the ranked season leaderboard combining Profit (60%) and Accuracy (40%)'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const rankings = LeaderboardService.getRankings(10);

    const embed = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle('🏆 iGRI Fantasy Arena — Official Leaderboard')
      .setDescription(
        'Rankings are scored via: **0.60 × Profit Score + 0.40 × Accuracy Score**.\n*Note: Requires minimum 10 resolved picks to qualify for official rank.*'
      );

    if (rankings.length === 0) {
      embed.addFields({
        name: 'No Competitors Yet',
        value: 'Be the first to place a combo prediction with `/predict`!',
      });
    } else {
      const rows = rankings.map((r) => {
        const medal = r.rank === 1 ? '🥇' : r.rank === 2 ? '🥈' : r.rank === 3 ? '🥉' : `**#${r.rank}**`;
        const qualifiedTag = r.isQualified ? '' : ' *(Unqualified <10 picks)*';
        const profitSign = r.netProfit >= 0 ? '+' : '';
        return (
          `${medal} **${r.username}** [${r.equippedTitle}]${qualifiedTag}\n` +
          `• **Score:** \`${r.compositeScore} pts\` | **Profit:** \`${profitSign}${r.netProfit.toLocaleString()}\` coins | **Accuracy:** \`${r.accuracyScore}%\` (${r.correctSelections}/${r.resolvedSelections})`
        );
      });

      embed.addFields({
        name: 'Top Analysts',
        value: rows.join('\n\n'),
      });
    }

    embed.setFooter({ text: 'Updated live • Season winners rewarded at tournament final' });

    await interaction.reply({ embeds: [embed] });
  },
};
