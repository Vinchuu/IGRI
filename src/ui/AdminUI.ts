import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  Guild,
  RoleSelectMenuBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { MatchService } from '../services/MatchService.js';
import { TeamGroupService } from '../services/TeamGroupService.js';
import { AdminRoleService } from '../services/AdminRoleService.js';
import { SERVER_EMOJIS } from '../utils/emojis.js';
import { db } from '../database/db.js';

export class AdminUI {
  /**
   * Builds the main interactive Administrator Control Panel embed
   */
  static buildPanelEmbed(guild?: Guild | null): EmbedBuilder {
    const season = MatchService.getActiveSeason();
    const openMatches = MatchService.getOpenMatches();
    const groups = TeamGroupService.getGroupsSummary();
    const adminRoles = AdminRoleService.getAdminRoles();

    // Group count summaries
    const groupCountLines: string[] = [];
    for (const [gName, tList] of Object.entries(groups)) {
      if (gName !== 'Ungrouped') {
        groupCountLines.push(`• **${gName}:** ${tList.length} teams`);
      }
    }
    const ungroupedCount = groups['Ungrouped']?.length || 0;

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Operations Center`)
      .setDescription(
        `Tournament operations control panel for managing lobbies, results, and prize pools.`
      )
      .addFields(
        {
          name: '🏆 Active Season',
          value:
            `• Season: **${season.name}**\n` +
            `• Pool: \`${season.total_pool.toLocaleString()}\` coins\n` +
            `• Status: \`${season.status}\``,
          inline: true,
        },
        {
          name: '🎮 Lobbies',
          value:
            `• Open: \`${openMatches.length}\`\n` +
            `• Latest: ${openMatches.length > 0 ? `#${openMatches[0].match_number} (${openMatches[0].lobby_name})` : '*None open*'}`,
          inline: true,
        },
        {
          name: '📁 Groups',
          value:
            (groupCountLines.length > 0 ? groupCountLines.join('\n') : '• *No groups yet*') +
            `\n• Ungrouped: ${ungroupedCount} teams`,
          inline: true,
        },
        {
          name: '🛡️ Authorized Roles',
          value: adminRoles.map((r) => `\`${r}\``).join(', '),
          inline: false,
        }
      )
      .setFooter({ text: 'VC Arena • Administrator Panel' });

    return embed;
  }

  /**
   * Main interactive action buttons for the Admin Control Panel
   */
  static buildPanelComponents(): ActionRowBuilder<ButtonBuilder>[] {
    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_ui_create_match')
        .setLabel('Quick Create Match')
        .setStyle(ButtonStyle.Success)
        .setEmoji('➕'),
      new ButtonBuilder()
        .setCustomId('admin_ui_settle_result')
        .setLabel('Declare Match Result')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🏆'),
      new ButtonBuilder()
        .setCustomId('admin_ui_groups')
        .setLabel('Manage Groups')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('📂')
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_ui_grant_coins')
        .setLabel('Grant Coins')
        .setStyle(ButtonStyle.Success)
        .setEmoji('💰'),
      new ButtonBuilder()
        .setCustomId('admin_ui_settle_pool')
        .setLabel('Settle Season Pool')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('🪙'),
      new ButtonBuilder()
        .setCustomId('admin_ui_cancel_match')
        .setLabel('Cancel Match')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛑'),
      new ButtonBuilder()
        .setCustomId('admin_ui_refresh')
        .setLabel('Refresh')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔄')
    );

    return [row1, row2];
  }

  /**
   * UI for 1-Click Match Creation
   */
  static buildMatchCreationComponents(): { embed: EmbedBuilder; rows: ActionRowBuilder<any>[] } {
    const embed = new EmbedBuilder()
      .setColor('#2ECC71')
      .setTitle('🎮 Quick Match Creator')
      .setDescription(
        'Select the tournament matchup and betting duration below.\n' +
        'The bot will automatically gather all participating teams, open the market, and start the countdown timer.'
      );

    const groupSelect = new StringSelectMenuBuilder()
      .setCustomId('admin_match_create_select_format')
      .setPlaceholder('Step 1: Select Tournament Format & Groups...')
      .addOptions(
        new StringSelectMenuOptionBuilder()
          .setLabel('Group A vs Group B')
          .setDescription('Combines teams from Group A and Group B')
          .setValue('AvsB')
          .setEmoji('⚔️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Group C vs Group D')
          .setDescription('Combines teams from Group C and Group D')
          .setValue('CvsD')
          .setEmoji('⚔️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Group A vs Group C')
          .setDescription('Combines teams from Group A and Group C')
          .setValue('AvsC')
          .setEmoji('⚔️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Group B vs Group D')
          .setDescription('Combines teams from Group B and Group D')
          .setValue('BvsD')
          .setEmoji('⚔️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Group A vs Group D')
          .setDescription('Combines teams from Group A and Group D')
          .setValue('AvsD')
          .setEmoji('⚔️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Group B vs Group C')
          .setDescription('Combines teams from Group B and Group C')
          .setValue('BvsC')
          .setEmoji('⚔️'),
        new StringSelectMenuOptionBuilder()
          .setLabel('All Groups (Group A + B + C + D)')
          .setDescription('Grand Finals 4-group mega showdown')
          .setValue('ALL_GROUPS')
          .setEmoji('🔥'),
        new StringSelectMenuOptionBuilder()
          .setLabel('All Registered Teams (Open Market)')
          .setDescription('All teams in the tournament participate')
          .setValue('ALL_TEAMS')
          .setEmoji('🌐')
      );

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(groupSelect);

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_ui_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
    );

    return { embed, rows: [row1, row2] };
  }

  /**
   * UI for selecting deadline after match format is chosen
   */
  static buildDeadlineButtons(formatKey: string): { embed: EmbedBuilder; rows: ActionRowBuilder<any>[] } {
    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('⏱️ Step 2: Set Betting Lock Deadline')
      .setDescription(
        `Selected Format: **${formatKey}**\n\n` +
        `How many minutes before the FiveM match starts should prediction slips lock?`
      );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`admin_launch_match:${formatKey}:5`).setLabel('5 Minutes').setStyle(ButtonStyle.Primary).setEmoji('⚡'),
      new ButtonBuilder().setCustomId(`admin_launch_match:${formatKey}:10`).setLabel('10 Minutes').setStyle(ButtonStyle.Primary).setEmoji('⏳'),
      new ButtonBuilder().setCustomId(`admin_launch_match:${formatKey}:15`).setLabel('15 Minutes').setStyle(ButtonStyle.Success).setEmoji('🎯'),
      new ButtonBuilder().setCustomId(`admin_launch_match:${formatKey}:30`).setLabel('30 Minutes').setStyle(ButtonStyle.Secondary).setEmoji('⌛'),
      new ButtonBuilder().setCustomId('admin_ui_back').setLabel('Cancel').setStyle(ButtonStyle.Danger).setEmoji('❌')
    );

    return { embed, rows: [row] };
  }

  /**
   * UI for Declaring Results with Dropdown Selectors
   */
  static buildResultSelector(matchId?: number, photoUrl?: string): { embed: EmbedBuilder; rows: ActionRowBuilder<any>[] } {
    const season = MatchService.getActiveSeason();
    const allMatches = MatchService.getAllSeasonMatches(season.id);
    const unsettled = allMatches.filter((m) => m.status === 'OPEN' || m.status === 'LOCKED');

    if (unsettled.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle('🏁 Declare Match Results')
        .setDescription('There are currently no active or locked matches awaiting results.')
        .setFooter({ text: 'Create a match first with Quick Match Creator' });

      const backRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('admin_ui_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
      );
      return { embed, rows: [backRow] };
    }

    const targetMatch = matchId ? allMatches.find((m) => m.id === matchId) || unsettled[0] : unsettled[0];

    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle(`🏁 Declare Result • Match #${targetMatch.match_number}`)
      .setDescription(
        `**Lobby:** ${targetMatch.lobby_name} • Teams: **${targetMatch.participating_teams.length}**\n` +
        `Select the winning teams from the dropdowns below to settle predictions:`
      );

    if (photoUrl) {
      embed.setImage(photoUrl);
      embed.addFields({ name: '📸 Scoreboard Proof Photo', value: `[View Attached Standing Screenshot](${photoUrl})`, inline: false });
    }

    const rows: ActionRowBuilder<any>[] = [];

    // If multiple unsettled matches, offer a match switcher
    if (unsettled.length > 1) {
      const matchSelect = new StringSelectMenuBuilder()
        .setCustomId('admin_switch_result_match')
        .setPlaceholder('Switch Match Lobby...')
        .addOptions(
          unsettled.map((m) =>
            new StringSelectMenuOptionBuilder()
              .setLabel(`Match #${m.match_number}: ${m.lobby_name}`)
              .setDescription(`Status: ${m.status} • Teams: ${m.participating_teams.length}`)
              .setValue(String(m.id))
              .setDefault(m.id === targetMatch.id)
          )
        );
      rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(matchSelect));
    }

    // Dropdown for 1st Place (Winner)
    const teams = targetMatch.participating_teams.slice(0, 25); // Discord limit 25
    const winnerSelect = new StringSelectMenuBuilder()
      .setCustomId(`admin_set_result_1st:${targetMatch.id}`)
      .setPlaceholder('🥇 Step 1: Select 1st Place Champion...')
      .addOptions(
        teams.map((t) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(t)
            .setValue(t)
            .setEmoji('🥇')
        )
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(winnerSelect));

    // Dropdown for 2nd Place
    const secondSelect = new StringSelectMenuBuilder()
      .setCustomId(`admin_set_result_2nd:${targetMatch.id}`)
      .setPlaceholder('🥈 Step 2: Select 2nd Place Team...')
      .addOptions(
        teams.map((t) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(t)
            .setValue(t)
            .setEmoji('🥈')
        )
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(secondSelect));

    // Dropdown for 3rd Place
    const thirdSelect = new StringSelectMenuBuilder()
      .setCustomId(`admin_set_result_3rd:${targetMatch.id}`)
      .setPlaceholder('🥉 Step 3: Select 3rd Place Team...')
      .addOptions(
        teams.map((t) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(t)
            .setValue(t)
            .setEmoji('🥉')
        )
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(thirdSelect));

    // Action Buttons
    const actionRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`admin_result_add_photo:${targetMatch.id}`)
        .setLabel(photoUrl ? '📸 Photo Linked' : '📸 Attach Photo Link')
        .setStyle(photoUrl ? ButtonStyle.Primary : ButtonStyle.Secondary)
        .setEmoji('📷'),
      new ButtonBuilder()
        .setCustomId(`admin_confirm_result:${targetMatch.id}`)
        .setLabel('Submit Result & Resolve Slips')
        .setStyle(ButtonStyle.Success)
        .setEmoji('✅'),
      new ButtonBuilder()
        .setCustomId('admin_ui_back')
        .setLabel('Cancel / Back')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('⬅️')
    );
    rows.push(actionRow);

    return { embed, rows };
  }

  /**
   * UI for Group Management
   */
  static buildGroupsManagement(): { embed: EmbedBuilder; rows: ActionRowBuilder<any>[] } {
    const groups = TeamGroupService.getGroupsSummary();

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('📂 Tournament Groups Management')
      .setDescription('Organize registered tournament teams into competition groups:');

    for (const [groupName, teams] of Object.entries(groups)) {
      embed.addFields({
        name: `📁 ${groupName} (${teams.length} teams)`,
        value: teams.length > 0 ? teams.join(', ') : '*No teams assigned*',
        inline: false,
      });
    }

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('admin_group_auto_split_3')
        .setLabel('Auto-Split: 3 Groups (A, B, C)')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🔄'),
      new ButtonBuilder()
        .setCustomId('admin_group_auto_split_4')
        .setLabel('Auto-Split: 4 Groups (A, B, C, D)')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🔀'),
      new ButtonBuilder()
        .setCustomId('admin_group_pick_roles')
        .setLabel('Assign Group Roles')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📁'),
      new ButtonBuilder()
        .setCustomId('admin_group_reset_all')
        .setLabel('Reset All to Ungrouped')
        .setStyle(ButtonStyle.Danger)
        .setEmoji('⚠️')
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('admin_ui_back').setLabel('Back to Admin Panel').setStyle(ButtonStyle.Secondary).setEmoji('⬅️')
    );

    return { embed, rows: [row1, row2] };
  }
}
