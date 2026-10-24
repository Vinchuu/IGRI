import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ButtonInteraction,
  EmbedBuilder,
  RoleSelectMenuBuilder,
  RoleSelectMenuInteraction,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  StringSelectMenuInteraction,
  ModalBuilder,
  ModalSubmitInteraction,
  TextInputBuilder,
  TextInputStyle,
  UserSelectMenuBuilder,
  UserSelectMenuInteraction,
} from 'discord.js';
import { PredictionService } from '../services/PredictionService.js';
import { ShopService } from '../services/ShopService.js';
import { UserService } from '../services/UserService.js';
import { MatchService } from '../services/MatchService.js';
import { MysteryBoxService } from '../services/MysteryBoxService.js';
import { LeaderboardService } from '../services/LeaderboardService.js';
import { AdminRoleService } from '../services/AdminRoleService.js';
import { FanService } from '../services/FanService.js';
import { TeamGroupService } from '../services/TeamGroupService.js';
import { SettlementService } from '../services/SettlementService.js';
import { NotificationService } from '../services/NotificationService.js';
import { AdminUI } from '../ui/AdminUI.js';
import { UserUI, UserSlipState, SlipPick, BRACKET_DEFS } from '../ui/UserUI.js';
import { MarketType } from '../types/index.js';
import { formatTeamWithEmoji, SERVER_EMOJIS } from '../utils/emojis.js';
import { LedgerService } from '../services/LedgerService.js';

// In-memory drafts for interactive result declaration and prediction slips
const adminResultDrafts: Record<string, { winner?: string; second?: string; third?: string; photoUrl?: string }> = {};
const userSlipDrafts: Record<string, UserSlipState> = {};

