import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { MysteryBoxService } from '../../services/MysteryBoxService.js';
import { SERVER_EMOJIS } from '../../utils/emojis.js';

export const dailyCommand = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Open your 24-hour Daily Mystery Box for bonus virtual coins and streak perks!'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    try {
      const reward = MysteryBoxService.openBox(interaction.user.id, interaction.user.username);

      let boxColor = '#2ECC71';
      if (reward.tierName.includes('Jackpot') || reward.tierName.includes('LEGENDARY')) boxColor = '#F1C40F';
      else if (reward.tierName.includes('Epic') || reward.tierName.includes('Titan')) boxColor = '#9B59B6';
      else if (reward.tierName.includes('Rare')) boxColor = '#3498DB';

      const streakStars = '🔥'.repeat(Math.min(reward.streakDays, 7));

      const embed = new EmbedBuilder()
        .setColor(boxColor as any)
        .setTitle(`${reward.tierEmoji} Daily Mystery Crate Unboxed`)
        .setDescription(
          `**${interaction.user.username}** opened a **${reward.tierName}**!`
        )
        .addFields(
          {
            name: '🎁 Base Loot',
            value: `+**${reward.baseAmount.toLocaleString()}** coins`,
            inline: true,
          },
          {
            name: `🔥 Day ${reward.streakDays} Streak`,
            value: `+**${reward.streakBonus.toLocaleString()}** coins`,
            inline: true,
          },
          {
            name: '💰 Total Claimed',
            value: `**+${reward.totalCoins.toLocaleString()}** coins`,
            inline: true,
          },
          {
            name: '⏳ Next Crate',
            value: `<t:${Math.floor(reward.nextClaimTime / 1000)}:R>`,
            inline: true,
          }
        )
        .setFooter({ text: 'VC Arena • Daily crates reset every 24h' });

      await interaction.reply({ embeds: [embed] });
    } catch (err: any) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('⏳ Mystery Crate On Cooldown')
        .setDescription(
          `${err.message || 'Please wait before opening another box.'}\n\n` +
          `💡 *Tip: Daily crates reset exactly 24 hours after your last claim!*`
        )
        .setFooter({ text: 'iGRI Fantasy Arena Supply Drops' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
};
