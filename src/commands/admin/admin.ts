import {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../database/db.js';
import { MatchService } from '../../services/MatchService.js';
import { SettlementService } from '../../services/SettlementService.js';
import { TeamGroupService } from '../../services/TeamGroupService.js';
import { AdminRoleService } from '../../services/AdminRoleService.js';

export const adminCommand = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('iGRI Tournament Administrator suite')
    .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages) // Let our service check custom roles (., ..., Crew)

    // Subcommand: Match Create with Custom Teams
    .addSubcommand((sub) =>
      sub
        .setName('match-create')
        .setDescription('Create a match lobby with a custom list of teams')
        .addIntegerOption((opt) => opt.setName('match_number').setDescription('Match sequence number (e.g. 1)').setRequired(true))
        .addStringOption((opt) => opt.setName('lobby_name').setDescription('Map or Lobby name (e.g. Cayo Perico)').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('teams')
            .setDescription('Comma-separated list of participating teams (e.g. NXT8, REDLINE, Pew Pew)')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('deadline_minutes')
            .setDescription('Minutes from now until prediction market locks')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption((opt) =>
          opt
            .setName('players')
            .setDescription('Optional comma-separated star fraggers (defaults to teams list if omitted)')
            .setRequired(false)
        )
    )

    // Subcommand: Match Create by Groups (e.g. Group A vs Group B)
    .addSubcommand((sub) =>
      sub
        .setName('match-create-groups')
        .setDescription('Create a match lobby by combining 2 tournament groups (e.g. Group A + Group B)')
        .addIntegerOption((opt) => opt.setName('match_number').setDescription('Match sequence number (e.g. 1)').setRequired(true))
        .addStringOption((opt) => opt.setName('lobby_name').setDescription('Map or Lobby name (e.g. Erangel Arena)').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('group1')
            .setDescription('First participating group (e.g. Group A)')
            .setRequired(true)
        )
        .addStringOption((opt) =>
          opt
            .setName('group2')
            .setDescription('Second participating group (e.g. Group B)')
            .setRequired(true)
        )
        .addIntegerOption((opt) =>
          opt
            .setName('deadline_minutes')
            .setDescription('Minutes from now until prediction market locks')
            .setRequired(true)
            .setMinValue(1)
        )
        .addStringOption((opt) =>
          opt
            .setName('group3')
            .setDescription('Optional third group if 3 groups play together (e.g. Group C)')
            .setRequired(false)
        )
    )

    // Subcommand: Match Create with ALL 43 Teams (Anyone can predict any team)
    .addSubcommand((sub) =>
      sub
        .setName('match-create-all')
        .setDescription('Create a match lobby containing ALL 43 registered teams (anyone can predict any team!)')
        .addIntegerOption((opt) => opt.setName('match_number').setDescription('Match sequence number (e.g. 1)').setRequired(true))
        .addStringOption((opt) => opt.setName('lobby_name').setDescription('Map or Lobby name (e.g. Cayo Perico Arena)').setRequired(true))
        .addIntegerOption((opt) =>
          opt
            .setName('deadline_minutes')
            .setDescription('Minutes from now until prediction market locks')
            .setRequired(true)
            .setMinValue(1)
        )
    )

    // Subcommand: Match List
    .addSubcommand((sub) => sub.setName('match-list').setDescription('List all matches in the active season'))

    // Subcommand: Enter Result After Every Match
    .addSubcommand((sub) =>
      sub
        .setName('result')
        .setDescription('Declare official match placements & top fragger to resolve tickets immediately')
        .addIntegerOption((opt) => opt.setName('match_id').setDescription('ID of the match to settle').setRequired(true))
        .addStringOption((opt) => opt.setName('winner_1st').setDescription('1st Place winning team').setRequired(true).setAutocomplete(true))
        .addStringOption((opt) => opt.setName('second_2nd').setDescription('2nd Place podium team').setRequired(true).setAutocomplete(true))
        .addStringOption((opt) => opt.setName('third_3rd').setDescription('3rd Place podium team').setRequired(true).setAutocomplete(true))
        .addStringOption((opt) => opt.setName('top_fragger').setDescription('Top Fragger (player or team)').setRequired(true).setAutocomplete(true))
    )

    // Subcommand: Group Set
    .addSubcommand((sub) =>
      sub
        .setName('group-set')
        .setDescription('Assign teams to a tournament group (e.g. Group A)')
        .addStringOption((opt) => opt.setName('group_name').setDescription('Name of the group (e.g. Group A)').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('teams')
            .setDescription('Comma-separated list of teams to assign to this group')
            .setRequired(true)
        )
    )

    // Subcommand: Group List
    .addSubcommand((sub) => sub.setName('group-list').setDescription('List all tournament groups and their assigned teams'))

    // Subcommand: Group Auto-Split
    .addSubcommand((sub) =>
      sub
        .setName('group-auto-split')
        .setDescription('Automatically split all 43 registered teams into 3 or 4 balanced groups')
        .addIntegerOption((opt) =>
          opt
            .setName('groups_count')
            .setDescription('Number of groups to split into (e.g. 3 or 4)')
            .setRequired(true)
            .setMinValue(2)
            .setMaxValue(6)
        )
    )

    // Subcommand: Group Reset
    .addSubcommand((sub) =>
      sub
        .setName('group-reset')
        .setDescription('Reset all 43 teams back to UNGROUPED so you can organize them fresh')
    )

    // Subcommand: Admin Role Add
    .addSubcommand((sub) =>
      sub
        .setName('role-add')
        .setDescription('Add a role name or role ID to the bot administrator access list')
        .addStringOption((opt) => opt.setName('role').setDescription('Role name (e.g. Crew) or Role ID').setRequired(true))
    )

    // Subcommand: Admin Role Remove
    .addSubcommand((sub) =>
      sub
        .setName('role-remove')
        .setDescription('Remove a role from administrator access')
        .addStringOption((opt) => opt.setName('role').setDescription('Role name or ID to remove').setRequired(true))
    )

    // Subcommand: Admin Role List
    .addSubcommand((sub) => sub.setName('role-list').setDescription('List all authorized admin roles (e.g. ., ..., Crew)'))

    // Subcommand: Cancel Match
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel a match and trigger the Void Leg (Push) rule or refund')
        .addIntegerOption((opt) => opt.setName('match_id').setDescription('ID of the match to cancel').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for cancellation').setRequired(false))
    )

    // Subcommand: Season / Day Settle
    .addSubcommand((sub) =>
      sub
        .setName('season-settle')
        .setDescription('Finalize tournament pool, burn 5% coin sink, and distribute winnings!')
        .addIntegerOption((opt) => opt.setName('season_id').setDescription('Season ID (defaults to active)').setRequired(false))
    )

    // Subcommand: Audit
    .addSubcommand((sub) => sub.setName('audit').setDescription('Inspect coin pool integrity and recent transactions')),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focused = interaction.options.getFocused(true);
    const query = focused.value.toLowerCase();
    const suggestions = TeamGroupService.searchTeams(query, 25);
    await interaction.respond(suggestions.map((name) => ({ name, value: name })));
  },

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Verify admin access via AdminRoleService (checks Administrator, ., ..., Crew, and custom roles)
    if (!AdminRoleService.isUserAdmin(interaction.member)) {
      const allowedRoles = AdminRoleService.getAdminRoles();
      await interaction.reply({
        content: `🚫 **Access Denied:** You need an administrator role to run this command.\nAuthorized roles: \`${allowedRoles.join('`, `')}\``,
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

    // 1. Match Create (Manual Teams)
    if (subcommand === 'match-create') {
      const matchNum = interaction.options.getInteger('match_number', true);
      const lobbyName = interaction.options.getString('lobby_name', true);
      const rawTeams = interaction.options.getString('teams', true);
      const deadlineMins = interaction.options.getInteger('deadline_minutes', true);
      const rawPlayers = interaction.options.getString('players') || '';

      const teams = rawTeams.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
      const players = rawPlayers
        ? rawPlayers.split(',').map((p) => p.trim()).filter((p) => p.length > 0)
        : teams;

      if (teams.length < 2) {
        await interaction.reply({ content: '❌ A lobby must have at least 2 teams.', ephemeral: true });
        return;
      }

      const now = Date.now();
      const scheduledTime = now + deadlineMins * 60 * 1000;
      const deadline = scheduledTime;

      const match = MatchService.createMatch(matchNum, lobbyName, scheduledTime, deadline, teams, players);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`✅ Created Match #${match.match_number}: ${match.lobby_name}`)
        .addFields(
          { name: 'Match ID', value: `\`${match.id}\``, inline: true },
          { name: 'Teams Count', value: `\`${teams.length}\` teams`, inline: true },
          { name: 'Locks In', value: `<t:${Math.floor(deadline / 1000)}:R>`, inline: true },
          { name: 'Participating Teams', value: teams.join(', ') }
        )
        .setFooter({ text: 'Players can now place combo predictions on this match!' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 2. Match Create by Groups (e.g. Group A vs Group B)
    if (subcommand === 'match-create-groups') {
      const matchNum = interaction.options.getInteger('match_number', true);
      const lobbyName = interaction.options.getString('lobby_name', true);
      const group1 = interaction.options.getString('group1', true).trim();
      const group2 = interaction.options.getString('group2', true).trim();
      const group3 = interaction.options.getString('group3')?.trim();
      const deadlineMins = interaction.options.getInteger('deadline_minutes', true);

      const teamsGroup1 = TeamGroupService.getTeamsByGroup(group1);
      const teamsGroup2 = TeamGroupService.getTeamsByGroup(group2);
      const teamsGroup3 = group3 ? TeamGroupService.getTeamsByGroup(group3) : [];

      const combinedTeams = Array.from(new Set([...teamsGroup1, ...teamsGroup2, ...teamsGroup3]));

      if (combinedTeams.length < 2) {
        await interaction.reply({
          content: `❌ Could not find enough teams in the specified groups (${group1}: ${teamsGroup1.length}, ${group2}: ${teamsGroup2.length}).\nUse \`/admin group-list\` or \`/admin group-set\` to configure groups first!`,
          ephemeral: true,
        });
        return;
      }

      const now = Date.now();
      const scheduledTime = now + deadlineMins * 60 * 1000;
      const deadline = scheduledTime;

      const groupsLabel = group3 ? `${group1} vs ${group2} vs ${group3}` : `${group1} vs ${group2}`;
      const fullLobbyName = `${lobbyName} (${groupsLabel})`;

      const match = MatchService.createMatch(matchNum, fullLobbyName, scheduledTime, deadline, combinedTeams, combinedTeams);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`🎮 Created Group Match #${match.match_number}: ${match.lobby_name}`)
        .setDescription(`Combined **${combinedTeams.length} teams** from **${groupsLabel}**!`)
        .addFields(
          { name: 'Match ID', value: `\`${match.id}\``, inline: true },
          { name: 'Lobby Size', value: `\`${combinedTeams.length}\` teams`, inline: true },
          { name: 'Locks In', value: `<t:${Math.floor(deadline / 1000)}:R>`, inline: true },
          { name: 'Teams in Lobby', value: combinedTeams.join(', ') }
        )
        .setFooter({ text: 'Prediction markets are now live for this group showdown!' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 2b. Match Create with ALL 43 Teams
    if (subcommand === 'match-create-all') {
      const matchNum = interaction.options.getInteger('match_number', true);
      const lobbyName = interaction.options.getString('lobby_name', true);
      const deadlineMins = interaction.options.getInteger('deadline_minutes', true);

      const allRegisteredTeams = TeamGroupService.getAllTeams().map((t) => t.name);

      const now = Date.now();
      const scheduledTime = now + deadlineMins * 60 * 1000;
      const deadline = scheduledTime;

      const match = MatchService.createMatch(matchNum, `${lobbyName} (All 43 Teams)`, scheduledTime, deadline, allRegisteredTeams, allRegisteredTeams);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`🌐 Created All-Teams Match #${match.match_number}: ${match.lobby_name}`)
        .setDescription('**All 43 registered tournament teams are in this lobby!** Anyone can predict any team.')
        .addFields(
          { name: 'Match ID', value: `\`${match.id}\``, inline: true },
          { name: 'Lobby Size', value: `\`${allRegisteredTeams.length}\` teams`, inline: true },
          { name: 'Locks In', value: `<t:${Math.floor(deadline / 1000)}:R>`, inline: true }
        )
        .setFooter({ text: 'Prediction markets are open for all teams!' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 3. Match List
    if (subcommand === 'match-list') {
      const season = MatchService.getActiveSeason();
      const matches = MatchService.getAllSeasonMatches(season.id);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`📋 Season Matches (${season.name})`)
        .setDescription(`Current Season Pool: **${season.total_pool.toLocaleString()} coins**`);

      if (matches.length === 0) {
        embed.addFields({ name: 'No Matches', value: 'Create a match with `/admin match-create` or `/admin match-create-groups`.' });
      } else {
        for (const m of matches) {
          let statusEmoji = '🟢 OPEN';
          if (m.status === 'LOCKED') statusEmoji = '🔒 LOCKED';
          if (m.status === 'SETTLED') statusEmoji = `✅ SETTLED (Winner: ${m.result_winner})`;
          if (m.status === 'CANCELLED') statusEmoji = '🚫 CANCELLED';

          embed.addFields({
            name: `Match #${m.match_number}: ${m.lobby_name} [ID: ${m.id}] — ${statusEmoji}`,
            value: `• Teams: ${m.participating_teams.slice(0, 8).join(', ')}${m.participating_teams.length > 8 ? '...' : ''}\n• Locks: <t:${Math.floor(m.deadline / 1000)}:R>`,
            inline: false,
          });
        }
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 4. Declare Result After Every Match
    if (subcommand === 'result') {
      const matchId = interaction.options.getInteger('match_id', true);
      const winner = interaction.options.getString('winner_1st', true).trim();
      const second = interaction.options.getString('second_2nd', true).trim();
      const third = interaction.options.getString('third_3rd', true).trim();
      const topFragger = interaction.options.getString('top_fragger', true).trim();

      try {
        const { resolvedLegsCount, eliminatedTicketsCount } = SettlementService.recordMatchResult(
          matchId,
          winner,
          second,
          third,
          topFragger
        );

        const match = MatchService.getMatchById(matchId);

        const embed = new EmbedBuilder()
          .setColor('#00E676')
          .setTitle(`🏁 MATCH #${matchId} OFFICIAL RESULT DECLARED!`)
          .setDescription(match ? `**${match.lobby_name}**` : `Match #${matchId}`)
          .addFields(
            { name: '🥇 1st Place (WWCD)', value: `🏆 **${winner}**`, inline: true },
            { name: '🥈 2nd Place', value: `🥈 **${second}**`, inline: true },
            { name: '🥉 3rd Place', value: `🥉 **${third}**`, inline: true },
            { name: '🎯 Top Fragger', value: `🔥 **${topFragger}**`, inline: true },
            { name: '📊 Resolved Legs', value: `\`${resolvedLegsCount}\` selections checked`, inline: true },
            { name: '❌ Eliminated Slips', value: `\`${eliminatedTicketsCount}\` slips knocked out`, inline: true }
          )
          .setFooter({ text: 'Official result confirmed • Active player slips updated instantly!' });

        await interaction.reply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
      }
      return;
    }

    // 5. Group Set
    if (subcommand === 'group-set') {
      const groupName = interaction.options.getString('group_name', true).trim();
      const rawTeams = interaction.options.getString('teams', true);
      const teams = rawTeams.split(',').map((t) => t.trim()).filter((t) => t.length > 0);

      const result = TeamGroupService.assignTeamsToGroup(groupName, teams);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`📁 Group Updated: ${groupName}`)
        .setDescription(`Successfully assigned **${result.assigned.length} teams** to **${groupName}**:\n${result.assigned.join(', ')}`);

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 6. Group List
    if (subcommand === 'group-list') {
      const groups = TeamGroupService.getGroupsSummary();
      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle('📊 iGRI Tournament Groups Overview')
        .setDescription('Current teams registered and grouped for match generation:');

      for (const [groupName, teamsList] of Object.entries(groups)) {
        embed.addFields({
          name: `${groupName} (${teamsList.length} teams)`,
          value: teamsList.length > 0 ? teamsList.join(', ') : '*No teams assigned*',
          inline: false,
        });
      }

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 7. Group Auto-Split
    if (subcommand === 'group-auto-split') {
      const count = interaction.options.getInteger('groups_count', true);
      const groups = TeamGroupService.autoSplitIntoGroups(count);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`⚡ All 43 Teams Automatically Split into ${count} Groups!`)
        .setDescription('Tournament groups balanced and ready:');

      for (const [groupName, teamsList] of Object.entries(groups)) {
        embed.addFields({
          name: `${groupName} (${teamsList.length} teams)`,
          value: teamsList.join(', '),
          inline: false,
        });
      }

      embed.setFooter({ text: 'You can now create matches using /admin match-create-groups!' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 7b. Group Reset
    if (subcommand === 'group-reset') {
      const resetCount = TeamGroupService.resetAllGroups();
      const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle('🔄 Tournament Groups Reset')
        .setDescription(`Successfully reset **${resetCount} teams** back to **UNGROUPED**.\nAll teams are now clear of any previous random groups!`)
        .setFooter({ text: 'Use /admin group-set when you are ready to assign official groups.' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 8. Admin Role Add
    if (subcommand === 'role-add') {
      const role = interaction.options.getString('role', true).trim();
      AdminRoleService.addAdminRole(role);

      await interaction.reply({
        content: `✅ Successfully added \`${role}\` to authorized administrator roles. Users with this role can now run \`/admin\` commands.`,
      });
      return;
    }

    // 9. Admin Role Remove
    if (subcommand === 'role-remove') {
      const role = interaction.options.getString('role', true).trim();
      const removed = AdminRoleService.removeAdminRole(role);

      if (removed) {
        await interaction.reply({ content: `✅ Removed \`${role}\` from administrator access.` });
      } else {
        await interaction.reply({ content: `⚠️ Role \`${role}\` was not found in the administrator list.`, ephemeral: true });
      }
      return;
    }

    // 10. Admin Role List
    if (subcommand === 'role-list') {
      const roles = AdminRoleService.getAdminRoles();
      const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle('🛡️ Authorized Administrator Roles')
        .setDescription(
          `Users with server **Administrator** permission OR any of these roles have full admin access to the bot:\n\n` +
            roles.map((r) => `• **${r}**`).join('\n')
        )
        .setFooter({ text: 'Add more roles anytime using /admin role-add' });

      await interaction.reply({ embeds: [embed] });
      return;
    }

    // 11. Cancel Match
    if (subcommand === 'cancel') {
      const matchId = interaction.options.getInteger('match_id', true);
      const reason = interaction.options.getString('reason') || 'Cancelled by admin';

      try {
        const { voidedLegs, refundedTickets } = SettlementService.cancelMatch(matchId, reason);

        const embed = new EmbedBuilder()
          .setColor('#E67E22')
          .setTitle(`⚠️ Match #${matchId} Cancelled`)
          .setDescription(`Reason: *${reason}*`)
          .addFields(
            { name: 'Voided Legs (Odds 1.0x)', value: `\`${voidedLegs}\` legs downgraded`, inline: true },
            { name: 'Refunded Tickets', value: `\`${refundedTickets}\` slips refunded`, inline: true }
          )
          .setFooter({ text: 'The Void Leg rule has been applied automatically.' });

        await interaction.reply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
      }
      return;
    }

    // 12. Season Settle
    if (subcommand === 'season-settle') {
      const activeSeason = MatchService.getActiveSeason();
      const seasonId = interaction.options.getInteger('season_id') || activeSeason.id;

      await interaction.deferReply();

      try {
        const summary = SettlementService.settleSeason(seasonId);

        const embed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`🏆 ${summary.seasonName} — TOURNAMENT SETTLED!`)
          .setDescription('The season prize pool has been calculated and coins have been distributed!')
          .addFields(
            { name: '🪙 Total Pool', value: `**${summary.totalPool.toLocaleString()}** coins`, inline: true },
            { name: '🔥 5% Coin Sink', value: `**-${summary.coinSinkAmount.toLocaleString()}** coins burned`, inline: true },
            { name: '💰 Distributable Pool', value: `**${summary.distributablePool.toLocaleString()}** coins`, inline: true },
            { name: '🎟️ Winning Slips', value: `**${summary.winningTicketsCount}** tickets`, inline: true },
            { name: '🎉 Total Paid Out', value: `**${summary.totalDistributed.toLocaleString()}** coins`, inline: true },
            {
              name: '🔄 Rollover',
              value: summary.rolloverAmount > 0 ? `**${summary.rolloverAmount.toLocaleString()}** coins to next season` : 'None',
              inline: true,
            }
          );

        if (summary.winners.length > 0) {
          const winnerRows = summary.winners.slice(0, 8).map((w, i) => {
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '🎖️';
            return `${medal} <@${w.userId}>: Won **+${w.payout.toLocaleString()}** coins *(Combo weight: ${w.comboWeight}x)*`;
          });

          embed.addFields({
            name: '🌟 Top Winners',
            value: winnerRows.join('\n'),
          });
        } else {
          embed.addFields({
            name: 'No Winning Tickets',
            value: `No player landed a 100% correct combo ticket. **${summary.rolloverAmount.toLocaleString()} coins** have been rolled into the next season!`,
          });
        }

        embed.setFooter({ text: 'Coins have been credited directly to player balances.' });

        await interaction.editReply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.editReply({ content: `❌ Settlement Error: ${err.message}` });
      }
      return;
    }

    // 13. Audit
    if (subcommand === 'audit') {
      const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
      const totalCoinsInCirculation = (db.prepare('SELECT SUM(balance + reserved_stake) as sum FROM users').get() as any).sum || 0;
      const totalTickets = (db.prepare('SELECT COUNT(*) as count FROM tickets').get() as any).count;
      const totalSettledWon = (db.prepare("SELECT COUNT(*) as count FROM tickets WHERE status = 'WON'").get() as any).count;
      const season = MatchService.getActiveSeason();

      const embed = new EmbedBuilder()
        .setColor('#1ABC9C')
        .setTitle('🔍 Arena Economy Audit & Telemetry')
        .addFields(
          { name: '👥 Registered Players', value: `\`${totalUsers}\``, inline: true },
          { name: '🪙 Total Money Supply', value: `\`${totalCoinsInCirculation.toLocaleString()}\` coins`, inline: true },
          { name: '🏆 Active Season Pool', value: `\`${season.total_pool.toLocaleString()}\` coins`, inline: true },
          { name: '🎟️ Total Slips Submitted', value: `\`${totalTickets}\``, inline: true },
          { name: '🎉 Slips Won', value: `\`${totalSettledWon}\``, inline: true },
          { name: '🔄 Rollover Reserve', value: `\`${season.rollover_amount.toLocaleString()}\` coins`, inline: true }
        )
        .setFooter({ text: 'iGRI Fantasy Arena Security Engine' });

      await interaction.reply({ embeds: [embed] });
      return;
    }
  },
};
