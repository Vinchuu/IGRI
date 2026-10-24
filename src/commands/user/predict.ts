import {
  ActionRowBuilder,
  AutocompleteInteraction,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { MatchService } from '../../services/MatchService.js';
import { LegDraft, PredictionService } from '../../services/PredictionService.js';
import { TeamGroupService } from '../../services/TeamGroupService.js';
import { formatTeamWithEmoji, SERVER_EMOJIS } from '../../utils/emojis.js';
import { MarketType } from '../../types/index.js';
import { UserUI } from '../../ui/UserUI.js';

export const predictCommand = {
  data: new SlashCommandBuilder()
    .setName('predict')
    .setDescription('Predict tournament positions (#1, 2-3, 3-5, 5-10, 11-16) for a combo ticket')
    .addIntegerOption((opt) =>
      opt.setName('stake')
        .setDescription('Virtual coins to stake (50 to 1,000 coins) — leave empty for interactive builder')
        .setMinValue(50)
        .setMaxValue(1000)
        .setRequired(false)
    )
    .addStringOption((opt) =>
      opt.setName('match')
        .setDescription('Select match lobby (auto-selects if only 1 match is open)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('pos_1')
        .setDescription('🥇 #1 Winner (Champion)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('pos_2_3')
        .setDescription('🥈 #2 - #3 (Podium finish)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('pos_3_5')
        .setDescription('🎖️ #3 - #5 (Top 5 finish)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('pos_5_10')
        .setDescription('🎯 #5 - #10 (Top 10 finish)')
        .setRequired(false)
        .setAutocomplete(true)
    )
    .addStringOption((opt) =>
      opt.setName('pos_11_16')
        .setDescription('💀 #11 - #16 (Placement finish)')
        .setRequired(false)
        .setAutocomplete(true)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);

    if (focused.name === 'match') {
      const openMatches = MatchService.getOpenMatches();
      const suggestions = openMatches
        .filter((m) => m.lobby_name.toLowerCase().includes(focused.value.toLowerCase()))
        .slice(0, 25)
        .map((m) => ({
          name: `Match #${m.match_number}: ${m.lobby_name}`,
          value: String(m.id),
        }));
      await interaction.respond(suggestions);
      return;
    }

    // Otherwise autocompleting team names
    const query = focused.value.toLowerCase();
    const suggestions = TeamGroupService.searchTeams(query, 25);
    await interaction.respond(suggestions.map((name) => ({ name, value: name })));
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    const rawStake = interaction.options.getInteger('stake');
    const matchParam = interaction.options.getString('match');

    // 1. Resolve match without requiring manual ID typing
    const openMatches = MatchService.getOpenMatches();
    let targetMatchId: number | null = null;

    if (matchParam) {
      targetMatchId = parseInt(matchParam, 10);
      if (isNaN(targetMatchId)) {
        // Find match by name
        const found = openMatches.find((m) => m.lobby_name.toLowerCase() === matchParam.toLowerCase());
        if (found) targetMatchId = found.id;
      }
    } else {
      // Auto-default if 1 match open
      if (openMatches.length === 1) {
        targetMatchId = openMatches[0].id;
      } else if (openMatches.length === 0) {
        await interaction.reply({
          content: '❌ There are currently no open matches available for prediction. Check back soon!',
          ephemeral: true,
        });
        return;
      } else {
        // If multiple matches and no pick specified, offer buttons
        if (!rawStake) {
          const rows: ActionRowBuilder<ButtonBuilder>[] = [];
          const actionRow = new ActionRowBuilder<ButtonBuilder>();
          for (const m of openMatches.slice(0, 4)) {
            actionRow.addComponents(
              new ButtonBuilder()
                .setCustomId(`btn_predict_match_${m.id}`)
                .setLabel(`Predict Match #${m.match_number}`)
                .setStyle(ButtonStyle.Success)
                .setEmoji('🎯')
            );
          }
          rows.push(actionRow);
          await interaction.reply({
            content: '⚠️ Multiple tournament lobbies are open! Click below to select which match you want to predict:',
            components: rows,
            ephemeral: true,
          });
          return;
        }

        await interaction.reply({
          content: `⚠️ Multiple matches are open! Please pick one using the \`match\` option:\n${openMatches.map((m) => `• Match #${m.match_number}: **${m.lobby_name}**`).join('\n')}`,
          ephemeral: true,
        });
        return;
      }
    }

    const match = MatchService.getMatchById(targetMatchId!);
    if (!match) {
      await interaction.reply({ content: '❌ Selected match was not found or has expired.', ephemeral: true });
      return;
    }

    // 2. Gather bracket picks
    const brackets: { type: MarketType; label: string; pick: string | null }[] = [
      { type: 'POS_1', label: '🥇 #1 (Winner)', pick: interaction.options.getString('pos_1') },
      { type: 'POS_2_3', label: '🥈 #2 - #3', pick: interaction.options.getString('pos_2_3') },
      { type: 'POS_3_5', label: '🎖️ #3 - #5', pick: interaction.options.getString('pos_3_5') },
      { type: 'POS_5_10', label: '🎯 #5 - #10', pick: interaction.options.getString('pos_5_10') },
      { type: 'POS_11_16', label: '💀 #11 - #16', pick: interaction.options.getString('pos_11_16') },
    ];

    const activePicks = brackets.filter((b) => b.pick && b.pick.trim().length > 0);

    // If no stake or no picks passed, launch the interactive slip builder!
    if (!rawStake || activePicks.length === 0) {
      const builderUI = UserUI.buildSlipBuilder(match, undefined, undefined, rawStake || 200);
      await interaction.reply({ embeds: [builderUI.embed], components: builderUI.rows, ephemeral: true });
      return;
    }

    const stake = rawStake;

    if (activePicks.length < 1) {
      const builderUI = UserUI.buildSlipBuilder(match, undefined, undefined, rawStake || 200);
      await interaction.reply({ embeds: [builderUI.embed], components: builderUI.rows, ephemeral: true });
      return;
    }

    // 3. Rule: "one team cannot be repeated"
    const chosenTeams = activePicks.map((p) => p.pick!.trim().toLowerCase());
    const uniqueTeams = new Set(chosenTeams);
    if (uniqueTeams.size !== chosenTeams.length) {
      await interaction.reply({
        content: '❌ **Rule Violation:** One team cannot be repeated in the same ticket! Each bracket must have a distinct team.',
        ephemeral: true,
      });
      return;
    }

    const legsDraft: LegDraft[] = activePicks.map((p) => ({
      matchId: match.id,
      marketType: p.type,
      selectedTarget: p.pick!.trim(),
    }));

    try {
      const ticket = PredictionService.submitTicket(
        interaction.user.id,
        interaction.user.username,
        stake,
        legsDraft
      );

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} Combo Slip #${ticket.id} Confirmed`)
        .setDescription(
          `Your prediction on **${match.lobby_name}** has been locked in!`
        )
        .addFields(
          { name: '🪙 Stake', value: `\`${ticket.stake.toLocaleString()}\` coins`, inline: true },
          { name: '⚡ Multiplier', value: `\`${(ticket.combo_weight / ticket.stake).toFixed(2)}x\``, inline: true },
          { name: '🏟️ Lobby', value: `**${match.lobby_name}**`, inline: true }
        );

      ticket.legs?.forEach((leg, idx) => {
        const bracketObj = brackets.find((b) => b.type === leg.market_type);
        const bracketLabel = bracketObj ? bracketObj.label : leg.market_type;
        const teamFormatted = formatTeamWithEmoji(leg.selected_target, interaction.guild || undefined);

        embed.addFields({
          name: `Leg ${idx + 1} • ${bracketLabel}`,
          value: `${teamFormatted}\nOdds: \`${leg.locked_odds}x\``,
          inline: true,
        });
      });

      embed.setFooter({ text: 'VC Arena • Track live in /tickets' });

      const copyButton = new ButtonBuilder()
        .setCustomId(`copy_ticket_${ticket.id}`)
        .setLabel('Clone Slip')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📋');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(copyButton);

      await interaction.reply({ embeds: [embed], components: [row] });
    } catch (err: any) {
      const errorEmbed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('❌ Submission Failed')
        .setDescription(err.message || 'An error occurred while placing your combo ticket.')
        .setFooter({ text: 'Check available teams using autocomplete.' });

      await interaction.reply({ embeds: [errorEmbed], ephemeral: true });
    }
  },
};