function getOrCreateUserSlipDraft(userId: string, matchId: number): UserSlipState {
  if (!userSlipDrafts[userId] || userSlipDrafts[userId].matchId !== matchId) {
    userSlipDrafts[userId] = {
      matchId,
      currentBracket: 'POS_1',
      currentStake: 500,
      mode: 'SINGLE',
      comboStake: 500,
      picks: {},
    };
  }
  return userSlipDrafts[userId];
}

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const { customId, user, member, guild } = interaction;

  // ==========================================
  // USER TERMINAL & INTERACTIVE SLIP BUILDER
  // ==========================================

  if (customId === 'user_ui_home') {
    const hub = UserUI.buildPlayerHub(user.id, user.username);
    await interaction.update({ embeds: [hub.embed], components: hub.rows });
    return;
  }

  if (customId === 'user_ui_open_shop') {
    const shopUI = UserUI.buildShopUI(user.id, user.username);
    await interaction.update({ embeds: [shopUI.embed], components: shopUI.rows });
    return;
  }

  if (customId === 'user_ui_predict' || customId.startsWith('btn_predict_match_')) {
    let matchId: number | null = null;
    if (customId.startsWith('btn_predict_match_')) {
      matchId = parseInt(customId.replace('btn_predict_match_', ''), 10);
    }

    const openMatches = MatchService.getOpenMatches();
    if (openMatches.length === 0) {
      await interaction.reply({
        content: '❌ **No Open Matches:** All current tournament matches are locked or settled. Check back soon for the next lobby!',
        ephemeral: true,
      });
      return;
    }

    const targetMatch = matchId ? openMatches.find((m) => m.id === matchId) || openMatches[0] : openMatches[0];
    const draft = getOrCreateUserSlipDraft(user.id, targetMatch.id);

    const builderUI = UserUI.buildSlipBuilder(targetMatch, draft);
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp({ embeds: [builderUI.embed], components: builderUI.rows, ephemeral: true });
    } else {
      await interaction.reply({ embeds: [builderUI.embed], components: builderUI.rows, ephemeral: true });
    }
    return;
  }

  if (customId.startsWith('user_slip_stake:')) {
    const parts = customId.split(':');
    const matchId = parseInt(parts[1], 10);
    const newStake = parseInt(parts[2], 10);
    const draft = getOrCreateUserSlipDraft(user.id, matchId);

    draft.currentStake = newStake;
    if (draft.picks[draft.currentBracket]) {
      draft.picks[draft.currentBracket]!.stake = newStake;
    }
    if (draft.mode === 'COMBO') {
      draft.comboStake = newStake;
    }

    const match = MatchService.getMatchById(matchId);
    if (!match) {
      await interaction.reply({ content: 'Match not found.', ephemeral: true });
      return;
    }

    const builderUI = UserUI.buildSlipBuilder(match, draft);
    await interaction.update({ embeds: [builderUI.embed], components: builderUI.rows });
    return;
  }

  if (customId.startsWith('user_slip_custom_stake:')) {
    const matchId = parseInt(customId.replace('user_slip_custom_stake:', ''), 10);
    const draft = getOrCreateUserSlipDraft(user.id, matchId);
    const bDef = BRACKET_DEFS.find((b) => b.type === draft.currentBracket) || BRACKET_DEFS[0];

    const modal = new ModalBuilder()
      .setCustomId(`modal_slip_custom_stake:${matchId}`)
      .setTitle(`Stake: ${bDef.label}`.slice(0, 45));

    const stakeInput = new TextInputBuilder()
      .setCustomId('custom_stake_input')
      .setLabel(`Coins for ${bDef.label}`.slice(0, 45))
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter coin amount (e.g. 500, 1000, 2500)')
      .setValue(String(draft.picks[draft.currentBracket]?.stake || draft.currentStake || 500))
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(8);

    const row = new ActionRowBuilder<TextInputBuilder>().addComponents(stakeInput);
    modal.addComponents(row);

    await interaction.showModal(modal);
    return;
  }

  if (customId.startsWith('user_slip_set_pick:')) {
    const matchId = parseInt(customId.replace('user_slip_set_pick:', ''), 10);
    const draft = getOrCreateUserSlipDraft(user.id, matchId);

    if (draft.picks[draft.currentBracket]) {
      draft.picks[draft.currentBracket]!.stake = draft.currentStake;
    }

    const match = MatchService.getMatchById(matchId);
    if (!match) {
      await interaction.reply({ content: 'Match not found.', ephemeral: true });
      return;
    }

    const builderUI = UserUI.buildSlipBuilder(match, draft);
    await interaction.update({ embeds: [builderUI.embed], components: builderUI.rows });
    return;
  }

  if (customId.startsWith('user_slip_toggle_mode:')) {
    const matchId = parseInt(customId.replace('user_slip_toggle_mode:', ''), 10);
    const draft = getOrCreateUserSlipDraft(user.id, matchId);

    draft.mode = draft.mode === 'SINGLE' ? 'COMBO' : 'SINGLE';

    const match = MatchService.getMatchById(matchId);
    if (!match) {
      await interaction.reply({ content: 'Match not found.', ephemeral: true });
      return;
    }

    const builderUI = UserUI.buildSlipBuilder(match, draft);
    await interaction.update({ embeds: [builderUI.embed], components: builderUI.rows });
    return;
  }

  if (customId.startsWith('user_slip_remove_bracket:')) {
    const matchId = parseInt(customId.replace('user_slip_remove_bracket:', ''), 10);
    const draft = getOrCreateUserSlipDraft(user.id, matchId);

    delete draft.picks[draft.currentBracket];

    const match = MatchService.getMatchById(matchId);
    if (!match) {
      await interaction.reply({ content: 'Match not found.', ephemeral: true });
      return;
    }

    const builderUI = UserUI.buildSlipBuilder(match, draft);
    await interaction.update({ embeds: [builderUI.embed], components: builderUI.rows });
    return;
  }

  if (customId.startsWith('user_slip_clear_all:')) {
    const matchId = parseInt(customId.replace('user_slip_clear_all:', ''), 10);
    const draft = getOrCreateUserSlipDraft(user.id, matchId);

    draft.picks = {};

    const match = MatchService.getMatchById(matchId);
    if (!match) {
      await interaction.reply({ content: 'Match not found.', ephemeral: true });
      return;
    }

    const builderUI = UserUI.buildSlipBuilder(match, draft);
    await interaction.update({ embeds: [builderUI.embed], components: builderUI.rows });
    return;
  }

  if (customId.startsWith('user_slip_submit:')) {
    const matchId = parseInt(customId.replace('user_slip_submit:', ''), 10);
    const draft = userSlipDrafts[user.id];
    if (!draft) {
      await interaction.reply({ content: '❌ Slip session expired. Please open predict again.', ephemeral: true });
      return;
    }

    const pickEntries = Object.entries(draft.picks) as [MarketType, SlipPick][];
    if (pickEntries.length === 0) {
      await interaction.reply({ content: '❌ You must select at least 1 team to place a bet.', ephemeral: true });
      return;
    }

    const match = MatchService.getMatchById(matchId);
    if (!match) {
      await interaction.reply({ content: '❌ Match not found.', ephemeral: true });
      return;
    }

    if (draft.mode === 'SINGLE') {
      const bets = pickEntries.map(([bType, p]) => ({
        matchId,
        marketType: bType,
        selectedTarget: p.team,
        stake: p.stake,
      }));

      try {
        const tickets = PredictionService.submitMultipleSingleTickets(user.id, user.username, bets);
        delete userSlipDrafts[user.id];

        const totalStake = bets.reduce((s, b) => s + b.stake, 0);
        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle(`${SERVER_EMOJIS.VC_BADGE} ${tickets.length} Prediction Slip${tickets.length > 1 ? 's' : ''} Confirmed`)
          .setDescription(
            `Your picks for **${match.lobby_name}** are locked in! Good luck, **${user.username}**.`
          )
          .addFields(
            { name: '🪙 Total Stake', value: `**${totalStake.toLocaleString()}** coins`, inline: true },
            { name: '🎯 Mode', value: 'Single Bets', inline: true },
            { name: '🎮 Lobby', value: match.lobby_name, inline: true },
            {
              name: '📋 Confirmed Slips',
              value: tickets
                .map((t, idx) => {
                  const bet = bets[idx];
                  const bDef = BRACKET_DEFS.find((b) => b.type === bet.marketType)!;
                  const odds = (t.combo_weight / t.stake).toFixed(2);
                  const potWin = t.combo_weight.toLocaleString();
                  const teamDisplay = formatTeamWithEmoji(bet.selectedTarget, guild || undefined);
                  return `• **Slip #${t.id} (${bDef.label}):** ${teamDisplay}\n  ↳ Stake: **${bet.stake.toLocaleString()}** coins • \`${odds}x\` → **+${potWin}**`;
                })
                .join('\n'),
              inline: false,
            }
          )
          .setFooter({ text: 'VC Arena • Winnings credit immediately after match result' });

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('user_ui_home').setLabel('Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠')
        );

        await interaction.update({ embeds: [embed], components: [row] });
      } catch (err: any) {
        await interaction.reply({ content: `❌ Bet Submission Failed: ${err.message}`, ephemeral: true });
      }
      return;
    } else {
      // COMBO Mode
      if (pickEntries.length < 2) {
        await interaction.reply({ content: '❌ A combo parlay requires at least 2 distinct position picks! Switch to Single Bets mode if you want individual bets.', ephemeral: true });
        return;
      }

      const legs = pickEntries.map(([bType, p]) => ({
        matchId,
        marketType: bType,
        selectedTarget: p.team,
      }));

      try {
        const ticket = PredictionService.submitTicket(user.id, user.username, draft.comboStake, legs);
        delete userSlipDrafts[user.id];

        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle(`${SERVER_EMOJIS.VC_BADGE} Combo Slip #${ticket.id} Confirmed`)
          .setDescription(
            `Your combo slip on **${match.lobby_name}** is locked in! Good luck, **${user.username}**.`
          )
          .addFields(
            { name: '🪙 Stake', value: `**${ticket.stake.toLocaleString()}** coins`, inline: true },
            { name: '📈 Multiplier', value: `\`${(ticket.combo_weight / ticket.stake).toFixed(2)}x\``, inline: true },
            { name: '💰 Potential Payout', value: `**+${ticket.combo_weight.toLocaleString()}** coins`, inline: true },
            {
              name: '📋 Combo Selections',
              value: legs
                .map((l) => {
                  const bDef = BRACKET_DEFS.find((b) => b.type === l.marketType)!;
                  const teamDisplay = formatTeamWithEmoji(l.selectedTarget, guild || undefined);
                  return `• ${bDef.emoji} **${bDef.label}:** ${teamDisplay}`;
                })
                .join('\n'),
              inline: false,
            }
          )
          .setFooter({ text: 'VC Arena • Multi-bracket combo parlay' });

        const flexBtn = new ButtonBuilder()
          .setCustomId(`share_ticket_${ticket.id}`)
          .setLabel(`Flex Ticket #${ticket.id}`)
          .setStyle(ButtonStyle.Primary)
          .setEmoji('📢');

        const row = new ActionRowBuilder<ButtonBuilder>().addComponents(flexBtn);
        await interaction.update({ embeds: [embed], components: [row] });
      } catch (err: any) {
        await interaction.reply({ content: `❌ Combo Submission Failed: ${err.message}`, ephemeral: true });
      }
      return;
    }
  }

  // ==========================================
  // ADMIN CONTROL PANEL ACTIONS
  // ==========================================

  if (customId === 'admin_ui_refresh' || customId === 'admin_ui_back') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    const embed = AdminUI.buildPanelEmbed(guild);
    const rows = AdminUI.buildPanelComponents();
    await interaction.update({ embeds: [embed], components: rows });
    return;
  }

  if (customId === 'admin_ui_create_match') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    const creationUI = AdminUI.buildMatchCreationComponents();
    await interaction.update({ embeds: [creationUI.embed], components: creationUI.rows });
    return;
  }

  if (customId.startsWith('admin_launch_match:')) {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const [, formatKey, minsStr] = customId.split(':');
    const mins = parseInt(minsStr, 10) || 15;

    let participatingTeams: string[] = [];
    let lobbyName = 'Championship Match';

    const groups = TeamGroupService.getGroupsSummary();

    if (formatKey === 'AvsB') {
      participatingTeams = [...(groups['Group A'] || []), ...(groups['Group B'] || [])];
      lobbyName = 'Group A vs Group B Showdown';
    } else if (formatKey === 'CvsD') {
      participatingTeams = [...(groups['Group C'] || []), ...(groups['Group D'] || [])];
      lobbyName = 'Group C vs Group D Showdown';
    } else if (formatKey === 'AvsC') {
      participatingTeams = [...(groups['Group A'] || []), ...(groups['Group C'] || [])];
      lobbyName = 'Group A vs Group C Showdown';
    } else if (formatKey === 'BvsD') {
      participatingTeams = [...(groups['Group B'] || []), ...(groups['Group D'] || [])];
      lobbyName = 'Group B vs Group D Showdown';
    } else if (formatKey === 'AvsD') {
      participatingTeams = [...(groups['Group A'] || []), ...(groups['Group D'] || [])];
      lobbyName = 'Group A vs Group D Showdown';
    } else if (formatKey === 'BvsC') {
      participatingTeams = [...(groups['Group B'] || []), ...(groups['Group C'] || [])];
      lobbyName = 'Group B vs Group C Showdown';
    } else if (formatKey === 'ALL_GROUPS') {
      participatingTeams = [
        ...(groups['Group A'] || []),
        ...(groups['Group B'] || []),
        ...(groups['Group C'] || []),
        ...(groups['Group D'] || []),
      ];
      lobbyName = 'Grand Finals Mega Showdown (Groups A+B+C+D)';
    } else {
      participatingTeams = TeamGroupService.getAllTeams().map((t) => t.name);
      lobbyName = 'Open Arena Showdown (All Teams)';
    }

    if (participatingTeams.length === 0) {
      await interaction.reply({
        content: `❌ Could not find teams for format "${formatKey}". Please ensure groups are assigned first in Manage Groups!`,
        ephemeral: true,
      });
      return;
    }

    // Determine next match number
    const season = MatchService.getActiveSeason();
    const existing = MatchService.getAllSeasonMatches(season.id);
    const nextMatchNum = existing.length + 1;

    const scheduledTime = Date.now();
    const deadline = scheduledTime + mins * 60 * 1000;

    const created = MatchService.createMatch(
      nextMatchNum,
      lobbyName,
      scheduledTime,
      deadline,
      participatingTeams
    );

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} Match #${created.match_number} Opened for Predictions`)
      .setDescription(
        `**Lobby:** ${created.lobby_name} • **Closes:** <t:${Math.floor(deadline / 1000)}:R> (<t:${Math.floor(deadline / 1000)}:t>)`
      )
      .addFields({
        name: `🛡️ Participating Teams (${created.participating_teams.length})`,
        value:
          created.participating_teams
            .slice(0, 12)
            .map((t) => formatTeamWithEmoji(t, guild || undefined))
            .join(', ') + (created.participating_teams.length > 12 ? '...' : ''),
        inline: false,
      })
      .setFooter({ text: 'VC Arena • 1-Click Match Creator' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_predict_match_${created.id}`)
        .setLabel(`Predict Match #${created.match_number}`)
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎯'),
      new ButtonBuilder()
        .setCustomId('admin_ui_refresh')
        .setLabel('Admin Panel')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⚙️')
    );

    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  if (customId === 'admin_ui_settle_result') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    const resultUI = AdminUI.buildResultSelector();
    await interaction.update({ embeds: [resultUI.embed], components: resultUI.rows });
    return;
  }

  if (customId.startsWith('admin_result_add_photo:')) {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const matchId = parseInt(customId.replace('admin_result_add_photo:', ''), 10);
    const modal = new ModalBuilder()
      .setCustomId(`modal_admin_result_photo:${matchId}`)
      .setTitle('Attach Standings Screenshot');

    const photoInput = new TextInputBuilder()
      .setCustomId('result_photo_url_input')
      .setLabel('Paste Image / Screenshot Web URL')
      .setPlaceholder('https://cdn.discordapp.com/attachments/.../standings.png')
      .setValue(adminResultDrafts[user.id]?.photoUrl || '')
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(photoInput));
    await interaction.showModal(modal);
    return;
  }

  if (customId.startsWith('admin_confirm_result:')) {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const matchId = parseInt(customId.replace('admin_confirm_result:', ''), 10);
    const draft = adminResultDrafts[user.id];

    if (!draft || !draft.winner || !draft.second || !draft.third) {
      await interaction.reply({
        content: '❌ Please select 1st, 2nd, and 3rd place teams from the dropdowns above before submitting.',
        ephemeral: true,
      });
      return;
    }

    if (draft.winner === draft.second || draft.winner === draft.third || draft.second === draft.third) {
      await interaction.reply({
        content: '❌ 1st, 2nd, and 3rd place teams must all be distinct teams.',
        ephemeral: true,
      });
      return;
    }

    try {
      const outcome = SettlementService.recordMatchResult(
        matchId,
        [draft.winner, draft.second, draft.third],
        undefined,
        undefined,
        draft.photoUrl
      );
      const photoUrl = draft.photoUrl;
      delete adminResultDrafts[user.id];

      const match = MatchService.getMatchById(matchId);
      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} Match #${match?.match_number} Results Settled`)
        .setDescription(
          `**Lobby:** ${match?.lobby_name || `#${matchId}`}\n` +
          `• 🥇 **1st Place:** ${formatTeamWithEmoji(outcome.winner, guild || undefined)}\n` +
          `• 🥈 **2nd Place:** ${formatTeamWithEmoji(draft.second, guild || undefined)}\n` +
          `• 🥉 **3rd Place:** ${formatTeamWithEmoji(draft.third, guild || undefined)}`
        )
        .addFields(
          { name: '📊 Legs Resolved', value: `${outcome.resolvedLegsCount}`, inline: true },
          { name: '🎫 Tickets Settled', value: `${outcome.eliminatedTicketsCount}`, inline: true }
        )
        .setFooter({ text: 'VC Arena • Results declared and payouts distributed' });

      if (photoUrl) {
        embed.setImage(photoUrl);
      }

      const winnerFields = NotificationService.formatWinnerFields(outcome);
      embed.addFields(winnerFields);

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('admin_ui_refresh')
          .setLabel('Back to Admin Panel')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('⚙️')
      );

      await interaction.update({ embeds: [embed], components: [row] });

      // Trigger DMs to winners and post public announcement in channel if there are winners
      await NotificationService.notifyMatchResults(interaction.client, outcome, interaction.channel as any);
    } catch (err: any) {
      await interaction.reply({ content: `❌ Settlement Failed: ${err.message}`, ephemeral: true });
    }
    return;
  }

  if (customId === 'admin_ui_groups') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    const groupsUI = AdminUI.buildGroupsManagement();
    await interaction.update({ embeds: [groupsUI.embed], components: groupsUI.rows });
    return;
  }

  if (customId === 'admin_group_auto_split_3') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    TeamGroupService.autoSplitIntoGroups(3);
    const groupsUI = AdminUI.buildGroupsManagement();
    await interaction.update({ embeds: [groupsUI.embed], components: groupsUI.rows });
    return;
  }

  if (customId === 'admin_group_auto_split_4') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    TeamGroupService.autoSplitIntoGroups(4);
    const groupsUI = AdminUI.buildGroupsManagement();
    await interaction.update({ embeds: [groupsUI.embed], components: groupsUI.rows });
    return;
  }

  if (customId === 'admin_group_reset_all') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    TeamGroupService.resetAllGroups();
    const groupsUI = AdminUI.buildGroupsManagement();
    await interaction.update({ embeds: [groupsUI.embed], components: groupsUI.rows });
    return;
  }

  if (customId === 'admin_group_pick_roles') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('📁 Step 1: Select Group to Assign')
      .setDescription('Choose which group you are assigning Discord team roles to:');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_open_role_picker:Group A').setLabel('Assign to Group A').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_open_role_picker:Group B').setLabel('Assign to Group B').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_open_role_picker:Group C').setLabel('Assign to Group C').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId('admin_ui_groups').setLabel('Back').setStyle(ButtonStyle.Secondary)
    );

    await interaction.update({ embeds: [embed], components: [row] });
    return;
  }

  if (customId.startsWith('admin_open_role_picker:')) {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const groupName = customId.replace('admin_open_role_picker:', '');
    const roleMenu = new RoleSelectMenuBuilder()
      .setCustomId(`select_group_roles:${groupName}`)
      .setPlaceholder(`Pick team roles for ${groupName}...`)
      .setMinValues(1)
      .setMaxValues(25);

    const row1 = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleMenu);
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_ui_groups').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`📁 Select Roles for ${groupName}`)
      .setDescription(
        `Use the Discord role picker below to select up to 25 team roles for **${groupName}**.\n` +
        `Any valid team role will automatically be assigned (no manual typing required)!`
      );

    await interaction.update({ embeds: [embed], components: [row1, row2] });
    return;
  }

  if (customId === 'admin_ui_settle_pool') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    try {
      const season = MatchService.getActiveSeason();
      const summary = SettlementService.settleSeason(season.id);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🪙 Season Prize Pool Settled & Distributed!')
        .setDescription(
          `**Season Concluded:** ${summary.seasonName}\n\n` +
          `• **Total Pool Collected:** \`${summary.totalPool.toLocaleString()}\` coins\n` +
          `• **5% Platform Burn:** \`-${summary.coinSinkAmount.toLocaleString()}\` coins\n` +
          `• **Distributable Pool:** \`${summary.distributablePool.toLocaleString()}\` coins\n` +
          `• **Winning Tickets:** \`${summary.winningTicketsCount}\` slips paid out!\n` +
          `• **Total Coins Paid:** \`+${summary.totalDistributed.toLocaleString()}\` coins\n` +
          `• **Rollover to Next Season:** \`${summary.rolloverAmount.toLocaleString()}\` coins`
        );

      if (summary.winners.length > 0) {
        const topWinners = summary.winners
          .slice(0, 10)
          .map((w: any) => `• **${w.username}**: \`+${w.payout.toLocaleString()}\` coins (Ticket #${w.ticketId})`)
          .join('\n');
        embed.addFields({ name: '🎉 Top Winning Payouts', value: topWinners });
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin_ui_refresh').setLabel('Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
      );

      await interaction.update({ embeds: [embed], components: [row] });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Season settlement failed: ${err.message}`, ephemeral: true });
    }
    return;
  }

  if (customId === 'admin_ui_grant_coins') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const userSelect = new UserSelectMenuBuilder()
      .setCustomId('admin_select_user_grant_coins')
      .setPlaceholder('Pick a server member to grant coins to...')
      .setMinValues(1)
      .setMaxValues(1);

    const row1 = new ActionRowBuilder<UserSelectMenuBuilder>().addComponents(userSelect);
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_ui_refresh').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle('💰 Step 1: Select Player to Receive Coins')
      .setDescription(
        'Use the dropdown menu below to select any member from this server.\n' +
        'Once selected, a popup modal will appear where you can specify the coin amount and an optional note.'
      );

    await interaction.update({ embeds: [embed], components: [row1, row2] });
    return;
  }

  if (customId === 'admin_ui_cancel_match') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const openMatches = MatchService.getOpenMatches();
    if (openMatches.length === 0) {
      await interaction.reply({ content: 'No active open matches to cancel.', ephemeral: true });
      return;
    }

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('admin_select_match_to_cancel')
      .setPlaceholder('Select match to void / cancel (Void Leg Rule)...')
      .addOptions(
        openMatches.map((m) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`Match #${m.match_number}: ${m.lobby_name}`)
            .setDescription(`Teams: ${m.participating_teams.length}`)
            .setValue(String(m.id))
        )
      );

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_ui_back').setLabel('Cancel').setStyle(ButtonStyle.Secondary)
    );

    const embed = new EmbedBuilder()
      .setColor('#E74C3C')
      .setTitle('🛑 Cancel / Void Tournament Match')
      .setDescription(
        'Select a match below to cancel.\n' +
        'Under the **Void Leg (Push) Rule**, legs on this match will automatically be downgraded to `1.0x`, protecting players’ remaining combo picks!'
      );

    await interaction.update({ embeds: [embed], components: [row1, row2] });
    return;
  }

  // 1. Central dashboard buttons
  if (customId === 'btn_matches') {
    const matches = MatchService.getOpenMatches();
    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Match Schedule`)
      .setDescription(
        'Browse open tournament lobbies and lock in your predictions before betting closes!'
      );

    if (matches.length === 0) {
      embed.addFields({
        name: '⏳ No Active Matches',
        value: 'All lobbies are currently locked or settled. Check back soon for the next round!',
      });
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    const actionRow = new ActionRowBuilder<ButtonBuilder>();

    for (const m of matches) {
      const teamsDisplay = m.participating_teams
        .slice(0, 8)
        .map((t) => formatTeamWithEmoji(t, guild || undefined))
        .join(', ');

      embed.addFields({
        name: `🎮 Match #${m.match_number} • ${m.lobby_name}`,
        value:
          `• **Closes:** <t:${Math.floor(m.deadline / 1000)}:R> (<t:${Math.floor(m.deadline / 1000)}:t>)\n` +
          `• **Teams (${m.participating_teams.length}):** ${teamsDisplay}${m.participating_teams.length > 8 ? '...' : ''}`,
      });

      if (actionRow.components.length < 5) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`btn_predict_match_${m.id}`)
            .setLabel(`Predict #${m.match_number}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎯')
        );
      }
    }

    embed.setFooter({ text: 'VC Arena • Click buttons below to predict' });

    if (actionRow.components.length > 0) {
      rows.push(actionRow);
    }

    await interaction.reply({ embeds: [embed], components: rows, ephemeral: true });
    return;
  }

  if (customId === 'btn_balance') {
    const acc = UserService.getOrCreateUser(user.id, user.username);
    const ledger = LedgerService.getUserHistory(user.id, 5);

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Wallet: ${acc.username}`)
      .setDescription(
        `Title: \`${acc.equipped_title}\` • Streak: **${acc.daily_streak}d** 🔥`
      )
      .addFields(
        { name: '🪙 Balance', value: `**${acc.balance.toLocaleString()}** coins`, inline: true },
        { name: '🔒 In Play', value: `**${acc.reserved_stake.toLocaleString()}** coins`, inline: true },
        { name: '💼 Net Worth', value: `**${(acc.balance + acc.reserved_stake).toLocaleString()}** coins`, inline: true },
        { name: '📈 Net Profit', value: `**${acc.lifetime_profit >= 0 ? '+' : ''}${acc.lifetime_profit.toLocaleString()}** coins`, inline: true },
        { name: '🎉 Total Won', value: `**+${acc.lifetime_won_payouts.toLocaleString()}** coins`, inline: true },
        { name: '🌟 Top Win', value: `**${acc.biggest_win_payout.toLocaleString()}** coins`, inline: true }
      );

    if (ledger.length > 0) {
      const typeIcons: Record<string, string> = {
        STARTING_GRANT: '🎁 Welcome Bonus',
        DAILY_REWARD: '📦 Daily Crate',
        TICKET_STAKE: '🎟️ Slip Placed',
        TICKET_PAYOUT: '🎉 Slip Won',
        TICKET_REFUND: '↩️ Void Leg / Refund',
        ADMIN_ADJUSTMENT: '👑 Admin Grant',
        SHOP_PURCHASE: '🛍️ Shop Item',
      };

      const txRows = ledger.map((tx) => {
        const sign = tx.amount > 0 ? '+' : '';
        const timeAgo = `<t:${Math.floor(tx.created_at / 1000)}:R>`;
        const label = typeIcons[tx.type] || tx.type;
        return `• **${label}**: \`${sign}${tx.amount.toLocaleString()}\` coins • ${timeAgo}`;
      });

      embed.addFields({
        name: '📜 Recent Transactions',
        value: txRows.join('\n'),
      });
    }

    embed.setFooter({ text: 'VC Arena • Virtual Currency Ledger' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_daily').setLabel('Daily Crate').setStyle(ButtonStyle.Success).setEmoji('🎁'),
      new ButtonBuilder().setCustomId('btn_mytickets').setLabel('My Slips').setStyle(ButtonStyle.Secondary).setEmoji('🎫'),
      new ButtonBuilder().setCustomId('user_ui_open_shop').setLabel('Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛍️')
    );

    await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    return;
  }

  if (customId === 'btn_daily') {
    try {
      const reward = MysteryBoxService.openBox(user.id, user.username);
      const tierColor = reward.tierName === 'Legendary Crate' ? '#F1C40F' : reward.tierName === 'Epic Crate' ? '#9B59B6' : '#3498DB';

      const embed = new EmbedBuilder()
        .setColor(tierColor as any)
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} ${reward.tierEmoji} Daily Mystery Crate Unboxed`)
        .setDescription(
          `**${user.username}** opened a **${reward.tierName}**!`
        )
        .addFields(
          { name: '🎁 Base Loot', value: `+**${reward.baseAmount.toLocaleString()}** coins`, inline: true },
          { name: `🔥 Day ${reward.streakDays} Streak`, value: `+**${reward.streakBonus.toLocaleString()}** coins`, inline: true },
          { name: '💰 Total Claimed', value: `**+${reward.totalCoins.toLocaleString()}** coins`, inline: true },
          { name: '⏳ Next Crate', value: `<t:${Math.floor(reward.nextClaimTime / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: 'VC Arena • Daily crates reset every 24h' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('user_ui_predict').setLabel('Predict Match').setStyle(ButtonStyle.Success).setEmoji('🎯'),
        new ButtonBuilder().setCustomId('user_ui_home').setLabel('Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠')
      );

      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
    } catch (err: any) {
      await interaction.reply({ content: `⏳ ${err.message}`, ephemeral: true });
    }
    return;
  }

  if (customId === 'btn_mytickets') {
    const tickets = PredictionService.getUserTickets(user.id, 4);
    if (tickets.length === 0) {
      await interaction.reply({ content: '❌ You have no tickets placed yet! Click **Predict Match** or use `/predict` to build a combo.', ephemeral: true });
      return;
    }

    const embeds: EmbedBuilder[] = [];

    for (const ticket of tickets) {
      let statusColor = '#3498DB';
      let statusText = '⏳ IN PROGRESS';
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
        .setTitle(`🎫 Slip #${ticket.id} • ${statusText}`)
        .setDescription(
          `**Stake:** \`${ticket.stake.toLocaleString()}\` coins • **Multiplier:** \`${(ticket.combo_weight / ticket.stake).toFixed(2)}x\` • <t:${Math.floor(ticket.created_at / 1000)}:R>`
        );

      if (ticket.legs && ticket.legs.length > 0) {
        const legRows = ticket.legs.map((leg) => {
          const match = MatchService.getMatchById(leg.match_id);
          const matchTitle = match ? `Match #${match.match_number}` : `#${leg.match_id}`;

          let emoji = '⏳';
          if (leg.status === 'WON') emoji = '✅';
          else if (leg.status === 'LOST') emoji = '❌';
          else if (leg.status === 'VOID') emoji = '🚫';

          const bDef = BRACKET_DEFS.find((b) => b.type === leg.market_type);
          const bracketLabel = bDef ? bDef.label : leg.market_type;
          const teamFormatted = formatTeamWithEmoji(leg.selected_target, guild || undefined);

          return `• ${emoji} **${bracketLabel}:** ${teamFormatted} (\`${leg.locked_odds}x\`) • *${matchTitle}*`;
        });

        embed.addFields({ name: '📋 Selections', value: legRows.join('\n') });
      }

      embeds.push(embed);
    }

    const latest = tickets[0];
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`share_ticket_${latest.id}`)
        .setLabel(`Flex Ticket #${latest.id}`)
        .setStyle(ButtonStyle.Primary)
        .setEmoji('📢'),
      new ButtonBuilder()
        .setCustomId('user_ui_home')
        .setLabel('Hub')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏠')
    );

    await interaction.reply({ embeds: embeds.slice(0, 3), components: [row], ephemeral: true });
    return;
  }

  if (customId === 'btn_leaderboard') {
    const rankings = LeaderboardService.getRankings(7);
    const season = MatchService.getActiveSeason();

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Leaderboard`)
      .setDescription(
        `Season: **${season.name}** • Prize Pool: **${season.total_pool.toLocaleString()}** coins`
      );

    if (rankings.length === 0) {
      embed.addFields({
        name: '🏆 No Ranked Players',
        value: 'Be the first to submit predictions and claim the #1 spot!',
      });
    } else {
      const rows = rankings.map((r) => {
        let medal = `**#${r.rank}**`;
        if (r.rank === 1) medal = '🥇';
        if (r.rank === 2) medal = '🥈';
        if (r.rank === 3) medal = '🥉';

        const profitFormatted = r.netProfit >= 0 ? `+${r.netProfit.toLocaleString()}` : `${r.netProfit.toLocaleString()}`;
        return `• ${medal} **${r.username}** \`${r.equippedTitle}\`\n  Score: **${r.compositeScore}** • Profit: **${profitFormatted}** coins • Acc: **${r.accuracyScore}%**`;
      });

      embed.addFields({ name: '🏅 Top Analysts', value: rows.join('\n') });
    }

    embed.setFooter({ text: 'VC Arena • 60% Profit + 40% Accuracy' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'btn_shop') {
    const shopUI = UserUI.buildShopUI(user.id, user.username);
    await interaction.reply({ embeds: [shopUI.embed], components: shopUI.rows, ephemeral: true });
    return;
  }

  // Help Menu Buttons
  if (customId === 'help_player_cmds') {
    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Player Commands`)
      .setDescription(
        'Available commands for all arena players:'
      )
      .addFields(
        { name: '🕹️ `/igri` or `!menu`', value: 'Interactive player terminal with zero typing needed.' },
        { name: '🎮 `/matches` or `!matches`', value: 'Browse open tournament lobbies and deadlines.' },
        { name: '🎯 `/predict` or `!predict`', value: 'Slip builder with single & combo prediction modes.' },
        { name: '🎫 `/mytickets` or `!tickets`', value: 'Track all active and settled prediction slips.' },
        { name: '💳 `/balance` or `!bal`', value: 'Check your coin balance, active stakes, and ledger.' },
        { name: '🎁 `/daily` or `!daily`', value: 'Open your 24-hour mystery crate for bonus coins.' },
        { name: '🏆 `/profile [user]` or `!profile`', value: 'Inspect stats, accuracy, and crew allegiance.' },
        { name: '📊 `/leaderboard` or `!lb`', value: 'Rankings combining 60% profit + 40% accuracy.' },
        { name: '⚔️ `/fanbase` or `!fanbase`', value: 'Crew war leaderboard comparing team supporters.' },
        { name: '🛍️ `/shop` or `!shop`', value: 'Spend coins on exclusive titles, badges, and roles.' }
      )
      .setFooter({ text: 'VC Arena • Virtual Currency Prediction League' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'help_fanbase_guide') {
    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Crew Allegiance Guide`)
      .setDescription(
        '**Represent your favorite squad in the tournament!**\n\n' +
        '1️⃣ **Get Your Team Role:** Grab your crew role in the server (e.g. `@NXT8`, `@REDLINE`, etc.).\n\n' +
        '2️⃣ **Automatic Profile Display:** When anyone checks your `/profile`, your crew badge is displayed.\n\n' +
        '3️⃣ **Fanbase Wars (`/fanbase`):** Your winning slip profits contribute to your crew’s total standing.\n\n' +
        '4️⃣ **1-Click Slip Copying:** Click `[ 📋 Copy Ticket ]` on shared slips in chat to back the same picks!'
      )
      .setFooter({ text: 'VC Arena • Support your squad' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'help_admin_guide') {
    const embed = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Administrator Guide`)
      .setDescription(
        '**Authorized Roles:** Server Admins or members with `.` / `...` / `Crew` roles.\n\n' +
        '• **Step 1: Set up Groups** → `/admin group-auto-split groups_count: 3`\n' +
        '• **Step 2: Create Matches** → `/admin match-create-groups group1: "Group A" group2: "Group B"`\n' +
        '• **Step 3: Declare Results** → `/admin result match_id: 1 winner_1st: ... second_2nd: ... third_3rd: ...`\n' +
        '• **Step 4: Season Settle** → `/admin season-settle` to distribute seasonal pool rewards!'
      )
      .setFooter({ text: 'VC Arena • Operations Guide' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // 2. Share Ticket / Flex
  if (customId.startsWith('share_ticket_')) {
    const ticketId = parseInt(customId.replace('share_ticket_', ''), 10);
    const ticket = PredictionService.getTicketById(ticketId);
    if (!ticket) {
      await interaction.reply({ content: 'Ticket not found.', ephemeral: true });
      return;
    }

    const flexEmbed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} Slip Shared • ${interaction.user.username}`)
      .setDescription(
        `**${interaction.user.username}** shared a **${ticket.legs?.length}-leg combo**!`
      )
      .addFields(
        { name: '🪙 Stake', value: `${ticket.stake.toLocaleString()} coins`, inline: true },
        { name: '⚡ Multiplier', value: `\`${(ticket.combo_weight / ticket.stake).toFixed(2)}x\``, inline: true },
        { name: '📊 Status', value: `\`${ticket.status}\``, inline: true }
      );

    ticket.legs?.forEach((l, i) => {
      const match = MatchService.getMatchById(l.match_id);
      const bDef = BRACKET_DEFS.find((b) => b.type === l.market_type);
      const label = bDef ? bDef.label : l.market_type;
      const teamFormatted = formatTeamWithEmoji(l.selected_target, interaction.guild || undefined);

      flexEmbed.addFields({
        name: `Leg ${i + 1}: ${bDef?.emoji || '🎯'} ${label}`,
        value: `${teamFormatted}\n• Match: *${match ? match.lobby_name : `#${l.match_id}`}* • \`${l.locked_odds}x\``,
        inline: true,
      });
    });

    const copyBtn = new ButtonBuilder()
      .setCustomId(`copy_ticket_${ticket.id}`)
      .setLabel(`Copy ${interaction.user.username}'s Slip`)
      .setStyle(ButtonStyle.Success)
      .setEmoji('📋');

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(copyBtn);
    await interaction.reply({ embeds: [flexEmbed], components: [row] });
    return;
  }

  // 3. Copy Ticket Button
  if (customId.startsWith('copy_ticket_')) {
    const ticketId = parseInt(customId.replace('copy_ticket_', ''), 10);
    const originalTicket = PredictionService.getTicketById(ticketId);
    if (!originalTicket || !originalTicket.legs) {
      await interaction.reply({ content: 'Ticket could not be copied.', ephemeral: true });
      return;
    }

    try {
      const copyDraft = originalTicket.legs.map((leg) => ({
        matchId: leg.match_id,
        marketType: leg.market_type,
        selectedTarget: leg.selected_target,
      }));

      // Submit copy ticket with same stake or min 100
      const stakeToUse = Math.min(originalTicket.stake, 500);
      const newTicket = PredictionService.submitTicket(user.id, user.username, stakeToUse, copyDraft);

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} Slip Copied Successfully`)
        .setDescription(
          `You backed the exact same predictions as <@${originalTicket.user_id}>!`
        )
        .addFields(
          { name: '🎟️ New Ticket ID', value: `#${newTicket.id}`, inline: true },
          { name: '🪙 Your Stake', value: `${newTicket.stake.toLocaleString()} coins`, inline: true },
          { name: '⚡ Multiplier', value: `\`${(newTicket.combo_weight / newTicket.stake).toFixed(2)}x\``, inline: true }
        )
        .setFooter({ text: 'VC Arena • Track slips live in /mytickets' });

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Could not copy ticket: ${err.message}`, ephemeral: true });
    }
    return;
  }
}

export async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
  const { customId, user, member, values } = interaction;

  // 1. Admin Match Creation: Format Selected -> Choose Timer
  if (customId === 'admin_match_create_select_format') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    const formatKey = values[0];
    const timerUI = AdminUI.buildDeadlineButtons(formatKey);
    await interaction.update({ embeds: [timerUI.embed], components: timerUI.rows });
    return;
  }

  // 2. Admin Result Selector: Switch Active Match
  if (customId === 'admin_switch_result_match') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    const matchId = parseInt(values[0], 10);
    const resultUI = AdminUI.buildResultSelector(matchId);
    await interaction.update({ embeds: [resultUI.embed], components: resultUI.rows });
    return;
  }

  // 3. Admin Setting 1st, 2nd, 3rd Placements
  if (customId.startsWith('admin_set_result_1st:')) {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    adminResultDrafts[user.id] = { ...adminResultDrafts[user.id], winner: values[0] };
    await interaction.reply({ content: `🥇 1st Place set to: **${values[0]}**`, ephemeral: true });
    return;
  }

  if (customId.startsWith('admin_set_result_2nd:')) {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    adminResultDrafts[user.id] = { ...adminResultDrafts[user.id], second: values[0] };
    await interaction.reply({ content: `🥈 2nd Place set to: **${values[0]}**`, ephemeral: true });
    return;
  }

  if (customId.startsWith('admin_set_result_3rd:')) {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    adminResultDrafts[user.id] = { ...adminResultDrafts[user.id], third: values[0] };
    await interaction.reply({ content: `🥉 3rd Place set to: **${values[0]}**`, ephemeral: true });
    return;
  }

  // 4. Admin Cancelling Match
  if (customId === 'admin_select_match_to_cancel') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }
    const matchId = parseInt(values[0], 10);
    try {
      const result = SettlementService.cancelMatch(matchId, 'Cancelled by administrator via Admin Panel');
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle(`🛑 Match #${matchId} Cancelled`)
        .setDescription(
          `Match #${matchId} has been successfully cancelled.\n\n` +
          `• **Voided Legs (Push Rule):** \`${result.voidedLegs}\` (downgraded to 1.0x)\n` +
          `• **Refunded Tickets:** \`${result.refundedTickets}\` slips refunded directly to players’ balances!`
        );

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin_ui_refresh').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
      );

      await interaction.update({ embeds: [embed], components: [row] });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Cancel failed: ${err.message}`, ephemeral: true });
    }
    return;
  }

  // 5. User Prediction Slip: Select Position Bracket
  if (customId.startsWith('user_slip_bracket:')) {
    const matchId = parseInt(customId.replace('user_slip_bracket:', ''), 10);
    const selectedBracket = values[0] as MarketType;
    const draft = getOrCreateUserSlipDraft(user.id, matchId);
    draft.currentBracket = selectedBracket;

    if (draft.picks[selectedBracket]) {
      draft.currentStake = draft.picks[selectedBracket]!.stake;
    }

    const match = MatchService.getMatchById(matchId);
    if (!match) {
      await interaction.reply({ content: 'Match not found.', ephemeral: true });
      return;
    }

    const builderUI = UserUI.buildSlipBuilder(match, draft);
    await interaction.update({ embeds: [builderUI.embed], components: builderUI.rows });
    return;
  }

  // 6. User Prediction Slip: Select Team for Active Bracket
  if (customId.startsWith('user_slip_team:')) {
    const matchId = parseInt(customId.replace('user_slip_team:', ''), 10);
    const selectedTeam = values[0];
    const draft = getOrCreateUserSlipDraft(user.id, matchId);

    // Rule: "one team cannot be repeated"
    const alreadyUsedIn = Object.entries(draft.picks).find(
      ([b, p]) => b !== draft.currentBracket && p.team.toLowerCase() === selectedTeam.toLowerCase()
    );

    if (alreadyUsedIn) {
      const existingDef = BRACKET_DEFS.find((d) => d.type === alreadyUsedIn[0]);
      await interaction.reply({
        content: `❌ **One team cannot be repeated!** \`${selectedTeam}\` is already picked for **${existingDef?.label || alreadyUsedIn[0]}** on this slip.`,
        ephemeral: true,
      });
      return;
    }

    draft.picks[draft.currentBracket] = {
      team: selectedTeam,
      stake: draft.currentStake,
    };

    const match = MatchService.getMatchById(matchId);
    if (!match) {
      await interaction.reply({ content: 'Match not found.', ephemeral: true });
      return;
    }

    const builderUI = UserUI.buildSlipBuilder(match, draft);
    await interaction.update({ embeds: [builderUI.embed], components: builderUI.rows });
    return;
  }

  // 7. Vanity Boutique Purchase
  if (customId === 'shop_purchase_select') {
    const itemId = values[0];
    try {
      const result = ShopService.buyItem(user.id, user.username, itemId);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🛍️ Purchase Successful!')
        .setDescription(`You successfully bought **${result.item.name}**!`)
        .addFields(
          { name: 'Cost', value: `\`${result.item.cost.toLocaleString()}\` coins`, inline: true },
          { name: 'Remaining Balance', value: `\`${result.newBalance.toLocaleString()}\` coins`, inline: true }
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Purchase failed: ${err.message}`, ephemeral: true });
    }
    return;
  }
}

export async function handleRoleSelectMenuInteraction(interaction: RoleSelectMenuInteraction): Promise<void> {
  const { customId, roles, member } = interaction;

  if (customId.startsWith('select_group_roles:')) {
    const groupName = customId.replace('select_group_roles:', '');

    // Verify admin access
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({
        content: '🚫 **Access Denied:** You need an administrator role to configure tournament groups.',
        ephemeral: true,
      });
      return;
    }

    const selectedRoles = Array.from(roles.values());
    const matchedTeams: string[] = [];
    const unmatchedRoleNames: string[] = [];

    for (const role of selectedRoles) {
      if (FanService.isSystemRole(role.name)) {
        unmatchedRoleNames.push(role.name);
        continue;
      }

      // Check if it matches an existing team name (exact, normalized, alias)
      let teamName = FanService.matchRoleToTeam(role);
      if (!teamName) {
        // Auto-register: If an admin explicitly selected this role, treat it as an official team!
        teamName = role.name.trim();
      }

      if (!matchedTeams.includes(teamName)) {
        matchedTeams.push(teamName);
      }
    }

    if (matchedTeams.length === 0) {
      await interaction.reply({
        content: `❌ Only server divider or administrative roles were selected. Please select team roles.\nSelected: ${selectedRoles.map((r) => `@${r.name}`).join(', ')}`,
        ephemeral: true,
      });
      return;
    }

    const result = TeamGroupService.assignTeamsToGroup(groupName, matchedTeams);

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} Group Configured: ${groupName}`)
      .setDescription(
        `Assigned **${result.assigned.length} teams** to **${groupName}**:`
      )
      .addFields({
        name: `📁 Teams in ${groupName}`,
        value: result.assigned.map((t) => `• ${formatTeamWithEmoji(t, interaction.guild || undefined)}`).join('\n'),
      })
      .setFooter({ text: 'VC Arena • Group configured' });

    await interaction.update({ embeds: [embed], components: [] });
    return;
  }
}

