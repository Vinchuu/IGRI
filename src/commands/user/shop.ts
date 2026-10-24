import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { UserUI } from '../../ui/UserUI.js';

export const shopCommand = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and purchase vanity Discord titles and profile badges with your virtual coins'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const shopUI = UserUI.buildShopUI(interaction.user.id, interaction.user.username);
    await interaction.reply({ embeds: [shopUI.embed], components: shopUI.rows });
  },
};
