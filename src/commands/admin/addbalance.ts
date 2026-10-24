import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { AdminRoleService } from '../../services/AdminRoleService.js';
import { UserService } from '../../services/UserService.js';
import { SERVER_EMOJIS } from '../../utils/emojis.js';

export const addBalanceCommand = {
  data: new SlashCommandBuilder()
    .setName('addbalance')
    .setDescription('Add virtual coins to a player account (Admin only)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('user').setDescription('Player to receive coins').setRequired(true))
    .addIntegerOption((opt) => opt.setName('amount').setDescription('Amount of coins to add').setRequired(true).setMinValue(1))
    .addStringOption((opt) => opt.setName('reason').setDescription('Reason for granting coins (optional)').setRequired(false)),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    if (!AdminRoleService.isUserAdmin(interaction.member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason') || 'Admin grant';

    try {
      const result = UserService.addBalance(
        targetUser.id,
        targetUser.username,
        amount,
        interaction.user.id,
        reason
      );

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} Balance Updated`)
        .setDescription(`Successfully credited **+${amount.toLocaleString()} coins** to <@${targetUser.id}>.`)
        .addFields(
          { name: '👤 Recipient', value: `${targetUser.username}`, inline: true },
          { name: '🪙 Previous', value: `\`${result.oldBalance.toLocaleString()}\` coins`, inline: true },
          { name: '💰 New Balance', value: `\`${result.newBalance.toLocaleString()}\` coins`, inline: true },
          { name: '📝 Reason', value: reason, inline: true },
          { name: '👑 Admin', value: `<@${interaction.user.id}>`, inline: true }
        )
        .setFooter({ text: 'VC Arena • Balance Management' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Failed to add balance: ${err.message}`, ephemeral: true });
    }
  },
};
