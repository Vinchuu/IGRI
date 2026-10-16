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

export const myTicketsCommand = {
  data: new SlashCommandBuilder()
    .setName('mytickets')
    .setDescription('View your active and recently settled combo tickets and leg progress'),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const tickets = PredictionService.getUserTickets(interaction.user.id, 5);

    if (tickets.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle('🎫 Your Prediction Slips')
        .setDescription('You have not submitted any prediction tickets yet! Use `/predict` to build your first combo slip.');

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const embeds: EmbedBuilder[] = [];
    const components: ActionRowBuilder<ButtonBuilder>[] = [];

    for (const ticket of tickets) {
      let statusColor = '#3498DB';
      let statusText = '⏳ ACTIVE (In Progress)';

      if (ticket.status === 'WON') {
        statusColor = '#2ECC71';
        statusText = `🎉 WON! Paid: +${ticket.payout.toLocaleString()} coins`;
      } else if (ticket.status === 'LOST') {
        statusColor = '#E74C3C';
        statusText = '❌ ELIMINATED';
      } else if (ticket.status === 'REFUNDED') {
        statusColor = '#E67E22';
        statusText = '↩️ REFUNDED';
      }

      const embed = new EmbedBuilder()
        .setColor(statusColor as any)
        .setTitle(`🎫 Ticket #${ticket.id} — ${statusText}`)
        .setDescription(
          `• **Stake:** \`${ticket.stake.toLocaleString()}\` coins\n` +
          `• **Combo Weight:** \`${ticket.combo_weight}x\`\n` +
          `• **Submitted:** <t:${Math.floor(ticket.created_at / 1000)}:R>`
        );

      if (ticket.legs && ticket.legs.length > 0) {
        const legRows = ticket.legs.map((leg, index) => {
          const match = MatchService.getMatchById(leg.match_id);
          const matchTitle = match ? `Match #${match.match_number} (${match.lobby_name})` : `Match #${leg.match_id}`;

          let emoji = '⏳';
          if (leg.status === 'WON') emoji = '✅';
          else if (leg.status === 'LOST') emoji = '❌';
          else if (leg.status === 'VOID') emoji = '🚫';

          const marketPretty = leg.market_type === 'WINNER' ? '1st Place' : leg.market_type === 'TOP_3' ? 'Top 3 Podium' : 'Top Fragger';

          return `${emoji} **Leg ${index + 1}:** ${matchTitle}\n   🎯 Pick: **${leg.selected_target}** (${marketPretty}) • Odds: \`${leg.locked_odds}x\` [Status: \`${leg.status}\`]`;
        });

        embed.addFields({ name: 'Selections', value: legRows.join('\n\n') });
      }

      embeds.push(embed);
    }

    // Add a Share Ticket button for their most recent active ticket
    const latest = tickets[0];
    const shareButton = new ButtonBuilder()
      .setCustomId(`share_ticket_${latest.id}`)
      .setLabel(`Flex Ticket #${latest.id}`)
      .setStyle(ButtonStyle.Primary)
      .setEmoji('📢');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(shareButton);

    await interaction.reply({ embeds: embeds.slice(0, 3), components: [row] });
  },
};
