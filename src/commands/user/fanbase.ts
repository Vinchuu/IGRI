import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { FanService } from '../../services/FanService.js';
import { formatTeamWithEmoji, SERVER_EMOJIS } from '../../utils/emojis.js';

export const fanbaseCommand = {
  data: new SlashCommandBuilder()
    .setName('fanbase')
    .setDescription('View the Fanbase War leaderboard: Which crew’s supporters are winning the most coins?'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!interaction.guild) {
      await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
      return;
    }

    await interaction.deferReply();

    const leaderboard = await FanService.getFanbaseLeaderboard(interaction.guild);

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} Fanbase Leaderboard`)
      .setDescription(
        'Aggregated profit and accuracy of all players representing their team roles in the server!\n' +
        '*Want to contribute? Equip your team role in the server.*'
      );

    if (leaderboard.length === 0) {
      embed.addFields({
        name: 'No Active Fanbases Yet',
        value: 'Equip your team role and lock in predictions to represent your squad!',
      });
    } else {
      const rows = leaderboard.slice(0, 10).map((f, idx) => {
        const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `**#${idx + 1}**`;
        const roleTag = f.roleId ? `<@&${f.roleId}>` : `**${f.teamName}**`;
        const sign = f.totalProfit >= 0 ? '+' : '';
        const teamWithEmoji = formatTeamWithEmoji(f.teamName, interaction.guild || undefined);

        return (
          `${medal} ${teamWithEmoji} ${roleTag} (${f.totalFans} fans)\n` +
          `└ 🪙 Net: \`${sign}${f.totalProfit.toLocaleString()}\` coins • 🎯 Acc: \`${f.avgAccuracy}%\``
        );
      });

      embed.addFields({ name: 'Top Performing Fanbases', value: rows.join('\n\n') });
    }

    embed.setFooter({ text: 'VC Arena • Live Crew Rankings' });

    await interaction.editReply({ embeds: [embed] });
  },
};
