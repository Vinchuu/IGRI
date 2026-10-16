import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { MysteryBoxService } from '../../services/MysteryBoxService.js';

export const dailyCommand = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Open your 24-hour Daily Mystery Box for bonus virtual coins and streak perks!'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const reward = MysteryBoxService.openBox(interaction.user.id, interaction.user.username);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`${reward.tierEmoji} Mystery Box Opened!`)
        .setDescription(`You cracked open a **${reward.tierName}**!`)
        .addFields(
          {
            name: '🎁 Base Loot',
            value: `+**${reward.baseAmount.toLocaleString()}** coins`,
            inline: true,
          },
          {
            name: `🔥 Day ${reward.streakDays} Streak Bonus`,
            value: `+**${reward.streakBonus.toLocaleString()}** coins`,
            inline: true,
          },
          {
            name: '💰 Total Claimed',
            value: `🎉 **+${reward.totalCoins.toLocaleString()}** coins!`,
            inline: false,
          },
          {
            name: '⏰ Next Claim In',
            value: `<t:${Math.floor(reward.nextClaimTime / 1000)}:R>`,
            inline: true,
          }
        )
        .setFooter({ text: 'Keep your daily streak going for up to +35% bonus coins!' });

      await interaction.reply({ embeds: [embed] });
    } catch (err: any) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('⏳ Mystery Box On Cooldown')
        .setDescription(err.message || 'Please wait before opening another box.')
        .setFooter({ text: 'Daily boxes refresh every 24 hours.' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
