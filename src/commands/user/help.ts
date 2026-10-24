import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { SERVER_EMOJIS } from '../../utils/emojis.js';

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Learn how to play iGRI Fantasy Arena, game rules, combo slips, and commands'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • How to Play`)
      .setDescription(
        `Predict tournament match results, build slips, and climb the leaderboard!\n` +
        `All players receive **10,000 virtual coins** to start.`
      )
      .addFields(
        {
          name: '🎯 1. Position Markets',
          value:
            '• **🥇 #1 Winner:** Match champion (highest multiplier)\n' +
            '• **🥈 #2 - #3:** Finishes in top 2 or 3\n' +
            '• **🥉 #3 - #5:** Finishes between 3rd and 5th\n' +
            '• **🎯 #5 - #10:** Finishes in top 10\n' +
            '• **💀 #11 - #16:** Finishes in 11th to 16th',
          inline: false,
        },
        {
          name: '🎟️ 2. Prediction Modes',
          value:
            '• **🎯 Single Bets:** Place separate stakes per bracket (e.g. 1k on #1, 500 on #2). Each position wins independently!\n' +
            '• **🔥 Combo Parlay:** Combine 2-5 positions for multiplied odds.\n' +
            '• **Stakes:** 100 to 1,000 coins (or enter any custom amount).',
          inline: false,
        },
        {
          name: '🛡️ 3. Push Protection',
          value:
            'If a match lobby cancels or reschedules, that leg automatically pushes at `1.0x` odds so the rest of your combo remains safe.',
          inline: false,
        },
        {
          name: '🎁 4. Daily Crates & Shop',
          value:
            '• Claim your free **Daily Crate** every 24 hours (`/daily` or `!daily`).\n' +
            '• Unlock server titles, badges, and roles in the `/shop`.',
          inline: false,
        }
      )
      .setFooter({ text: 'VC Arena • Virtual Currency • Zero typing required' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('user_ui_home').setLabel('Hub').setStyle(ButtonStyle.Success).setEmoji('🏠'),
      new ButtonBuilder().setCustomId('help_player_cmds').setLabel('Commands').setStyle(ButtonStyle.Primary).setEmoji('🎮'),
      new ButtonBuilder().setCustomId('help_fanbase_guide').setLabel('Allegiance').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
      new ButtonBuilder().setCustomId('help_admin_guide').setLabel('Admin Guide').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
