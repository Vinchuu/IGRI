import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { MatchService } from '../../services/MatchService.js';
import { LegDraft, PredictionService } from '../../services/PredictionService.js';
import { TeamGroupService } from '../../services/TeamGroupService.js';
import { MarketType } from '../../types/index.js';

export const predictCommand = {
  data: new SlashCommandBuilder()
    .setName('predict')
    .setDescription('Build and confirm a 2-to-5 match combo prediction ticket')
    .addIntegerOption((opt) =>
      opt.setName('stake')
        .setDescription('Virtual coins to stake (50 to 1,000 coins)')
        .setMinValue(50)
        .setMaxValue(1000)
        .setRequired(true)
    )
    // Leg 1
    .addIntegerOption((opt) => opt.setName('match1').setDescription('Match ID for Leg 1').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('market1')
        .setDescription('Market type for Leg 1')
        .setRequired(true)
        .addChoices(
          { name: '🥇 1st Place (Winner)', value: 'WINNER' },
          { name: '🥉 Top 3 Finish', value: 'TOP_3' },
          { name: '🎯 Top Fragger', value: 'TOP_FRAGGER' }
        )
    )
    .addStringOption((opt) => opt.setName('pick1').setDescription('Team or Player name for Leg 1').setRequired(true).setAutocomplete(true))
    // Leg 2
    .addIntegerOption((opt) => opt.setName('match2').setDescription('Match ID for Leg 2').setRequired(true))
    .addStringOption((opt) =>
      opt.setName('market2')
        .setDescription('Market type for Leg 2')
        .setRequired(true)
        .addChoices(
          { name: '🥇 1st Place (Winner)', value: 'WINNER' },
          { name: '🥉 Top 3 Finish', value: 'TOP_3' },
          { name: '🎯 Top Fragger', value: 'TOP_FRAGGER' }
        )
    )
    .addStringOption((opt) => opt.setName('pick2').setDescription('Team or Player name for Leg 2').setRequired(true).setAutocomplete(true))
    // Leg 3 (Optional)
    .addIntegerOption((opt) => opt.setName('match3').setDescription('Match ID for Leg 3 (Optional)').setRequired(false))
    .addStringOption((opt) =>
      opt.setName('market3')
        .setDescription('Market type for Leg 3')
        .setRequired(false)
        .addChoices(
          { name: '🥇 1st Place (Winner)', value: 'WINNER' },
          { name: '🥉 Top 3 Finish', value: 'TOP_3' },
          { name: '🎯 Top Fragger', value: 'TOP_FRAGGER' }
        )
    )
    .addStringOption((opt) => opt.setName('pick3').setDescription('Team or Player for Leg 3').setRequired(false).setAutocomplete(true))
    // Leg 4 (Optional)
    .addIntegerOption((opt) => opt.setName('match4').setDescription('Match ID for Leg 4 (Optional)').setRequired(false))
    .addStringOption((opt) =>
      opt.setName('market4')
        .setDescription('Market type for Leg 4')
        .setRequired(false)
        .addChoices(
          { name: '🥇 1st Place (Winner)', value: 'WINNER' },
          { name: '🥉 Top 3 Finish', value: 'TOP_3' },
          { name: '🎯 Top Fragger', value: 'TOP_FRAGGER' }
        )
    )
    .addStringOption((opt) => opt.setName('pick4').setDescription('Team or Player for Leg 4').setRequired(false).setAutocomplete(true))
    // Leg 5 (Optional)
    .addIntegerOption((opt) => opt.setName('match5').setDescription('Match ID for Leg 5 (Optional)').setRequired(false))
    .addStringOption((opt) =>
      opt.setName('market5')
        .setDescription('Market type for Leg 5')
        .setRequired(false)
        .addChoices(
          { name: '🥇 1st Place (Winner)', value: 'WINNER' },
          { name: '🥉 Top 3 Finish', value: 'TOP_3' },
          { name: '🎯 Top Fragger', value: 'TOP_FRAGGER' }
        )
    )
    .addStringOption((opt) => opt.setName('pick5').setDescription('Team or Player for Leg 5').setRequired(false).setAutocomplete(true)),

  async autocomplete(interaction: any): Promise<void> {
    const focused = interaction.options.getFocused(true);
    const query = focused.value.toLowerCase();
    const suggestions = TeamGroupService.searchTeams(query, 25);
    await interaction.respond(suggestions.map((name) => ({ name, value: name })));
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const stake = interaction.options.getInteger('stake', true);

    const legsDraft: LegDraft[] = [];

    // Helper to extract leg
    const addLegIfPresent = (legNum: number) => {
      const matchId = interaction.options.getInteger(`match${legNum}`);
      const market = interaction.options.getString(`market${legNum}`) as MarketType | null;
      const pick = interaction.options.getString(`pick${legNum}`);

      if (matchId && market && pick) {
        legsDraft.push({
          matchId,
          marketType: market,
          selectedTarget: pick.trim(),
        });
      }
    };

    addLegIfPresent(1);
    addLegIfPresent(2);
    addLegIfPresent(3);
    addLegIfPresent(4);
    addLegIfPresent(5);

    try {
      const ticket = PredictionService.submitTicket(
        interaction.user.id,
        interaction.user.username,
        stake,
        legsDraft
      );

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`🎟️ Ticket #${ticket.id} Confirmed!`)
        .setDescription(
          `**${interaction.user.username}** locked in a **${ticket.legs?.length}-leg combo**!\n` +
          `• **Staked:** \`${ticket.stake.toLocaleString()}\` coins\n` +
          `• **Combo Weight:** \`${ticket.combo_weight}x\`\n` +
          `• **Estimated Season Pool Multiplier:** \`${(ticket.combo_weight / ticket.stake).toFixed(2)}x\``
        );

      ticket.legs?.forEach((leg, idx) => {
        const match = MatchService.getMatchById(leg.match_id);
        const matchName = match ? `Match #${match.match_number} (${match.lobby_name})` : `Match #${leg.match_id}`;
        const marketLabel = leg.market_type === 'WINNER' ? '🥇 1st Place' : leg.market_type === 'TOP_3' ? '🥉 Top 3' : '🎯 Top Fragger';

        embed.addFields({
          name: `Leg ${idx + 1}: ${matchName}`,
          value: `🎯 **${leg.selected_target}** (${marketLabel})\n📊 Odds: \`${leg.locked_odds}x\``,
          inline: true,
        });
      });

      embed.setFooter({ text: 'Stakes are locked in the season prize pool • Good luck!' });

      const copyButton = new ButtonBuilder()
        .setCustomId(`copy_ticket_${ticket.id}`)
        .setLabel('Copy This Ticket')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📋');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(copyButton);

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (err: any) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('❌ Submission Failed')
        .setDescription(err.message || 'An error occurred while placing your combo ticket.')
        .setFooter({ text: 'Use /matches to see open lobbies, valid team names, and IDs.' });

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
