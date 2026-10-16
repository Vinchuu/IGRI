import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { db } from '../../database/db.js';
import { config } from '../../config.js';
import { MatchService } from '../../services/MatchService.js';
import { SettlementService } from '../../services/SettlementService.js';

export const adminCommand = {
  data: new SlashCommandBuilder()
    .setName('admin')
    .setDescription('iGRI Tournament Administrator suite')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

    // Subcommand: Match Create
    .addSubcommand((sub) =>
      sub
        .setName('match-create')
        .setDescription('Create a new multi-lobby match with participating teams')
        .addIntegerOption((opt) => opt.setName('match_number').setDescription('Match sequence number (e.g. 1)').setRequired(true))
        .addStringOption((opt) => opt.setName('lobby_name').setDescription('Map or Lobby name (e.g. Cayo Perico)').setRequired(true))
        .addStringOption((opt) =>
          opt
            .setName('teams')
            .setDescription('Comma-separated list of participating teams (e.g. GodL, Soul, Hydra, Blind)')
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

    // Subcommand: Match List
    .addSubcommand((sub) => sub.setName('match-list').setDescription('List all matches in the active season'))

    // Subcommand: Enter Result
    .addSubcommand((sub) =>
      sub
        .setName('result')
        .setDescription('Enter official match placements and top fragger to resolve tickets')
        .addIntegerOption((opt) => opt.setName('match_id').setDescription('ID of the match to settle').setRequired(true))
        .addStringOption((opt) => opt.setName('winner_1st').setDescription('1st Place winning team').setRequired(true))
        .addStringOption((opt) => opt.setName('second_2nd').setDescription('2nd Place podium team').setRequired(true))
        .addStringOption((opt) => opt.setName('third_3rd').setDescription('3rd Place podium team').setRequired(true))
        .addStringOption((opt) => opt.setName('top_fragger').setDescription('Top Fragger (player or team)').setRequired(true))
    )

    // Subcommand: Cancel Match
    .addSubcommand((sub) =>
      sub
        .setName('cancel')
        .setDescription('Cancel a match and trigger the Void Leg (Push) rule or refund')
        .addIntegerOption((opt) => opt.setName('match_id').setDescription('ID of the match to cancel').setRequired(true))
        .addStringOption((opt) => opt.setName('reason').setDescription('Reason for cancellation').setRequired(false))
    )

    // Subcommand: Season Settle
    .addSubcommand((sub) =>
      sub
        .setName('season-settle')
        .setDescription('Finalize season/day pool, take 5% coin sink, and distribute winnings!')
        .addIntegerOption((opt) => opt.setName('season_id').setDescription('Season ID (defaults to active)').setRequired(false))
    )

    // Subcommand: Audit
    .addSubcommand((sub) => sub.setName('audit').setDescription('Inspect coin pool integrity and recent transactions')),

  async execute(interaction: ChatInputCommandInteraction): Promise<void> {
    // Verify admin permissions
    const member = interaction.member as any;
    const hasAdminPerm = interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
    const hasAdminRole = config.discord.adminRoleId && member?.roles?.cache?.has(config.discord.adminRoleId);

    if (!hasAdminPerm && !hasAdminRole) {
      await interaction.reply({
        content: '🚫 You do not have permission to execute administrator commands.',
        ephemeral: true,
      });
      return;
    }

    const subcommand = interaction.options.getSubcommand();

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

    if (subcommand === 'match-list') {
      const season = MatchService.getActiveSeason();
      const matches = MatchService.getAllSeasonMatches(season.id);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`📋 Season Matches (${season.name})`)
        .setDescription(`Current Season Pool: **${season.total_pool.toLocaleString()} coins**`);

      if (matches.length === 0) {
        embed.addFields({ name: 'No Matches', value: 'Create a match with `/admin match-create`.' });
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

        const embed = new EmbedBuilder()
          .setColor('#00E676')
          .setTitle(`🏁 Match #${matchId} Results Recorded!`)
          .addFields(
            { name: '🥇 1st Place', value: `**${winner}**`, inline: true },
            { name: '🥈 2nd Place', value: `**${second}**`, inline: true },
            { name: '🥉 3rd Place', value: `**${third}**`, inline: true },
            { name: '🎯 Top Fragger', value: `**${topFragger}**`, inline: true },
            { name: '📊 Resolved Legs', value: `\`${resolvedLegsCount}\` legs`, inline: true },
            { name: '❌ Eliminated Tickets', value: `\`${eliminatedTicketsCount}\` slips`, inline: true }
          )
          .setFooter({ text: 'All active player slips have been updated automatically!' });

        await interaction.reply({ embeds: [embed] });
      } catch (err: any) {
        await interaction.reply({ content: `❌ Error: ${err.message}`, ephemeral: true });
      }
      return;
    }

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
