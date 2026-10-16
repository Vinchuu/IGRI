import {
  ButtonInteraction,
  EmbedBuilder,
  StringSelectMenuInteraction,
} from 'discord.js';
import { PredictionService } from '../services/PredictionService.js';
import { ShopService } from '../services/ShopService.js';
import { UserService } from '../services/UserService.js';
import { MatchService } from '../services/MatchService.js';
import { MysteryBoxService } from '../services/MysteryBoxService.js';
import { LeaderboardService } from '../services/LeaderboardService.js';

export async function handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
  const { customId, user } = interaction;

  // 1. Central dashboard buttons
  if (customId === 'btn_matches') {
    const matches = MatchService.getOpenMatches();
    const embed = new EmbedBuilder()
      .setColor('#00E676')
      .setTitle('🎮 Upcoming iGRI Tournament Lobbies');

    if (matches.length === 0) {
      embed.setDescription('No open lobbies currently. Stay tuned for match announcements!');
    } else {
      for (const m of matches) {
        embed.addFields({
          name: `Match #${m.match_number}: ${m.lobby_name} [ID: ${m.id}]`,
          value: `• Teams: ${m.participating_teams.join(', ')}\n• Locks: <t:${Math.floor(m.deadline / 1000)}:R>`,
        });
      }
    }
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'btn_balance') {
    const acc = UserService.getOrCreateUser(user.id, user.username);
    const embed = new EmbedBuilder()
      .setColor('#F1C40F')
      .setTitle(`💳 ${acc.username}'s Wallet`)
      .setDescription(
        `🪙 Available: **${acc.balance.toLocaleString()}** coins\n` +
        `🔒 Open Stakes: **${acc.reserved_stake.toLocaleString()}** coins\n` +
        `📈 Net Profit: **${acc.lifetime_profit.toLocaleString()}** coins`
      );
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'btn_daily') {
    try {
      const reward = MysteryBoxService.openBox(user.id, user.username);
      const embed = new EmbedBuilder()
        .setColor('#2ECC71')
        .setTitle(`${reward.tierEmoji} Daily Mystery Box!`)
        .setDescription(`You opened a **${reward.tierName}**!\nClaimed **+${reward.totalCoins.toLocaleString()}** coins!`)
        .addFields({ name: 'Streak', value: `🔥 Day ${reward.streakDays}`, inline: true });
      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err: any) {
      await interaction.reply({ content: `⏳ ${err.message}`, ephemeral: true });
    }
    return;
  }

  if (customId === 'btn_mytickets') {
    const tickets = PredictionService.getUserTickets(user.id, 3);
    if (tickets.length === 0) {
      await interaction.reply({ content: 'You have no tickets placed yet! Use `/predict` to build a combo.', ephemeral: true });
      return;
    }
    const embed = new EmbedBuilder().setColor('#3498DB').setTitle('🎫 Your Recent Slips');
    for (const t of tickets) {
      embed.addFields({
        name: `Ticket #${t.id} — Status: ${t.status}`,
        value: `Stake: \`${t.stake}\` | Weight: \`${t.combo_weight}x\` | Legs: \`${t.legs?.length || 0}\``,
      });
    }
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'btn_leaderboard') {
    const rankings = LeaderboardService.getRankings(5);
    const embed = new EmbedBuilder().setColor('#E67E22').setTitle('🏆 Top Analysts');
    const rows = rankings.map((r) => `#${r.rank} **${r.username}** — \`${r.compositeScore} pts\` (Profit: ${r.netProfit})`);
    embed.setDescription(rows.join('\n') || 'No players yet.');
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'btn_shop') {
    const items = ShopService.getItems();
    const embed = new EmbedBuilder().setColor('#3498DB').setTitle('🛍️ Vanity Boutique');
    items.forEach((item) => {
      embed.addFields({ name: `${item.badge_emoji || '🏷️'} ${item.name}`, value: `Cost: **${item.cost.toLocaleString()}** coins\n${item.description}` });
    });
    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  // Help Menu Buttons
  if (customId === 'help_player_cmds') {
    const embed = new EmbedBuilder()
      .setColor('#3498DB')
      .setTitle('🎮 Player Commands Reference')
      .setDescription('All commands available to every competitor in the arena:')
      .addFields(
        { name: '🕹️ `/igri`', value: 'Opens the main interactive dashboard with quick-action buttons.' },
        { name: '🎮 `/matches`', value: 'Browse upcoming open tournament lobbies, participating crews, and deadlines.' },
        { name: '🎯 `/predict`', value: 'Build a 2 to 5 match combo prediction ticket (with auto-suggested team names!).' },
        { name: '🎫 `/mytickets`', value: 'Live ticket tracker showing progress on all your active and settled combo slips.' },
        { name: '💳 `/balance`', value: 'Check your virtual coin balance, reserved open stakes, and transaction history.' },
        { name: '🎁 `/daily`', value: 'Open your 24-hour Daily Mystery Box for bonus coins & login streak multipliers.' },
        { name: '🏆 `/profile [user]`', value: 'Inspect your or another player’s dossier, accuracy %, badges, and crew role.' },
        { name: '📊 `/leaderboard`', value: 'Official ranked season standings: 60% Profit Score + 40% Accuracy Score.' },
        { name: '⚔️ `/fanbase`', value: 'The Fanbase / Crew War leaderboard comparing team supporters across the server.' },
        { name: '🛍️ `/shop`', value: 'Spend surplus coins on exclusive titles, profile badges, and Discord roles.' }
      )
      .setFooter({ text: 'iGRI Fantasy Arena • Start predicting today!' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'help_fanbase_guide') {
    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle('🛡️ Crew Allegiance & Fanbase War Guide')
      .setDescription(
        '**Represent your favorite squad in the tournament!**\n\n' +
        '1️⃣ **Get Your Team Role:**\n' +
        'Grab the Discord role for your crew in this server (e.g. `@NXT8`, `@REDLINE`, `@Pew Pew`, etc.).\n\n' +
        '2️⃣ **Automatic Dossier Allegiance:**\n' +
        'When anyone views your `/profile`, the bot automatically proudly displays your team role!\n\n' +
        '3️⃣ **Compete in the Fanbase Wars (`/fanbase`):**\n' +
        'All your winning prediction profits and accuracy stats contribute to your team’s total fanbase score on the `/fanbase` leaderboard!\n\n' +
        '4️⃣ **One-Click Slip Copying:**\n' +
        'When your teammates share their winning slips in chat, click **`[ 📋 Copy Ticket ]`** to back the exact same picks with 1 click!'
      )
      .setFooter({ text: 'May the sharpest crew win the arena!' });

    await interaction.reply({ embeds: [embed], ephemeral: true });
    return;
  }

  if (customId === 'help_admin_guide') {
    const embed = new EmbedBuilder()
      .setColor('#E67E22')
      .setTitle('⚙️ Tournament Administrator Guide')
      .setDescription(
        '**Authorized Roles:** Server Administrators or members with roles: **`.`**, **`...`**, or **`Crew`** (or added via `/admin role-add`).\n\n' +
        '**Step 1: Set up Groups**\n' +
        '• Run `/admin group-auto-split groups_count: 3` to divide all 43 teams into balanced groups (Group A, B, C).\n\n' +
        '**Step 2: Create Match Lobbies**\n' +
        '• Run `/admin match-create-groups group1: "Group A" group2: "Group B"` to automatically pull participating teams and open the market.\n\n' +
        '**Step 3: Declare Results After Every Match**\n' +
        '• When the match finishes in FiveM, declare results immediately:\n' +
        '  `/admin result match_id: 1 winner_1st: NXT8 second_2nd: REDLINE third_3rd: Pew Pew top_fragger: NXT8`\n' +
        '  *(The bot instantly marks all active player slips as won or lost!)*\n\n' +
        '**Step 4: Season / Day Settlement**\n' +
        '• At the end of the tournament day, run `/admin season-settle` to burn the 5% sink and distribute winnings directly into players’ balances!'
      );

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
      .setTitle(`🚨 HIGH ROLLER SLIP: ${interaction.user.username}`)
      .setDescription(
        `**${interaction.user.username}** is backing a **${ticket.legs?.length}-leg combo**!\n` +
        `• **Stake:** \`${ticket.stake.toLocaleString()}\` coins\n` +
        `• **Combo Weight:** \`${ticket.combo_weight}x\`\n` +
        `• **Status:** \`${ticket.status}\``
      );

    ticket.legs?.forEach((l, i) => {
      const match = MatchService.getMatchById(l.match_id);
      flexEmbed.addFields({
        name: `Leg ${i + 1}: ${match ? match.lobby_name : `Match #${l.match_id}`}`,
        value: `Pick: **${l.selected_target}** (${l.market_type}) • Odds: \`${l.locked_odds}x\``,
        inline: true,
      });
    });

    await interaction.reply({ embeds: [flexEmbed] });
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
        .setColor('#2ECC71')
        .setTitle('📋 Slip Cloned Successfully!')
        .setDescription(
          `You copied <@${originalTicket.user_id}>'s predictions!\n` +
          `• **New Ticket ID:** \`#${newTicket.id}\`\n` +
          `• **Your Stake:** \`${newTicket.stake.toLocaleString()}\` coins\n` +
          `• **Combo Weight:** \`${newTicket.combo_weight}x\``
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (err: any) {
      await interaction.reply({ content: `❌ Could not copy ticket: ${err.message}`, ephemeral: true });
    }
    return;
  }
}

export async function handleSelectMenuInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
  const { customId, user, values } = interaction;

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
  }
}
