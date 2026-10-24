import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { PredictionService } from '../../services/PredictionService.js';
import { MatchService } from '../../services/MatchService.js';
import { SERVER_EMOJIS, formatTeamWithEmoji } from '../../utils/emojis.js';

export const myTicketsCommand = {
  data: new SlashCommandBuilder()
    .setName('mytickets')
    .setDescription('View your active and recently settled combo tickets and leg progress'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const tickets = PredictionService.getUserTickets(interaction.user.id, 5);

    if (tickets.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} YOUR PREDICTION SLIPS`)
        .setDescription(
          `You have not locked in any prediction slips yet!\n` +
          `Use \`/predict\` or click the button below to build your first slip.`
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('user_ui_predict').setLabel('Predict Open Match').setStyle(ButtonStyle.Success).setEmoji('🎯'),
        new ButtonBuilder().setCustomId('user_ui_home').setLabel('Terminal').setStyle(ButtonStyle.Secondary).setEmoji('🏠')
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      return;
    }

    const embeds: EmbedBuilder[] = [];

    for (const ticket of tickets) {
      let statusColor = '#3498DB';
      let statusText = '⏳ IN PROGRESS';

      if (ticket.status === 'WON') {
        statusColor = '#2ECC71';
        statusText = `🎉 WON! Payout: +${ticket.payout.toLocaleString()} coins 🪙`;
      } else if (ticket.status === 'LOST') {
        statusColor = '#E74C3C';
        statusText = '❌ ELIMINATED';
      } else if (ticket.status === 'REFUNDED') {
        statusColor = '#E67E22';
        statusText = '↩️ VOID / REFUNDED';
      }

      const oddsDisplay = (ticket.combo_weight / ticket.stake).toFixed(2);
      const isSingle = !ticket.legs || ticket.legs.length === 1;

      const embed = new EmbedBuilder()
        .setColor(statusColor as any)
        .setTitle(`🎫 Slip #${ticket.id} • ${statusText}`)
        .setDescription(
          `**Type:** ${isSingle ? 'Single Bet' : `${ticket.legs?.length}-Leg Combo`} • **Stake:** \`${ticket.stake.toLocaleString()}\` coins • **Odds:** \`${oddsDisplay}x\` • <t:${Math.floor(ticket.created_at / 1000)}:R>`
        );

      if (ticket.legs && ticket.legs.length > 0) {
        const legRows = ticket.legs.map((leg) => {
          const match = MatchService.getMatchById(leg.match_id);
          const matchTitle = match ? `Match #${match.match_number}` : `#${leg.match_id}`;

          let emoji = '⏳';
          if (leg.status === 'WON') emoji = '✅';
          else if (leg.status === 'LOST') emoji = '❌';
          else if (leg.status === 'VOID') emoji = '🚫';

          let marketPretty = leg.market_type as string;
          if (leg.market_type === 'POS_1' || (leg.market_type as any) === 'WINNER') marketPretty = '🥇 Winner';
          else if (leg.market_type === 'POS_2_3') marketPretty = '🥈 #2-3';
          else if (leg.market_type === 'POS_3_5') marketPretty = '🥉 #3-5';
          else if (leg.market_type === 'POS_5_10' || leg.market_type === 'POS_6_10') marketPretty = '🎯 #5-10';
          else if (leg.market_type === 'POS_11_16') marketPretty = '💀 #11-16';

          const teamFormatted = formatTeamWithEmoji(leg.selected_target, interaction.guild || undefined);

          return `• ${emoji} **${marketPretty}:** ${teamFormatted} (\`${leg.locked_odds}x\`) • *${matchTitle}*`;
        });

        embed.addFields({ name: '📋 Selections', value: legRows.join('\n') });
      }

      embeds.push(embed);
    }

    const latest = tickets[0];
    const shareButton = new ButtonBuilder()
      .setCustomId(`share_ticket_${latest.id}`)
      .setLabel(`Flex Ticket #${latest.id}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📢');

    const homeButton = new ButtonBuilder()
      .setCustomId('user_ui_home')
      .setLabel('Terminal')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏠');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(shareButton, homeButton);

    await interaction.reply({ embeds: embeds.slice(0, 3), components: [row] });
  },
};
