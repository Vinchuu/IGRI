import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { UserService } from '../../services/UserService.js';
import { FanService } from '../../services/FanService.js';

export const profileCommand = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('View your or another player’s iGRI Arena profile and stats')
    .addUserOption((option) =>
      option.setName('target').setDescription('The player whose profile you want to inspect').setRequired(false)
    ),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const targetUser = interaction.options.getUser('target') || interaction.user;
    const user = UserService.getOrCreateUser(targetUser.id, targetUser.username);
    const inventory = UserService.getUserInventory(user.id);

    // Check if user has a team role in the guild
    const member = interaction.guild?.members.cache.get(targetUser.id);
    const teamRole = FanService.getUserTeamRole(member);
    const allegianceText = teamRole 
      ? `🛡️ Crew Allegiance: <@&${teamRole.roleId}>\n` 
      : '🛡️ Crew Allegiance: *Independent Analyst*\n';

    const accuracyPercent = user.resolved_selections > 0 
      ? ((user.correct_selections / user.resolved_selections) * 100).toFixed(1)
      : '0.0';

    const badges = inventory.map((item) => {
      if (item === 'badge_sharpshooter') return '🎯 Sharpshooter';
      if (item === 'badge_whale') return '🐋 Whale';
      if (item === 'title_oracle') return '🔮 Oracle';
      if (item === 'title_degen') return '🎲 High Roller';
      if (item === 'title_champion') return '👑 Champion';
      return `🏷️ ${item}`;
    });

    const badgeDisplay = badges.length > 0 ? badges.join(' • ') : '*No badges collected yet. Visit `/shop`!*';

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`🏆 ${user.username}'s Arena Dossier`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setDescription(
        `${allegianceText}` +
        `Current Title: **${user.equipped_title}**\n` +
        `Active Streak: **${user.daily_streak} days** 🔥`
      )
      .addFields(
        {
          name: '🪙 Balance',
          value: `**${user.balance.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '📈 Net Profit',
          value: `**${user.lifetime_profit >= 0 ? '+' : ''}${user.lifetime_profit.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '🎯 Prediction Accuracy',
          value: `**${accuracyPercent}%** (${user.correct_selections}/${user.resolved_selections} picks)`,
          inline: true,
        },
        {
          name: '💰 Biggest Win',
          value: `**${user.biggest_win_payout.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '🎲 Total Staked',
          value: `**${user.lifetime_stakes.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '🏅 Trophies & Badges',
          value: badgeDisplay,
          inline: false,
        }
      )
      .setFooter({ text: 'iGRI Fantasy Arena • FiveM Esports' });

    await interaction.reply({ embeds: [embed] });
  },
};
