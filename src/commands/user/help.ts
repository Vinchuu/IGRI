import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';

export const helpCommand = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Learn how to play iGRI Fantasy Arena, game rules, combo slips, and commands'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const embed = new EmbedBuilder()
      .setColor('#00E676')
      .setTitle('🎮 iGRI Fantasy Arena — Official Player Guide')
      .setDescription(
        '**Welcome to the ultimate FiveM Esports Prediction Arena!**\n' +
        'Compete against other server members by predicting tournament results, building multi-match combo tickets, and climbing the leaderboard for seasonal glory.\n\n' +
        '🪙 **Starting Balance:** Every new player receives **10,000 Virtual Coins** upon joining!\n' +
        '*(Coins are strictly virtual and hold no real-world monetary value)*'
      )
      .addFields(
        {
          name: '🎯 1. How Prediction Markets Work',
          value:
            '• **🥇 1st Place (Winner):** Predict which crew takes #1 (WWCD) in the lobby.\n' +
            '• **🥉 Top 3 Finish:** Predict a crew to finish on the podium (1st, 2nd, or 3rd).\n' +
            '• **🔥 Top Fragger:** Predict the player or squad with the most kills in the match.',
          inline: false,
        },
        {
          name: '🎟️ 2. Combo Slips & Multipliers',
          value:
            '• Each ticket must combine **2 to 5 distinct matches**.\n' +
            '• Stake between **50 and 1,000 coins** per ticket (max 3,000 open stakes at once).\n' +
            '• Payouts use **closing combo weights**: every hit multiplies your potential share of the season prize pool!',
          inline: false,
        },
        {
          name: '🛡️ 3. The Void Leg (Push) Protection',
          value:
            'If a FiveM match crashes, cancels, or reschedules, **your entire ticket does NOT fail!**\n' +
            'That specific leg’s odds automatically downgrade to `1.0x` (Push), preserving the rest of your winning combo.',
          inline: false,
        },
        {
          name: '🎁 4. Daily Rewards & Economy',
          value:
            '• Claim your **Daily Mystery Box** every 24 hours with `/daily`.\n' +
            '• Win up to **2,500 coins** + daily streak multipliers (up to +35% bonus)!\n' +
            '• Spend surplus coins in the `/shop` on custom titles and server badges.',
          inline: false,
        }
      )
      .setFooter({ text: 'Click the buttons below to explore full command lists & guides!' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('help_player_cmds').setLabel('Player Commands').setStyle(ButtonStyle.Primary).setEmoji('🎮'),
      new ButtonBuilder().setCustomId('help_fanbase_guide').setLabel('Crew Allegiance').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
      new ButtonBuilder().setCustomId('help_admin_guide').setLabel('Admin Guide').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    );

    await interaction.reply({ embeds: [embed], components: [row] });
  },
};
