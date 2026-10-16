import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { LedgerService } from '../../services/LedgerService.js';
import { UserService } from '../../services/UserService.js';

export const balanceCommand = {
  data: new SlashCommandBuilder()
    .setName('balance')
    .setDescription('Check your virtual coin balance, reserved stakes, and recent transaction history'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = UserService.getOrCreateUser(interaction.user.id, interaction.user.username);
    const history = LedgerService.getUserHistory(user.id, 5);

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle(`💳 ${user.username}'s Arena Wallet`)
      .setDescription(`Equipped Title: **${user.equipped_title}**`)
      .addFields(
        {
          name: '🪙 Available Balance',
          value: `**${user.balance.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '🔒 Reserved on Tickets',
          value: `**${user.reserved_stake.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '💼 Total Net Worth',
          value: `**${(user.balance + user.reserved_stake).toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '📈 Lifetime Net Profit',
          value: `${user.lifetime_profit >= 0 ? '+' : ''}${user.lifetime_profit.toLocaleString()} coins`,
          inline: true,
        },
        {
          name: '🎯 Accuracy',
          value: user.resolved_selections > 0 
            ? `${((user.correct_selections / user.resolved_selections) * 100).toFixed(1)}% (${user.correct_selections}/${user.resolved_selections})`
            : 'No picks resolved yet',
          inline: true,
        },
        {
          name: '🏆 Biggest Combo Payout',
          value: `${user.biggest_win_payout.toLocaleString()} coins`,
          inline: true,
        }
      );

    if (history.length > 0) {
      const historyText = history
        .map((h) => {
          const sign = h.amount > 0 ? '+' : '';
          const time = `<t:${Math.floor(h.created_at / 1000)}:R>`;
          return `• \`${sign}${h.amount.toLocaleString()}\` coins — **${h.type}** (${time})\n  *${h.notes || 'No description'}*`;
        })
        .join('\n');

      embed.addFields({ name: '📜 Recent Transactions', value: historyText });
    }

    embed.setFooter({ text: 'iGRI Fantasy Arena • Strictly Virtual Currency' });

    await interaction.reply({ embeds: [embed] });
  },
};