export async function handleModalInteraction(interaction: ModalSubmitInteraction): Promise<void> {
  const { customId, user } = interaction;

  if (customId.startsWith('modal_slip_custom_stake:')) {
    const matchId = parseInt(customId.replace('modal_slip_custom_stake:', ''), 10);
    const rawVal = interaction.fields.getTextInputValue('custom_stake_input').trim();
    const newStake = parseInt(rawVal, 10);

    if (isNaN(newStake) || newStake < 50) {
      await interaction.reply({
        content: '❌ Invalid stake amount. Please enter a valid number (minimum 50 coins).',
        ephemeral: true,
      });
      return;
    }

    const userData = UserService.getOrCreateUser(user.id, user.username);
    if (userData.balance < newStake) {
      await interaction.reply({
        content: `❌ Insufficient balance! You have **${userData.balance.toLocaleString()}** coins.`,
        ephemeral: true,
      });
      return;
    }

    const draft = getOrCreateUserSlipDraft(user.id, matchId);
    draft.currentStake = newStake;
    if (draft.picks[draft.currentBracket]) {
      draft.picks[draft.currentBracket]!.stake = newStake;
    }
    if (draft.mode === 'COMBO') {
      draft.comboStake = newStake;
    }

    const match = MatchService.getMatchById(matchId);
    if (!match) {
      await interaction.reply({ content: 'Match not found.', ephemeral: true });
      return;
    }

    const builderUI = UserUI.buildSlipBuilder(match, draft);
    if (interaction.isFromMessage()) {
      await interaction.update({ embeds: [builderUI.embed], components: builderUI.rows });
    } else {
      await interaction.reply({ embeds: [builderUI.embed], components: builderUI.rows, ephemeral: true });
    }
    return;
  }

  if (customId.startsWith('admin_modal_grant_coins:')) {
    if (!AdminRoleService.isUserAdmin(interaction.member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const targetUserId = customId.replace('admin_modal_grant_coins:', '');
    const amountVal = interaction.fields.getTextInputValue('grant_amount_input').trim();
    const reasonVal = interaction.fields.getTextInputValue('grant_reason_input')?.trim() || 'Admin panel grant';
    const amount = parseInt(amountVal, 10);

    if (isNaN(amount) || amount <= 0) {
      await interaction.reply({ content: '❌ Invalid amount. Must be a number greater than 0.', ephemeral: true });
      return;
    }

    let targetUsername = `User_${targetUserId.slice(-4)}`;
    try {
      const fetched = await interaction.client.users.fetch(targetUserId);
      if (fetched) targetUsername = fetched.username;
    } catch {}

    try {
      const result = UserService.addBalance(targetUserId, targetUsername, amount, user.id, reasonVal);

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} Coins Granted Successfully`)
        .setDescription(
          `Granted **+${amount.toLocaleString()} coins** to <@${targetUserId}>.`
        )
        .addFields(
          { name: '👤 Recipient', value: `**${targetUsername}**`, inline: true },
          { name: '💳 Previous Balance', value: `${result.oldBalance.toLocaleString()} coins`, inline: true },
          { name: '💰 New Balance', value: `${result.newBalance.toLocaleString()} coins`, inline: true },
          { name: '📝 Reason', value: reasonVal, inline: true },
          { name: '👑 Admin', value: `<@${user.id}>`, inline: true }
        )
        .setFooter({ text: 'VC Arena • Balance credited' })
        .setTimestamp();

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin_ui_refresh').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
      );

      if (interaction.isFromMessage()) {
        await interaction.update({ embeds: [embed], components: [row] });
      } else {
        await interaction.reply({ embeds: [embed], components: [row] });
      }
    } catch (err: any) {
      await interaction.reply({ content: `❌ Failed to grant coins: ${err.message}`, ephemeral: true });
    }
    return;
  }

  if (customId.startsWith('modal_admin_result_photo:')) {
    if (!AdminRoleService.isUserAdmin(interaction.member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const matchId = parseInt(customId.replace('modal_admin_result_photo:', ''), 10);
    const photoUrl = interaction.fields.getTextInputValue('result_photo_url_input')?.trim();

    if (!adminResultDrafts[user.id]) {
      adminResultDrafts[user.id] = {};
    }
    adminResultDrafts[user.id].photoUrl = photoUrl;

    const resultUI = AdminUI.buildResultSelector(matchId, photoUrl);
    if (interaction.isFromMessage()) {
      await interaction.update({ embeds: [resultUI.embed], components: resultUI.rows });
    } else {
      await interaction.reply({ embeds: [resultUI.embed], components: resultUI.rows, ephemeral: true });
    }
    return;
  }
}

export async function handleUserSelectMenuInteraction(interaction: UserSelectMenuInteraction): Promise<void> {
  const { customId, member, values } = interaction;

  if (customId === 'admin_select_user_grant_coins') {
    if (!AdminRoleService.isUserAdmin(member)) {
      await interaction.reply({ content: '🚫 Admin access required.', ephemeral: true });
      return;
    }

    const selectedUserId = values[0];
    const selectedUser = interaction.users.get(selectedUserId);
    const displayName = selectedUser?.username || `User_${selectedUserId.slice(-4)}`;

    const modal = new ModalBuilder()
      .setCustomId(`admin_modal_grant_coins:${selectedUserId}`)
      .setTitle(`Grant Coins: ${displayName}`.slice(0, 45));

    const amountInput = new TextInputBuilder()
      .setCustomId('grant_amount_input')
      .setLabel('Amount of coins to add')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. 5000, 10000, 25000')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(8);

    const reasonInput = new TextInputBuilder()
      .setCustomId('grant_reason_input')
      .setLabel('Reason / Note (optional)')
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('e.g. Tournament MVP award, Event prize')
      .setRequired(false)
      .setMaxLength(100);

    const row1 = new ActionRowBuilder<TextInputBuilder>().addComponents(amountInput);
    const row2 = new ActionRowBuilder<TextInputBuilder>().addComponents(reasonInput);
    modal.addComponents(row1, row2);

    await interaction.showModal(modal);
    return;
  }
}

