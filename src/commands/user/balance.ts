import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { LedgerService } from '../../services/LedgerService.js';
import { UserService } from '../../services/UserService.js';
import { SERVER_EMOJIS } from '../../utils/emojis.js';

export const balanceCommand = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your virtual coin balance, reserved stakes, and recent transaction history'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = UserService.getOrCreateUser(interaction.user.id, interaction.user.username);
    const history = LedgerService.getUserHistory(user.id, 5);

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Wallet & Stats`)
      .setDescription(
        `**${user.username}** • Title: \`${user.equipped_title}\` • Streak: **${user.daily_streak}d** 🔥`
      )
      .addFields(
        {
          name: '🪙 Balance',
          value: `**${user.balance.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '🔒 In Play',
          value: `**${user.reserved_stake.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '💼 Net Worth',
          value: `**${(user.balance + user.reserved_stake).toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '📈 Net Profit',
          value: `**${user.lifetime_profit >= 0 ? '+' : ''}${user.lifetime_profit.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '🎯 Accuracy',
          value: user.resolved_selections > 0 
            ? `**${((user.correct_selections / user.resolved_selections) * 100).toFixed(1)}%** (${user.correct_selections}/${user.resolved_selections})`
            : '*No picks yet*',
          inline: true,
        },
        {
          name: '🏆 Top Win',
          value: `**${user.biggest_win_payout.toLocaleString()}** coins`,
          inline: true,
        }
      );

    if (history.length > 0) {
      const typeIcons: Record<string, string> = {
        STARTING_GRANT: '🎁 Welcome Bonus',
        DAILY_REWARD: '📦 Daily Crate',
        TICKET_STAKE: '🎟️ Slip Placed',
        TICKET_PAYOUT: '🎉 Slip Won',
        TICKET_REFUND: '↩️ Void Leg / Refund',
        ADMIN_ADJUSTMENT: '👑 Admin Grant',
        SHOP_PURCHASE: '🛍️ Shop Item',
      };

      const historyText = history
        .map((h) => {
          const sign = h.amount > 0 ? '+' : '';
          const time = `<t:${Math.floor(h.created_at / 1000)}:R>`;
          const label = typeIcons[h.type] || h.type;
          return `• **${label}**: \`${sign}${h.amount.toLocaleString()}\` coins • ${time}`;
        })
        .join('\n');

      embed.addFields({
        name: '📜 Recent Transactions',
        value: historyText,
        inline: false,
      });
    }

    embed.setFooter({ text: 'VC Arena • Virtual Currency • Zero real-money value' });

    await interaction.reply({ embeds: [embed] });
  },
};
