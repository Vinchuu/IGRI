import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { UserService } from '../../services/UserService.js';
import { FanService } from '../../services/FanService.js';
import { SERVER_EMOJIS } from '../../utils/emojis.js';

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
      ? `🛡️ **Crew Allegiance:** <@&${teamRole.roleId}>\n` 
      : '🛡️ **Crew Allegiance:** *Independent Esports Analyst*\n';

    const accuracyPercent = user.resolved_selections > 0 
      ? ((user.correct_selections / user.resolved_selections) * 100).toFixed(1)
      : '0.0';

    const badges = inventory.map((item) => {
      if (item === 'badge_sharpshooter') return '🎯 **Sharpshooter**';
      if (item === 'badge_whale') return '🐋 **Whale**';
      if (item === 'title_oracle') return '🔮 **Oracle**';
      if (item === 'title_degen') return '🎲 **High Roller**';
      if (item === 'title_champion') return '👑 **Champion**';
      return `🏷️ **${item}**`;
    });

    const badgeDisplay = badges.length > 0 ? badges.join(' • ') : '*No vanity badges unlocked yet. Visit `/shop`!*';

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Profile: ${user.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setDescription(
        (teamRole ? `Fan of <@&${teamRole.roleId}> • ` : '') +
        `Title: \`${user.equipped_title}\` • Streak: **${user.daily_streak}d** 🔥`
      )
      .addFields(
        {
          name: '🪙 Balance',
          value:
            `• Available: **${user.balance.toLocaleString()}**\n` +
            `• In Play: **${user.reserved_stake.toLocaleString()}**\n` +
            `• Net Worth: **${(user.balance + user.reserved_stake).toLocaleString()}**`,
          inline: true,
        },
        {
          name: '📊 Performance',
          value:
            `• Net Profit: **${user.lifetime_profit >= 0 ? '+' : ''}${user.lifetime_profit.toLocaleString()}**\n` +
            `• Accuracy: **${accuracyPercent}%** (${user.correct_selections}/${user.resolved_selections})\n` +
            `• Top Win: **${user.biggest_win_payout.toLocaleString()}**`,
          inline: true,
        },
        {
          name: '🎲 Wagering Volume',
          value:
            `• Total Staked: **${user.lifetime_stakes.toLocaleString()}**\n` +
            `• Total Won: **${user.lifetime_won_payouts.toLocaleString()}**\n` +
            `• ROI: **${user.lifetime_stakes > 0 ? ((user.lifetime_won_payouts / user.lifetime_stakes) * 100).toFixed(1) : 0}%**`,
          inline: true,
        },
        {
          name: '🏅 Badges & Titles',
          value: badgeDisplay,
          inline: false,
        }
      )
      .setFooter({ text: 'VC Arena • Player Profile' });

    await interaction.reply({ embeds: [embed] });
  },
};
