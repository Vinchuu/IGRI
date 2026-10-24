import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { UserUI } from '../../ui/UserUI.js';

export const igriCommand = {
  data: new SlashCommandBuilder()
    .setName('igri')
    .setDescription('Open the iGRI Fantasy Arena central interactive terminal'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const hub = UserUI.buildPlayerHub(interaction.user.id, interaction.user.username);
    await interaction.reply({ embeds: [hub.embed], components: hub.rows });
  },
};
