import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  Client,
  EmbedBuilder,
  Message,
  RoleSelectMenuBuilder,
} from 'discord.js';
import { config } from '../config.js';
import { db } from '../database/db.js';
import { AdminRoleService } from '../services/AdminRoleService.js';
import { FanService } from '../services/FanService.js';
import { LeaderboardService } from '../services/LeaderboardService.js';
import { MatchService } from '../services/MatchService.js';
import { MysteryBoxService } from '../services/MysteryBoxService.js';
import { LegDraft, PredictionService } from '../services/PredictionService.js';
import { SettlementService } from '../services/SettlementService.js';
import { NotificationService } from '../services/NotificationService.js';
import { ShopService } from '../services/ShopService.js';
import { TeamGroupService } from '../services/TeamGroupService.js';
import { UserService } from '../services/UserService.js';
import { MarketType } from '../types/index.js';
import { formatTeamWithEmoji, SERVER_EMOJIS } from '../utils/emojis.js';
import { LedgerService } from '../services/LedgerService.js';
import { AdminUI } from '../ui/AdminUI.js';
import { UserUI, BRACKET_DEFS } from '../ui/UserUI.js';

export async function handleMessageCommand(message: Message, client: Client): Promise<void> {
  // Ignore bots and direct messages without guild
  if (message.author.bot || !message.guild) return;

  const content = message.content.trim();
  const configuredPrefix = config.discord.prefix || '!';

  let prefixUsed = '';
  if (content.startsWith(configuredPrefix)) {
    prefixUsed = configuredPrefix;
  } else if (content.startsWith('!')) {
    prefixUsed = '!';
  } else if (content.startsWith('.')) {
    prefixUsed = '.';
  } else if (client.user && content.startsWith(`<@${client.user.id}>`)) {
    prefixUsed = `<@${client.user.id}>`;
  } else if (client.user && content.startsWith(`<@!${client.user.id}>`)) {
    prefixUsed = `<@!${client.user.id}>`;
  } else {
    return; // Not a command
  }

  const rawBody = content.slice(prefixUsed.length).trim();
  if (!rawBody) return;

  const tokens = rawBody.split(/\s+/);
  const commandName = tokens[0].toLowerCase();
  const args = tokens.slice(1);

  // 0. CENTRAL INTERACTIVE ARENA TERMINAL / MENU
  if (['menu', 'arena', 'igri', 'terminal', 'hub'].includes(commandName)) {
    const hub = UserUI.buildPlayerHub(message.author.id, message.author.username);
    await message.reply({ embeds: [hub.embed], components: hub.rows });
    return;
  }

  // 1. HELP / GUIDE
  if (['help', 'h', 'guide', 'commands'].includes(commandName)) {
    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • How to Play`)
      .setDescription(
        'Predict tournament match results, build slips, and climb the leaderboard!\n' +
        'All players receive **10,000 virtual coins** upon joining.\n\n' +
        `💡 Type \`${configuredPrefix}menu\` or \`${configuredPrefix}arena\` anytime for the 1-click dashboard!`
      )
      .addFields(
        {
          name: '🎯 1. Position Markets',
          value:
            '• **🥇 #1 Winner (Champion):** 1st place in the lobby\n' +
            '• **🥈 #2 - #3 (Podium):** 2nd or 3rd place\n' +
            '• **🎖️ #3 - #5 (Top 5):** 3rd through 5th place\n' +
            '• **🎯 #5 - #10 (Top 10):** 5th through 10th place\n' +
            '• **💀 #11 - #16 (Placement):** 11th through 16th place',
          inline: false,
        },
        {
          name: '🎟️ 2. Combo Slips & Rule',
          value:
            '• Combine **2 to 5 position brackets** per match.\n' +
            '• **One Team Cannot Be Repeated:** You must pick a distinct team for each bracket on your slip!\n' +
            '• Stakes: **50 to 1,000 coins** per ticket.',
          inline: false,
        },
        {
          name: '🎁 3. Player Commands',
          value:
            `• \`${configuredPrefix}menu\` — Central interactive player dashboard\n` +
            `• \`${configuredPrefix}predict\` or \`${configuredPrefix}p\` — Interactive slip builder (or \`${configuredPrefix}p 200 Team1, Team2\`)\n` +
            `• \`${configuredPrefix}daily\` or \`${configuredPrefix}d\` — Claim daily mystery box\n` +
            `• \`${configuredPrefix}profile\` or \`${configuredPrefix}bal\` — Check balance & stats\n` +
            `• \`${configuredPrefix}matches\` or \`${configuredPrefix}m\` — View open lobbies & predict\n` +
            `• \`${configuredPrefix}mytickets\` or \`${configuredPrefix}t\` — View active slips\n` +
            `• \`${configuredPrefix}leaderboard\` or \`${configuredPrefix}lb\` — Top tournament analysts\n` +
            `• \`${configuredPrefix}shop\` — Vanity titles & badges`,
          inline: false,
        }
      )
      .setFooter({ text: 'iGRI Esports • Click buttons below to navigate interactively!' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('user_ui_home').setLabel('Open Arena Terminal').setStyle(ButtonStyle.Success).setEmoji('🕹️'),
      new ButtonBuilder().setCustomId('help_player_cmds').setLabel('Player Guide').setStyle(ButtonStyle.Primary).setEmoji('🎮'),
      new ButtonBuilder().setCustomId('help_fanbase_guide').setLabel('Crew Allegiance').setStyle(ButtonStyle.Secondary).setEmoji('🛡️'),
      new ButtonBuilder().setCustomId('help_admin_guide').setLabel('Admin Guide').setStyle(ButtonStyle.Secondary).setEmoji('⚙️')
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // 2. PROFILE / BALANCE
  if (['profile', 'bal', 'balance', 'coins', 'stats', 'wallet', 'passport'].includes(commandName)) {
    const targetUser = message.mentions.users?.first?.() || message.author;
    const user = UserService.getOrCreateUser(targetUser.id, targetUser.username);
    const inventory = UserService.getUserInventory(user.id);

    const member = message.guild.members.cache.get(targetUser.id);
    const teamRole = FanService.getUserTeamRole(member);
    const allegianceText = teamRole
      ? `🛡️ **Crew Allegiance:** <@&${teamRole.roleId}>\n`
      : '🛡️ **Crew Allegiance:** *Independent Analyst*\n';

    const accuracyPercent = user.resolved_selections > 0
      ? ((user.correct_selections / user.resolved_selections) * 100).toFixed(1)
      : '0.0';

    const badges = inventory.map((item) => {
      if (item === 'badge_sharpshooter') return '🎯 Sharpshooter';
      if (item === 'badge_whale') return '🐋 Whale';
      if (item === 'title_oracle') return '🔮 Oracle';
      if (item === 'title_degen') return '🎲 High Roller';
      if (item === 'title_champion') return '👑 Champion';
      return `🏷️ ${item}`;
    });

    const badgeDisplay = badges.length > 0 ? badges.join(' • ') : '*No badges collected yet. Visit shop!*';

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Profile: ${user.username}`)
      .setThumbnail(targetUser.displayAvatarURL())
      .setDescription(
        `${allegianceText}` +
        `Title: \`${user.equipped_title}\` • Streak: **${user.daily_streak}d** 🔥`
      )
      .addFields(
        { name: '🪙 Balance', value: `**${user.balance.toLocaleString()}** coins`, inline: true },
        { name: '🔒 In Play', value: `**${user.reserved_stake.toLocaleString()}** coins`, inline: true },
        { name: '📈 Net Profit', value: `**${user.lifetime_profit >= 0 ? '+' : ''}${user.lifetime_profit.toLocaleString()}** coins`, inline: true },
        { name: '🎯 Accuracy', value: `**${accuracyPercent}%** (${user.correct_selections}/${user.resolved_selections})`, inline: true },
        { name: '🎉 Total Won', value: `**+${user.lifetime_won_payouts.toLocaleString()}** coins`, inline: true },
        { name: '🌟 Top Win', value: `**${user.biggest_win_payout.toLocaleString()}** coins`, inline: true },
        { name: '🎖️ Badges & Titles', value: badgeDisplay, inline: false }
      )
      .setFooter({ text: 'VC Arena • Player Profile' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('btn_daily').setLabel('Daily Crate').setStyle(ButtonStyle.Success).setEmoji('🎁'),
      new ButtonBuilder().setCustomId('btn_mytickets').setLabel('My Slips').setStyle(ButtonStyle.Secondary).setEmoji('🎫'),
      new ButtonBuilder().setCustomId('user_ui_open_shop').setLabel('Shop').setStyle(ButtonStyle.Secondary).setEmoji('🛍️')
    );

    await message.reply({ embeds: [embed], components: [row] });
    return;
  }

  // 3. DAILY MYSTERY BOX
  if (['daily', 'd', 'claim', 'box', 'crate'].includes(commandName)) {
    try {
      const reward = MysteryBoxService.openBox(message.author.id, message.author.username);
      const tierColor = reward.tierName === 'Legendary Crate' ? '#F1C40F' : reward.tierName === 'Epic Crate' ? '#9B59B6' : '#3498DB';

      const embed = new EmbedBuilder()
        .setColor(tierColor as any)
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} ${reward.tierEmoji} Daily Mystery Crate Unboxed`)
        .setDescription(
          `**${message.author.username}** opened a **${reward.tierName}**!`
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

      await message.reply({ embeds: [embed], components: [row] });
    } catch (err: any) {
      const embed = new EmbedBuilder()
        .setColor('#E74C3C')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} ⏳ Daily Crate On Cooldown`)
        .setDescription(
          `${err.message || 'Please wait before opening another daily box.'}`
        )
        .setFooter({ text: 'VC Arena • Daily crates reset every 24h' });

      await message.reply({ embeds: [embed] });
    }
    return;
  }

  // 4. MATCHES / LOBBIES
  if (['matches', 'm', 'match', 'lobbies', 'games'].includes(commandName)) {
    const matches = MatchService.getOpenMatches();

    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Match Schedule`)
      .setDescription(
        'Browse open tournament lobbies and lock in your predictions before betting closes!'
      );

    if (matches.length === 0) {
      embed.addFields({
        name: 'No Active Lobbies Open',
        value: 'All current matches are locked or settled. Check back soon for the next tournament schedule!',
      });
    } else {
      for (const m of matches) {
        const deadlineTimestamp = Math.floor(m.deadline / 1000);
        const scheduledTimestamp = Math.floor(m.scheduled_time / 1000);
        const teamsDisplay = m.participating_teams
          .slice(0, 8)
          .map((t) => formatTeamWithEmoji(t, message.guild || undefined))
          .join(', ');

        embed.addFields({
          name: `📍 Match #${m.match_number}: ${m.lobby_name}`,
          value:
            `• ⏰ **Market Locks:** <t:${deadlineTimestamp}:R> (<t:${scheduledTimestamp}:t>)\n` +
            `• 🛡️ **Participating Crews (${m.participating_teams.length}):**\n` +
            `  ${teamsDisplay}${m.participating_teams.length > 8 ? '...' : ''}\n` +
            `• 🎯 **Available Brackets:** \`#1 (Winner)\`, \`#2-3\`, \`#3-5\`, \`#5-10\`, \`#11-16\``,
          inline: false,
        });
      }
    }

    embed.setFooter({ text: `iGRI Esports • Use ${configuredPrefix}predict or click buttons below!` });

    const actionRow = new ActionRowBuilder<ButtonBuilder>();
    if (matches.length > 0) {
      for (const m of matches.slice(0, 4)) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`btn_predict_match_${m.id}`)
            .setLabel(`Predict Match #${m.match_number}`)
            .setStyle(ButtonStyle.Success)
            .setEmoji('🎯')
        );
      }
    }
    actionRow.addComponents(
      new ButtonBuilder().setCustomId('user_ui_home').setLabel('Arena Terminal').setStyle(ButtonStyle.Secondary).setEmoji('🏠')
    );

    await message.reply({ embeds: [embed], components: [actionRow] });
    return;
  }

  // 5. MY TICKETS / SLIPS
  if (['mytickets', 'tickets', 'slips', 'my', 't'].includes(commandName)) {
    const tickets = PredictionService.getUserTickets(message.author.id, 5);

    if (tickets.length === 0) {
      const embed = new EmbedBuilder()
        .setColor('#95A5A6')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} 🎫 Your Prediction Slips`)
        .setDescription(`You have not submitted any prediction tickets yet! Use \`${configuredPrefix}predict\` to build your first combo slip.`);

      await message.reply({ embeds: [embed] });
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
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} 🎫 Slip #${ticket.id} — ${statusText}`)
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
          const bracketPretty = bDef ? bDef.label : leg.market_type;
          const teamFormatted = formatTeamWithEmoji(leg.selected_target, message.guild || undefined);

          return `• ${emoji} **${bracketPretty}:** ${teamFormatted} (\`${leg.locked_odds}x\`) • *${matchTitle}*`;
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

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(shareButton);

    await message.reply({ embeds: embeds.slice(0, 3), components: [row] });
    return;
  }

  // 6. LEADERBOARD
  if (['leaderboard', 'lb', 'top', 'ranks', 'ranking'].includes(commandName)) {
    const rankings = LeaderboardService.getRankings(10);
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
        value: `Start making predictions with \`${configuredPrefix}predict\` to join the board!`,
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

    await message.reply({ embeds: [embed] });
    return;
  }

  // 7. SHOP / STORE
  if (['shop', 'store', 's', 'boutique'].includes(commandName)) {
    const shopUI = UserUI.buildShopUI(message.author.id, message.author.username);
    await message.reply({ embeds: [shopUI.embed], components: shopUI.rows });
    return;
  }

  // 8. BUY SHOP ITEM
  if (['buy', 'purchase'].includes(commandName)) {
    const itemId = args[0]?.trim();
    if (!itemId) {
      await message.reply(`❌ Please specify which item ID to buy (e.g. \`${configuredPrefix}buy title_oracle\`). View items with \`${configuredPrefix}shop\`.`);
      return;
    }

    try {
      const result = ShopService.buyItem(message.author.id, message.author.username, itemId);

      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle('🎉 Purchase Successful!')
        .setDescription(`You acquired **${result.item.name}** for **${result.item.cost.toLocaleString()} coins**!`)
        .addFields({ name: 'New Balance', value: `**${result.newBalance.toLocaleString()}** coins`, inline: true })
        .setFooter({ text: `Check your passport with ${configuredPrefix}profile` });

      await message.reply({ embeds: [embed] });
    } catch (err: any) {
      await message.reply(`❌ Purchase Failed: ${err.message}`);
    }
    return;
  }

  // 9. FANBASE / CREW
  if (['fanbase', 'crew', 'team'].includes(commandName)) {
    const teams = TeamGroupService.getAllTeams();
    const member = message.guild.members.cache.get(message.author.id);
    const userTeam = FanService.getUserTeamRole(member);

    const embed = new EmbedBuilder()
      .setColor('#E91E63')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Crew Allegiance`)
      .setDescription(
        userTeam
          ? `You are representing **<@&${userTeam.roleId}>**!`
          : `You do not have a crew allegiance role yet. Assign a team role in the server to represent your squad!`
      )
      .addFields({
        name: `Registered Tournament Teams (${teams.length})`,
        value:
          teams
            .slice(0, 15)
            .map((t) => formatTeamWithEmoji(t.name, message.guild || undefined))
            .join(', ') + (teams.length > 15 ? '...' : ''),
      })
      .setFooter({ text: 'iGRI Esports • Represent your squad with pride!' });

    await message.reply({ embeds: [embed] });
    return;
  }

  // 10. PREDICT / BET (COMBO SLIPS)
  if (['predict', 'p', 'bet', 'slip'].includes(commandName)) {
    if (args.length === 0) {
      const openMatches = MatchService.getOpenMatches();
      if (openMatches.length > 0) {
        const builderUI = UserUI.buildSlipBuilder(openMatches[0], undefined, undefined, 200);
        await message.reply({ embeds: [builderUI.embed], components: builderUI.rows });
        return;
      }
    }

    if (args.length === 0 || args[0]?.toLowerCase() === 'help') {
      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle('🎟️ How to Predict with Prefix Command')
        .setDescription(
          `**Usage:**\n` +
          `\`${configuredPrefix}predict <stake> <team1> <team2> [team3] [team4] [team5]\`\n\n` +
          `• **Position Order:**\n` +
          `  1. 🥇 **#1 Winner (Champion):** 1st team entered\n` +
          `  2. 🥈 **#2 - #3 Podium:** 2nd team entered\n` +
          `  3. 🎖️ **#3 - #5 Top 5:** 3rd team entered *(optional)*\n` +
          `  4. 🎯 **#5 - #10 Top 10:** 4th team entered *(optional)*\n` +
          `  5. 💀 **#11 - #16 Placement:** 5th team entered *(optional)*\n\n` +
          `• **Key Rules:**\n` +
          `  - Must pick **at least 2 distinct position brackets**\n` +
          `  - **One team cannot be repeated** in multiple brackets on the same slip\n` +
          `  - Stake must be between **50 and 1,000 coins**\n\n` +
          `**Examples:**\n` +
          `\`${configuredPrefix}predict 200 NXT8, REDLINE\`\n` +
          `\`${configuredPrefix}predict 500 NXT8, REDLINE, Pew Pew\`\n` +
          `*(If multiple matches are open, use \`${configuredPrefix}predict match:1 250 NXT8, REDLINE\`)*`
        );

      await message.reply({ embeds: [embed] });
      return;
    }

    // Parse match override if user passed match:X or m:X
    let matchOverride: number | null = null;
    let filteredArgs = [...args];

    const matchTokenIdx = filteredArgs.findIndex((a) => /^m(atch)?:/i.test(a));
    if (matchTokenIdx !== -1) {
      const matchToken = filteredArgs[matchTokenIdx];
      const matchVal = parseInt(matchToken.split(':')[1], 10);
      if (!isNaN(matchVal)) matchOverride = matchVal;
      filteredArgs.splice(matchTokenIdx, 1);
    }

    // Resolve Match
    const openMatches = MatchService.getOpenMatches();
    let targetMatch: any = null;

    if (matchOverride !== null) {
      targetMatch = openMatches.find((m) => m.match_number === matchOverride || m.id === matchOverride);
      if (!targetMatch) {
        await message.reply(`❌ Match #${matchOverride} is not open for prediction. Check open lobbies with \`${configuredPrefix}matches\`.`);
        return;
      }
    } else {
      if (openMatches.length === 1) {
        targetMatch = openMatches[0];
      } else if (openMatches.length === 0) {
        await message.reply('❌ There are currently no open tournament matches for prediction. Check back soon!');
        return;
      } else {
        await message.reply(
          `⚠️ Multiple matches are open! Please specify which match:\n` +
          openMatches.map((m) => `• \`${configuredPrefix}predict match:${m.match_number} <stake> <teams...>\` (**${m.lobby_name}**)`).join('\n')
        );
        return;
      }
    }

    // Extract Stake
    const stakeIdx = filteredArgs.findIndex((a) => /^\d+$/.test(a));
    if (stakeIdx === -1) {
      await message.reply(`❌ Please specify a stake amount between 50 and 1,000 coins (e.g. \`${configuredPrefix}predict 250 NXT8, REDLINE\`).`);
      return;
    }

    const stake = parseInt(filteredArgs[stakeIdx], 10);
    filteredArgs.splice(stakeIdx, 1);

    if (stake < config.economy.minTicketStake || stake > config.economy.maxTicketStake) {
      await message.reply(`❌ Stake must be between **${config.economy.minTicketStake}** and **${config.economy.maxTicketStake}** coins.`);
      return;
    }

    // Extract Teams
    const remainingText = filteredArgs.join(' ');
    const participatingTeams = targetMatch.participating_teams as string[];

    let rawTeamPicks: string[] = [];

    // Check if user separated teams with commas
    if (remainingText.includes(',')) {
      rawTeamPicks = remainingText.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
    } else {
      // Find matching participating teams in the input text in order of appearance
      // Sort teams by length descending to match multi-word teams first (e.g. "Guns n roses" before "Guns")
      const sortedTeams = [...participatingTeams].sort((a, b) => b.length - a.length);
      let scanText = remainingText;

      const foundPicks: { team: string; index: number }[] = [];
      for (const t of sortedTeams) {
        const regex = new RegExp(`\\b${t.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&')}\\b`, 'i');
        const match = scanText.match(regex);
        if (match && match.index !== undefined) {
          foundPicks.push({ team: t, index: match.index });
          // Blank out matched team in scanText so words aren't double counted
          scanText = scanText.slice(0, match.index) + ' '.repeat(match[0].length) + scanText.slice(match.index + match[0].length);
        }
      }

      foundPicks.sort((a, b) => a.index - b.index);
      rawTeamPicks = foundPicks.map((p) => p.team);

      // If regex boundary failed on special characters, fallback to token split
      if (rawTeamPicks.length === 0) {
        rawTeamPicks = filteredArgs;
      }
    }

    // Match each pick to official participating teams
    const resolvedTeams: string[] = [];
    for (const raw of rawTeamPicks) {
      const cleanRaw = raw.trim().toLowerCase();
      const matched = participatingTeams.find((t) => t.toLowerCase() === cleanRaw || t.toLowerCase().includes(cleanRaw));
      if (matched) {
        resolvedTeams.push(matched);
      }
    }

    if (resolvedTeams.length < 1) {
      await message.reply(
        `❌ **Could not identify any valid participating teams** in your input: "${remainingText}"\n` +
        `• Participating teams in Match #${targetMatch.match_number}: ${participatingTeams.slice(0, 12).join(', ')}...\n` +
        `• Tip: Example: \`${configuredPrefix}predict ${stake} Goat protocol\` or \`${configuredPrefix}predict ${stake} Goat protocol, Whiffgods\``
      );
      return;
    }

    // Rule: "one team cannot be repeated"
    const lowerSet = new Set(resolvedTeams.map((t) => t.toLowerCase()));
    if (lowerSet.size !== resolvedTeams.length) {
      await message.reply(`❌ **Duplicate Team Rule:** You cannot repeat the same team in multiple brackets on one slip! Each position must have a distinct team.`);
      return;
    }

    // Map to position brackets: #1, 2-3, 3-5, 5-10, 11-16
    const bracketOrder: { type: MarketType; label: string }[] = [
      { type: 'POS_1', label: '🥇 #1 (Winner)' },
      { type: 'POS_2_3', label: '🥈 #2 - #3' },
      { type: 'POS_3_5', label: '🎖️ #3 - #5' },
      { type: 'POS_5_10', label: '🎯 #5 - #10' },
      { type: 'POS_11_16', label: '💀 #11 - #16' },
    ];

    const legsDraft: LegDraft[] = resolvedTeams.slice(0, 5).map((teamName, idx) => ({
      matchId: targetMatch.id,
      marketType: bracketOrder[idx].type,
      selectedTarget: teamName,
    }));

    try {
      const ticket = PredictionService.submitTicket(
        message.author.id,
        message.author.username,
        stake,
        legsDraft
      );

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} Combo Slip #${ticket.id} Confirmed`)
        .setDescription(
          `Predictions for **${targetMatch.lobby_name}** locked in! Good luck, **${message.author.username}**.`
        )
        .addFields(
          { name: '🪙 Stake', value: `**${ticket.stake.toLocaleString()}** coins`, inline: true },
          { name: '⚡ Multiplier', value: `\`${(ticket.combo_weight / ticket.stake).toFixed(2)}x\``, inline: true },
          { name: '🏟️ Lobby', value: targetMatch.lobby_name, inline: true }
        );

      ticket.legs?.forEach((leg, idx) => {
        const bracketObj = bracketOrder.find((b) => b.type === leg.market_type);
        const bracketLabel = bracketObj ? bracketObj.label : leg.market_type;
        const teamFormatted = formatTeamWithEmoji(leg.selected_target, message.guild || undefined);

        embed.addFields({
          name: `Selection ${idx + 1}: ${bracketLabel}`,
          value: `${teamFormatted}\n📊 Locked Odds: \`${leg.locked_odds}x\``,
          inline: true,
        });
      });

      embed.setFooter({ text: 'VC Arena • Multi-bracket combo slip' });

      const copyButton = new ButtonBuilder()
        .setCustomId(`copy_ticket_${ticket.id}`)
        .setLabel('Copy This Ticket')
        .setStyle(ButtonStyle.Success)
        .setEmoji('📋');

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(copyButton);

      await message.reply({ embeds: [embed], components: [row] });
    } catch (err: any) {
      await message.reply(`❌ Submission Failed: ${err.message || 'An error occurred while placing your combo ticket.'}`);
    }
    return;
  }

  // 10.5 DIRECT ADMIN BALANCE COMMAND (!addbalance, !givecoins, !addcoins)
  if (['addbalance', 'givecoins', 'addcoins', 'givebalance', 'grantcoins'].includes(commandName)) {
    if (!AdminRoleService.isUserAdmin(message.member)) {
      const allowedRoles = AdminRoleService.getAdminRoles();
      await message.reply(`🚫 **Access Denied:** You need an administrator role to run this command.\nAuthorized roles: \`${allowedRoles.join('`, `')}\``);
      return;
    }

    const targetUser = message.mentions.users?.first();
    let recipientId = targetUser?.id;
    let recipientUsername = targetUser?.username;

    if (!recipientId && args[0] && /^\d{17,20}$/.test(args[0])) {
      recipientId = args[0];
      try {
        const fetchedUser = await message.client.users.fetch(recipientId);
        if (fetchedUser) recipientUsername = fetchedUser.username;
      } catch {
        recipientUsername = `User_${recipientId.slice(-4)}`;
      }
    }

    if (!recipientId || !recipientUsername) {
      await message.reply(`Usage: \`${configuredPrefix}${commandName} @player <amount> [reason]\`\nExample: \`${configuredPrefix}${commandName} @Player 5000 Event reward\``);
      return;
    }

    const amountStr = args.find((a) => !a.startsWith('<@') && !isNaN(parseInt(a, 10)) && parseInt(a, 10) > 0);
    const amount = amountStr ? parseInt(amountStr, 10) : 0;

    if (amount <= 0) {
      await message.reply('❌ Please specify a valid amount of coins greater than 0.');
      return;
    }

    const reasonParts = args.filter((a) => a !== amountStr && !a.startsWith('<@') && a !== recipientId);
    const reason = reasonParts.join(' ') || 'Admin grant';

    try {
      const result = UserService.addBalance(recipientId, recipientUsername, amount, message.author.id, reason);

      const embed = new EmbedBuilder()
        .setColor('#57F287')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} Coins Added Successfully`)
        .setDescription(
          `Added **+${amount.toLocaleString()} coins** to <@${recipientId}>.`
        )
        .addFields(
          { name: '👤 Recipient', value: `**${recipientUsername}**`, inline: true },
          { name: '💳 Previous Balance', value: `${result.oldBalance.toLocaleString()} coins`, inline: true },
          { name: '💰 New Balance', value: `${result.newBalance.toLocaleString()} coins`, inline: true },
          { name: '📝 Reason', value: reason, inline: true },
          { name: '👑 Admin', value: `<@${message.author.id}>`, inline: true }
        )
        .setFooter({ text: 'VC Arena • Balance credited' })
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (err: any) {
      await message.reply(`❌ Failed to add coins: ${err.message}`);
    }
    return;
  }

  // 11. ADMIN COMMANDS VIA PREFIX
  if (commandName === 'admin' || ['panel', 'pannel', 'adminpanel', 'adminpannel', 'admindash'].includes(commandName)) {
    if (!AdminRoleService.isUserAdmin(message.member)) {
      const allowedRoles = AdminRoleService.getAdminRoles();
      await message.reply(`🚫 **Access Denied:** You need an administrator role to run admin commands.\nAuthorized roles: \`${allowedRoles.join('`, `')}\``);
      return;
    }

    const adminSub = commandName === 'admin' ? args[0]?.toLowerCase() : 'panel';

    // Interactive Admin Control Panel (Default, panel, pannel, menu, hub, control, dashboard)
    if (!adminSub || ['panel', 'pannel', 'menu', 'hub', 'control', 'dashboard'].includes(adminSub)) {
      const embed = AdminUI.buildPanelEmbed(message.guild);
      const rows = AdminUI.buildPanelComponents();
      await message.reply({ embeds: [embed], components: rows });
      return;
    }

    // Admin Help (Manual commands)
    if (adminSub === 'help') {
      const embed = new EmbedBuilder()
        .setColor('#E67E22')
        .setTitle('⚙️ Tournament Administrator Commands Reference')
        .setDescription(
          `💡 **Tip:** Simply type \`${configuredPrefix}admin\` without arguments to open the **Interactive Control Panel** with 1-click buttons!\n\n` +
          `**Manual Commands:**\n` +
          `• \`${configuredPrefix}admin addbalance @player <amount> [reason]\` — Grant virtual coins to a player\n` +
          `• \`${configuredPrefix}admin match-create-all <match_num> <lobby_name> <deadline_mins>\` — Open match with all 43 teams\n` +
          `• \`${configuredPrefix}admin match-list\` — List season matches\n` +
          `• \`${configuredPrefix}admin result <team1, team2, ...>\` — Settle match with 1st-to-16th standings\n` +
          `• \`${configuredPrefix}admin cancel [reason]\` — Cancel match (Void Leg rule)\n` +
          `• \`${configuredPrefix}admin group-list\` — View tournament groups\n` +
          `• \`${configuredPrefix}admin group-reset\` — Reset all teams to ungrouped\n` +
          `• \`${configuredPrefix}admin role-list\` — View admin roles\n` +
          `• \`${configuredPrefix}admin role-add <role>\` — Add admin role\n` +
          `• \`${configuredPrefix}admin audit\` — Telemetry & economy audit\n` +
          `• \`${configuredPrefix}admin season-settle\` — Distribute pool & conclude season`
        );
      await message.reply({ embeds: [embed] });
      return;
    }

    // Add Balance to Player
    if (adminSub === 'addbalance' || adminSub === 'add-balance' || adminSub === 'givecoins' || adminSub === 'give') {
      const targetUser = message.mentions.users?.first();
      let recipientId = targetUser?.id;
      let recipientUsername = targetUser?.username;
      const subArgs = args.slice(1);

      if (!recipientId && subArgs[0] && /^\d{17,20}$/.test(subArgs[0])) {
        recipientId = subArgs[0];
        try {
          const fetchedUser = await message.client.users.fetch(recipientId);
          if (fetchedUser) recipientUsername = fetchedUser.username;
        } catch {
          recipientUsername = `User_${recipientId.slice(-4)}`;
        }
      }

      if (!recipientId || !recipientUsername) {
        await message.reply(`Usage: \`${configuredPrefix}admin addbalance @player <amount> [reason]\`\nExample: \`${configuredPrefix}admin addbalance @Player 5000 Event reward\``);
        return;
      }

      const amountStr = subArgs.find((a) => !a.startsWith('<@') && !isNaN(parseInt(a, 10)) && parseInt(a, 10) > 0);
      const amount = amountStr ? parseInt(amountStr, 10) : 0;

      if (amount <= 0) {
        await message.reply('❌ Please specify a valid amount of coins greater than 0.');
        return;
      }

      const reasonParts = subArgs.filter((a) => a !== amountStr && !a.startsWith('<@') && a !== recipientId);
      const reason = reasonParts.join(' ') || 'Admin grant';

      try {
        const result = UserService.addBalance(recipientId, recipientUsername, amount, message.author.id, reason);

        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle(`${SERVER_EMOJIS.VC_BADGE} Coins Added Successfully`)
          .setDescription(
            `Added **+${amount.toLocaleString()} coins** to <@${recipientId}>.`
          )
          .addFields(
            { name: '👤 Recipient', value: `**${recipientUsername}**`, inline: true },
            { name: '💳 Previous Balance', value: `${result.oldBalance.toLocaleString()} coins`, inline: true },
            { name: '💰 New Balance', value: `${result.newBalance.toLocaleString()} coins`, inline: true },
            { name: '📝 Reason', value: reason, inline: true },
            { name: '👑 Admin', value: `<@${message.author.id}>`, inline: true }
          )
          .setFooter({ text: 'VC Arena • Balance credited' })
          .setTimestamp();

        await message.reply({ embeds: [embed] });
      } catch (err: any) {
        await message.reply(`❌ Failed to add coins: ${err.message}`);
      }
      return;
    }

    // Role list
    if (adminSub === 'role-list') {
      const roles = AdminRoleService.getAdminRoles();
      await message.reply(`🛡️ **Authorized Administrator Roles:**\n${roles.map((r) => `• **${r}**`).join('\n')}`);
      return;
    }

    // Role add
    if (adminSub === 'role-add') {
      const roleName = args.slice(1).join(' ').trim();
      if (!roleName) {
        await message.reply(`Usage: \`${configuredPrefix}admin role-add <role_name>\``);
        return;
      }
      AdminRoleService.addAdminRole(roleName);
      await message.reply(`✅ Added \`${roleName}\` to authorized administrator roles.`);
      return;
    }

    // Role remove
    if (adminSub === 'role-remove') {
      const roleName = args.slice(1).join(' ').trim();
      if (!roleName) {
        await message.reply(`Usage: \`${configuredPrefix}admin role-remove <role_name>\``);
        return;
      }
      const removed = AdminRoleService.removeAdminRole(roleName);
      if (removed) {
        await message.reply(`✅ Removed \`${roleName}\` from administrator access.`);
      } else {
        await message.reply(`⚠️ Role \`${roleName}\` was not found in the administrator list.`);
      }
      return;
    }

    // Group list
    if (adminSub === 'group-list') {
      const groups = TeamGroupService.getGroupsSummary();
      const embed = new EmbedBuilder()
        .setColor('#9B59B6')
        .setTitle(`${SERVER_EMOJIS.VC_BADGE} Tournament Groups Overview`)
        .setDescription('Official tournament groups and team assignments:');

      for (const [groupName, teamsList] of Object.entries(groups)) {
        const teamsFormatted = teamsList.length > 0
          ? teamsList.map((t) => formatTeamWithEmoji(t, message.guild || undefined)).join(', ')
          : '*No teams assigned*';

        embed.addFields({
          name: `📁 ${groupName} (${teamsList.length} teams)`,
          value: teamsFormatted,
          inline: false,
        });
      }
      await message.reply({ embeds: [embed] });
      return;
    }

    // Group reset
    if (adminSub === 'group-reset') {
      const count = TeamGroupService.resetAllGroups();
      await message.reply(`🔄 Successfully reset **${count} teams** back to **UNGROUPED**.`);
      return;
    }

    // Group Set (Select Roles or Mention Roles)
    if (adminSub === 'group-set') {
      const groupName = args[1]?.trim();
      if (!groupName) {
        await message.reply(`Usage: \`${configuredPrefix}admin group-set <group_name> [@role1 @role2...]\`\nExample: \`${configuredPrefix}admin group-set "Group A"\``);
        return;
      }

      // 1. Check if roles were mentioned in the message
      const mentionedRoles = Array.from(message.mentions.roles.values());
      if (mentionedRoles.length > 0) {
        const matchedTeams: string[] = [];
        const unmatchedRoleNames: string[] = [];

        for (const role of mentionedRoles) {
          if (FanService.isSystemRole(role.name)) {
            unmatchedRoleNames.push(role.name);
            continue;
          }

          const teamName = FanService.matchRoleToTeam(role) || role.name.trim();
          if (!matchedTeams.includes(teamName)) {
            matchedTeams.push(teamName);
          }
        }

        if (matchedTeams.length === 0) {
          await message.reply(`❌ Only system/bot roles were mentioned. Please mention team roles.`);
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
            value: result.assigned.map((t) => `• ${formatTeamWithEmoji(t, message.guild || undefined)}`).join('\n'),
          })
          .setFooter({ text: 'VC Arena • Group configured' });

        if (unmatchedRoleNames.length > 0) {
          embed.addFields({ name: 'ℹ️ Non-Team Roles Ignored', value: unmatchedRoleNames.map(r => `@${r}`).join(', ') });
        }
        await message.reply({ embeds: [embed] });
        return;
      }

      // 2. Check if text team names were passed: !admin group-set "Group C" Team A, Team B...
      const rawTextArgs = args.slice(2).join(' ').trim();
      if (rawTextArgs.length > 0) {
        const items = rawTextArgs.split(',').map((t) => t.trim()).filter((t) => t.length > 0);
        const matchedTeams: string[] = [];

        for (const item of items) {
          const directTeam = TeamGroupService.findTeam(item);
          if (directTeam && !matchedTeams.includes(directTeam.name)) {
            matchedTeams.push(directTeam.name);
          } else if (item.length > 0 && !FanService.isSystemRole(item)) {
            const clean = item.replace(/^@/, '').trim();
            if (!matchedTeams.includes(clean)) {
              matchedTeams.push(clean);
            }
          }
        }

        if (matchedTeams.length > 0) {
          const result = TeamGroupService.assignTeamsToGroup(groupName, matchedTeams);
          const embed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle(`${SERVER_EMOJIS.VC_BADGE} Group Configured: ${groupName}`)
            .setDescription(
              `Assigned **${result.assigned.length} teams** to **${groupName}**:`
            )
            .addFields({
              name: `📁 Teams in ${groupName}`,
              value: result.assigned.map((t) => `• ${formatTeamWithEmoji(t, message.guild || undefined)}`).join('\n'),
            })
            .setFooter({ text: 'VC Arena • Group configured' });
          await message.reply({ embeds: [embed] });
          return;
        }
      }

      // 2. Otherwise send native Discord RoleSelectMenuBuilder!
      const roleMenu = new RoleSelectMenuBuilder()
        .setCustomId(`select_group_roles:${groupName}`)
        .setPlaceholder(`Select team roles for ${groupName}...`)
        .setMinValues(1)
        .setMaxValues(25);

      const row = new ActionRowBuilder<RoleSelectMenuBuilder>().addComponents(roleMenu);

      const embed = new EmbedBuilder()
        .setColor('#3498DB')
        .setTitle(`📁 Assign Team Roles to ${groupName}`)
        .setDescription(
          `Click the role picker below to select all the team roles for **${groupName}**.\n` +
          `• You can select up to **25 roles at once**!\n` +
          `• No need to type team names manually — just pick their roles from the dropdown.`
        )
        .setFooter({ text: 'Select team roles below' });

      await message.reply({ embeds: [embed], components: [row] });
      return;
    }

    // Match Create All 43 Teams
    if (adminSub === 'match-create-all') {
      const matchNum = parseInt(args[1], 10);
      const deadlineMins = parseInt(args[args.length - 1], 10);
      const lobbyName = args.slice(2, args.length - 1).join(' ') || 'Arena Lobby';

      if (isNaN(matchNum) || isNaN(deadlineMins)) {
        await message.reply(`Usage: \`${configuredPrefix}admin match-create-all <match_number> <lobby_name> <deadline_minutes>\`\nExample: \`${configuredPrefix}admin match-create-all 1 Erangel 60\``);
        return;
      }

      const allRegisteredTeams = TeamGroupService.getAllTeams().map((t) => t.name);
      const now = Date.now();
      const scheduledTime = now + deadlineMins * 60 * 1000;

      const match = MatchService.createMatch(matchNum, `${lobbyName} (All 43 Teams)`, scheduledTime, scheduledTime, allRegisteredTeams, allRegisteredTeams);
      await message.reply(`🌐 **Created All-43-Teams Match #${match.match_number}:** ${match.lobby_name} (Locks in ${deadlineMins}m). Players can now predict!`);
      return;
    }

    // Match list
    if (adminSub === 'match-list') {
      const season = MatchService.getActiveSeason();
      const matches = MatchService.getAllSeasonMatches(season.id);
      const embed = new EmbedBuilder().setColor('#3498DB').setTitle(`📋 Matches (${season.name})`);

      if (matches.length === 0) {
        embed.setDescription('No matches created yet.');
      } else {
        matches.forEach((m) => {
          embed.addFields({
            name: `Match #${m.match_number}: ${m.lobby_name} [${m.status}]`,
            value: `Locks: <t:${Math.floor(m.deadline / 1000)}:R> • Teams: ${m.participating_teams.length}`,
          });
        });
      }
      await message.reply({ embeds: [embed] });
      return;
    }

    // Result
    if (adminSub === 'result') {
      let resultText = args.slice(1).join(' ').trim();
      const attachedImage = message.attachments.first()?.url;
      let finalImageUrl = attachedImage;

      const urlMatch = resultText.match(/(https?:\/\/[^\s]+)/i);
      if (urlMatch) {
        if (!finalImageUrl) finalImageUrl = urlMatch[1];
        resultText = resultText.replace(urlMatch[0], '').trim();
      }

      if (!resultText && !finalImageUrl) {
        await message.reply(
          `Usage: \`${configuredPrefix}admin result <team1, team2, ...> [attach scoreboard photo]\`\n` +
          `Example: \`${configuredPrefix}admin result NXT8, REDLINE, Pew Pew\` (or upload standing screenshot with command)`
        );
        return;
      }

      if (!resultText && finalImageUrl) {
        await message.reply({
          content:
            `📸 **Scoreboard/Standing photo received!**\n` +
            `Please specify at least the 1st place champion to finalize settlement, e.g.:\n` +
            `\`${configuredPrefix}admin result <Winning Team> [2nd, 3rd...]\``,
        });
        return;
      }

      const openOrLockedMatches = db.prepare("SELECT * FROM matches WHERE status IN ('OPEN', 'LOCKED') ORDER BY id DESC").all() as any[];
      if (openOrLockedMatches.length === 0) {
        await message.reply('❌ No active open or locked matches found to settle.');
        return;
      }
      const targetMatch = openOrLockedMatches[0];

      const standings = resultText.split(',').map((s) => s.trim()).filter((s) => s.length > 0);
      if (standings.length === 0) {
        await message.reply('❌ Please provide at least the winning team.');
        return;
      }

      try {
        const outcome = SettlementService.recordMatchResult(
          targetMatch.id,
          standings,
          undefined,
          undefined,
          finalImageUrl
        );

        const embed = new EmbedBuilder()
          .setColor('#57F287')
          .setTitle(`${SERVER_EMOJIS.VC_BADGE} Match #${targetMatch.match_number} Results Settled`)
          .setDescription(
            `**Lobby:** ${targetMatch.lobby_name}\n` +
            `• 🥇 **1st Place:** ${formatTeamWithEmoji(outcome.winner, message.guild || undefined)}\n` +
            `• 🥈 **2nd Place:** ${formatTeamWithEmoji(standings[1] || 'N/A', message.guild || undefined)}\n` +
            `• 🥉 **3rd Place:** ${formatTeamWithEmoji(standings[2] || 'N/A', message.guild || undefined)}`
          )
          .addFields(
            { name: '📊 Resolved Legs', value: `\`${outcome.resolvedLegsCount}\``, inline: true },
            { name: '🎫 Eliminated Slips', value: `\`${outcome.eliminatedTicketsCount}\``, inline: true }
          );

        if (finalImageUrl) {
          embed.setImage(finalImageUrl);
        }

        if (standings.length > 3) {
          const top5Formatted = standings.slice(2, 5).map((t) => formatTeamWithEmoji(t, message.guild || undefined)).join(', ');
          const top10Formatted = standings.slice(4, 10).map((t) => formatTeamWithEmoji(t, message.guild || undefined)).join(', ');
          const bottomFormatted = standings.slice(10, 16).map((t) => formatTeamWithEmoji(t, message.guild || undefined)).join(', ');

          embed.addFields(
            { name: '🎖️ #3 - #5 Placements', value: top5Formatted || 'None', inline: false },
            { name: '🎯 #5 - #10 Placements', value: top10Formatted || 'None', inline: false },
            { name: '💀 #11 - #16 Placements', value: bottomFormatted || 'None', inline: false }
          );
        }

        const winnerFields = NotificationService.formatWinnerFields(outcome);
        embed.addFields(winnerFields);

        embed.setFooter({ text: 'iGRI Esports • Winnings credited to player wallets in real-time!' });
        const pingContent = NotificationService.getWinnerMentionContent(outcome);
        await message.reply({ content: pingContent, embeds: [embed] });

        // Dispatch DMs to winning and eliminated predictors
        await NotificationService.notifyMatchResults(message.client, outcome);
      } catch (err: any) {
        await message.reply(`❌ Settlement Error: ${err.message}`);
      }
      return;
    }

    // Cancel match
    if (adminSub === 'cancel') {
      const reason = args.slice(1).join(' ') || 'Cancelled by admin';
      const openOrLockedMatches = db.prepare("SELECT * FROM matches WHERE status IN ('OPEN', 'LOCKED') ORDER BY id DESC").all() as any[];
      if (openOrLockedMatches.length === 0) {
        await message.reply('❌ No active matches found to cancel.');
        return;
      }
      const targetMatch = openOrLockedMatches[0];

      try {
        const { voidedLegs, refundedTickets } = SettlementService.cancelMatch(targetMatch.id, reason);
        await message.reply(`⚠️ **Match #${targetMatch.match_number} (${targetMatch.lobby_name}) Cancelled!**\nVoided legs (1.0x odds): \`${voidedLegs}\` | Refunded slips: \`${refundedTickets}\``);
      } catch (err: any) {
        await message.reply(`❌ Error cancelling match: ${err.message}`);
      }
      return;
    }

    // Season settle
    if (adminSub === 'season-settle') {
      const activeSeason = MatchService.getActiveSeason();
      try {
        const summary = SettlementService.settleSeason(activeSeason.id);
        await message.reply(
          `🏆 **${summary.seasonName} CONCLUDED!**\n` +
          `• Total Pool: **${summary.totalPool.toLocaleString()}** coins\n` +
          `• 5% Burned Sink: **-${summary.coinSinkAmount.toLocaleString()}** coins\n` +
          `• Distributable Pool: **${summary.distributablePool.toLocaleString()}** coins\n` +
          `• Winning Tickets: **${summary.winningTicketsCount}**\n` +
          `• Total Distributed: **${summary.totalDistributed.toLocaleString()}** coins`
        );
      } catch (err: any) {
        await message.reply(`❌ Season settlement error: ${err.message}`);
      }
      return;
    }

    // Audit
    if (adminSub === 'audit') {
      const totalUsers = (db.prepare('SELECT COUNT(*) as count FROM users').get() as any).count;
      const totalCoins = (db.prepare('SELECT SUM(balance + reserved_stake) as sum FROM users').get() as any).sum || 0;
      const totalTickets = (db.prepare('SELECT COUNT(*) as count FROM tickets').get() as any).count;
      const season = MatchService.getActiveSeason();

      await message.reply(
        `🔍 **Arena Economy Audit:**\n` +
        `• Registered Players: \`${totalUsers}\`\n` +
        `• Total Money Supply: \`${totalCoins.toLocaleString()}\` coins\n` +
        `• Active Season Pool: \`${season.total_pool.toLocaleString()}\` coins\n` +
        `• Total Slips Submitted: \`${totalTickets}\`\n` +
        `• Rollover Reserve: \`${season.rollover_amount.toLocaleString()}\` coins`
      );
      return;
    }

    await message.reply(`Unknown admin subcommand. Type \`${configuredPrefix}admin help\` for command list.`);
  }
}
