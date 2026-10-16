import {
  ActionRowBuilder,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { ShopService } from '../../services/ShopService.js';
import { UserService } from '../../services/UserService.js';

export const shopCommand = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse and purchase vanity Discord titles and profile badges with your virtual coins'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const user = UserService.getOrCreateUser(interaction.user.id, interaction.user.username);
    const items = ShopService.getItems();
    const inventory = UserService.getUserInventory(user.id);

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🛍️ iGRI Arena Vanity Boutique')
      .setDescription(
        `Welcome, **${user.username}**! You currently have **${user.balance.toLocaleString()} coins**.\n` +
          'Spend surplus coins on exclusive profile titles and flex badges!'
      );

    const selectOptions: StringSelectMenuOptionBuilder[] = [];

    for (const item of items) {
      const owned = inventory.includes(item.id);
      const statusText = owned ? '✅ OWNED' : `🪙 ${item.cost.toLocaleString()} coins`;

      embed.addFields({
        name: `${item.badge_emoji || '🏷️'} ${item.name} — [${statusText}]`,
        value: `${item.description}\n*Type: ${item.type}*`,
        inline: false,
      });

      if (!owned) {
        selectOptions.push(
          new StringSelectMenuOptionBuilder()
            .setLabel(`${item.name} (${item.cost.toLocaleString()} coins)`)
            .setDescription(item.description.slice(0, 50))
            .setValue(item.id)
            .setEmoji(item.badge_emoji || '🪙')
        );
      }
    }

    if (selectOptions.length > 0) {
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('shop_purchase_select')
        .setPlaceholder('Select an item to purchase...')
        .addOptions(selectOptions);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);

      await interaction.reply({ embeds: [embed], components: [row] });
    } else {
      embed.setFooter({ text: 'You already own everything in the shop! True legend.' });
      await interaction.reply({ embeds: [embed] });
    }
  },
};
