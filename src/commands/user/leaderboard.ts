import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { LeaderboardService } from '../../services/LeaderboardService.js';
import { SERVER_EMOJIS } from '../../utils/emojis.js';

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('leaderboard')
    .setDescription('View the ranked season leaderboard combining Profit (60%) and Accuracy (40%)'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const rankings = LeaderboardService.getRankings(10);

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Leaderboard`)
      .setDescription(
        `Top analysts ranked by **60% Profit + 40% Accuracy** (min. 10 picks to qualify).`
      );

    if (rankings.length === 0) {
      embed.addFields({
        name: '🏆 No Ranked Players',
        value: 'Place your first winning prediction with `/predict` to join the board!',
      });
    } else {
      const rows = rankings.map((r) => {
        let medal = `\`#${r.rank}\``;
        if (r.rank === 1) medal = '🥇';
        else if (r.rank === 2) medal = '🥈';
        else if (r.rank === 3) medal = '🥉';

        const qualifiedTag = r.isQualified ? ' ⭐' : '';
        const profitSign = r.netProfit >= 0 ? '+' : '';

        return (
          `• ${medal} **${r.username}** \`${r.equippedTitle}\`${qualifiedTag}\n` +
          `  Score: **${r.compositeScore}** • Profit: **${profitSign}${r.netProfit.toLocaleString()}** coins • Acc: **${r.accuracyScore}%**`
        );
      });

      embed.addFields({
        name: '🏅 Top Analysts',
        value: rows.join('\n'),
      });
    }

    embed.setFooter({ text: 'VC Arena • Updated in real-time' });

    await interaction.reply({ embeds: [embed] });
  },
};
