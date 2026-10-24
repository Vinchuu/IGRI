import { Client, EmbedBuilder } from 'discord.js';
import { config } from '../config.js';
import { formatTeamWithEmoji } from '../utils/emojis.js';
import { Match, Ticket, ShopItem } from '../types/index.js';
import { MatchResultOutcome } from './SettlementService.js';
import { MysteryBoxReward } from './MysteryBoxService.js';

function formatMarketLabel(type: string): string {
  switch (type) {
    case 'POS_1':
      return 'Winner #1 🥇';
    case 'POS_2_3':
      return 'Top 2-3 🥈';
    case 'POS_3_5':
      return 'Top 3-5 🥉';
    case 'POS_5_10':
    case 'POS_6_10':
      return 'Top 5-10 🏆';
    case 'POS_11_16':
      return 'Rank 11-16 🎖️';
    default:
      return type;
  }
}

export class AuditLogService {
  private static client: Client | null = null;

  /**
   * Initializes the AuditLogService with the Discord client instance
   */
  static init(client: Client) {
    this.client = client;
  }

  /**
   * Internal sender: Safely dispatches an embed to the configured logs channel
   */
  static async send(embed: EmbedBuilder): Promise<boolean> {
    if (!this.client) {
      return false;
    }

    try {
      const channelId = config.discord.logChannelId;
      if (!channelId) return false;

      let channel: any = this.client.channels.cache.get(channelId);
      if (!channel) {
        channel = await this.client.channels.fetch(channelId).catch(() => null);
      }

      if (channel && typeof channel.send === 'function') {
        await channel.send({ embeds: [embed] }).catch((err: any) => {
          console.error(`[AuditLogService] Failed to send embed to log channel ${channelId}:`, err);
        });
        return true;
      }
    } catch (err: any) {
      console.error('[AuditLogService] Error while sending log embed:', err);
    }
    return false;
  }

  /**
   * Bot Ready & Online Log
   */
  static async logBotReady(client: Client) {
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setTitle('🤖 iGRI Fantasy Arena Bot — Online & Operational')
      .setDescription('The prediction engine, database, and background schedulers have successfully initialized.')
      .addFields(
        { name: '🤖 Bot Client', value: `<@${client.user?.id}> (\`${client.user?.tag}\`)`, inline: true },
        { name: '🌐 Servers', value: `\`${client.guilds.cache.size}\``, inline: true },
        { name: '📋 Log Channel', value: `<#${config.discord.logChannelId}>`, inline: true }
      )
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * Ticket Placed Log
   */
  static async logTicketPlaced(ticket: Ticket, username: string) {
    const legs = ticket.legs || [];
    const multiplier = legs.reduce((acc, leg) => acc * leg.locked_odds, 1.0);
    const potentialPayout = Math.floor(ticket.stake * multiplier);

    const legsDescription = legs.length > 0
      ? legs.map((leg, idx) => {
          const typeLabel = formatMarketLabel(leg.market_type);
          return `**${idx + 1}. Match #${leg.match_id}** [${typeLabel}]: ${formatTeamWithEmoji(leg.selected_target)} (\`${leg.locked_odds.toFixed(2)}x\`)`;
        }).join('\n')
      : '*No selection legs recorded*';

    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`🎯 New Prediction Placed — Slip #${ticket.id}`)
      .setDescription(`User placed an active combo slip in the championship pool.`)
      .addFields(
        { name: '👤 Predictor', value: `<@${ticket.user_id}> (\`${username}\`)`, inline: true },
        { name: '🪙 Stake', value: `**${ticket.stake.toLocaleString()} coins**`, inline: true },
        { name: '⚡ Multiplier / Payout', value: `\`${multiplier.toFixed(2)}x\` ➜ **${potentialPayout.toLocaleString()} coins**`, inline: true },
        { name: `📋 Selections (${legs.length})`, value: legsDescription, inline: false }
      )
      .setFooter({ text: `Slip ID: #${ticket.id} • Active Season #${ticket.season_id}` })
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * Daily Mystery Box Claim Log
   */
  static async logDailyClaim(userId: string, username: string, reward: MysteryBoxReward, newBalance: number) {
    const embed = new EmbedBuilder()
      .setColor(0xfee75c)
      .setTitle(`🎁 Daily Mystery Box Opened`)
      .addFields(
        { name: '👤 Player', value: `<@${userId}> (\`${username}\`)`, inline: true },
        { name: '📦 Box Tier', value: `${reward.tierEmoji} **${reward.tierName}**`, inline: true },
        { name: '🔥 Daily Streak', value: `**Day ${reward.streakDays}**`, inline: true },
        {
          name: '🪙 Reward Breakdown',
          value: `• Base Coins: **+${reward.baseAmount.toLocaleString()}**\n• Streak Bonus: **+${reward.streakBonus.toLocaleString()}**\n• Total Awarded: **+${reward.totalCoins.toLocaleString()} coins**`,
          inline: true,
        },
        { name: '💳 New Balance', value: `**${newBalance.toLocaleString()} coins**`, inline: true }
      )
      .setFooter({ text: `Next claim available in 24 hours` })
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * Match Lobby Created Log
   */
  static async logMatchCreated(match: Match) {
    const teamsList = match.participating_teams.map((t) => formatTeamWithEmoji(t)).join(', ');

    const embed = new EmbedBuilder()
      .setColor(0x3498db)
      .setTitle(`🎮 New Match Created — Match #${match.match_number}`)
      .setDescription(`**Lobby:** ${match.lobby_name}`)
      .addFields(
        { name: '🔒 Prediction Deadline', value: `<t:${Math.floor(match.deadline / 1000)}:R> (<t:${Math.floor(match.deadline / 1000)}:F>)`, inline: false },
        { name: `🛡️ Participating Teams (${match.participating_teams.length})`, value: teamsList.length > 1024 ? teamsList.slice(0, 1020) + '...' : teamsList, inline: false }
      )
      .setFooter({ text: `Match ID: #${match.id} • Status: OPEN` })
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * Match Result / Settlement Log
   */
  static async logMatchSettled(outcome: MatchResultOutcome) {
    const embed = new EmbedBuilder()
      .setColor(0x2ecc71)
      .setTitle(`🏆 Match #${outcome.match.match_number} Settled — Official Results`)
      .setDescription(`**Lobby:** ${outcome.match.lobby_name}\nAll active prediction tickets have been re-evaluated and payouts distributed!`)
      .addFields(
        {
          name: '🏅 Official Podium',
          value: `🥇 **1st Place:** ${formatTeamWithEmoji(outcome.winner)}\n🥈 **2nd Place:** ${formatTeamWithEmoji(outcome.second)}\n🥉 **3rd Place:** ${formatTeamWithEmoji(outcome.third)}`,
          inline: false,
        },
        {
          name: '📊 Outcome Summary',
          value: `• Winning Slips: **${outcome.winningTickets.length}**\n• Eliminated Slips: **${outcome.eliminatedTickets.length}**\n• Selection Legs Resolved: **${outcome.resolvedLegsCount}**`,
          inline: false,
        }
      );

    if (outcome.winningTickets.length > 0) {
      const winnerLines = outcome.winningTickets.slice(0, 10).map((w) => {
        return `• <@${w.userId}> — Ticket **#${w.ticketId}**: Won **+${w.payout.toLocaleString()} coins** 🪙 (\`${w.multiplier.toFixed(2)}x\`)`;
      });
      const extraCount = outcome.winningTickets.length - 10;
      if (extraCount > 0) {
        winnerLines.push(`*...and ${extraCount} more winning predictor(s)*`);
      }
      embed.addFields({
        name: `🎉 Top Payouts (${outcome.winningTickets.length} Winners)`,
        value: winnerLines.join('\n'),
        inline: false,
      });
    }

    if (outcome.match.result_image_url) {
      embed.setImage(outcome.match.result_image_url);
      embed.addFields({
        name: '📸 Match Standings Photo',
        value: `[Direct Scoreboard Link](${outcome.match.result_image_url})`,
        inline: false,
      });
    }

    embed.setFooter({ text: `Match #${outcome.match.match_number} • Settled` });
    embed.setTimestamp();

    await this.send(embed);
  }

  /**
   * Match Cancelled Log
   */
  static async logMatchCancelled(match: Match, reason: string, voidedLegs: number, refundedTickets: number) {
    const embed = new EmbedBuilder()
      .setColor(0xed4245)
      .setTitle(`🚫 Match #${match.match_number} Cancelled & Voided`)
      .setDescription(`**Lobby:** ${match.lobby_name}`)
      .addFields(
        { name: '📝 Cancellation Reason', value: `*${reason}*`, inline: false },
        { name: '↩️ Stakes & Void Status', value: `• **${refundedTickets}** ticket(s) refunded to user balances\n• **${voidedLegs}** selection leg(s) voided (odds set to 1.0x)`, inline: false }
      )
      .setFooter({ text: `Match ID: #${match.id} • Status: CANCELLED` })
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * Admin Balance Grant/Adjustment Log
   */
  static async logBalanceGrant(
    adminId: string | undefined,
    userId: string,
    username: string,
    amount: number,
    oldBalance: number,
    newBalance: number,
    reason?: string
  ) {
    const embed = new EmbedBuilder()
      .setColor(0x9b59b6)
      .setTitle('🪙 Admin Balance Adjustment')
      .addFields(
        { name: '👤 Recipient', value: `<@${userId}> (\`${username}\`)`, inline: true },
        { name: '🛡️ Operator', value: adminId ? `<@${adminId}>` : '*System*', inline: true },
        { name: '💰 Amount Added', value: `**+${amount.toLocaleString()} coins**`, inline: true },
        { name: '💳 Balance Transition', value: `${oldBalance.toLocaleString()} ➜ **${newBalance.toLocaleString()} coins**`, inline: true },
        { name: '📝 Reason / Reference', value: `*${reason || 'Admin manual balance adjustment'}*`, inline: true }
      )
      .setFooter({ text: 'Ledger record committed' })
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * Shop Purchase Log
   */
  static async logShopPurchase(userId: string, username: string, item: ShopItem, newBalance: number) {
    const embed = new EmbedBuilder()
      .setColor(0xe67e22)
      .setTitle('🛒 Arena Shop Purchase')
      .addFields(
        { name: '👤 Buyer', value: `<@${userId}> (\`${username}\`)`, inline: true },
        { name: '🏷️ Item Purchased', value: `**${item.name}** (\`${item.type}\`)`, inline: true },
        { name: '🪙 Cost', value: `**${item.cost.toLocaleString()} coins**`, inline: true },
        { name: '💳 Balance After', value: `**${newBalance.toLocaleString()} coins**`, inline: true }
      )
      .setFooter({ text: `Inventory item: ${item.id}` })
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * Fanbase Role Log
   */
  static async logFanbaseChosen(userId: string, username: string, teamName: string) {
    const embed = new EmbedBuilder()
      .setColor(0x00bcd4)
      .setTitle('🎌 Fanbase Allegiance Selected')
      .addFields(
        { name: '👤 Supporter', value: `<@${userId}> (\`${username}\`)`, inline: true },
        { name: '🛡️ Supported Team', value: formatTeamWithEmoji(teamName), inline: true }
      )
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * Tournament Groups Configuration Log
   */
  static async logGroupConfig(adminTag: string, action: string, details: string) {
    const embed = new EmbedBuilder()
      .setColor(0x1abc9c)
      .setTitle('⚙️ Tournament Group Configuration')
      .addFields(
        { name: '🛡️ Admin / Moderator', value: `\`${adminTag}\``, inline: true },
        { name: '📋 Action', value: `**${action}**`, inline: true },
        { name: '📝 Details', value: details.length > 1024 ? details.slice(0, 1020) + '...' : details, inline: false }
      )
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * Admin Role Access Log
   */
  static async logAdminRoleChange(adminTag: string, action: 'ADDED' | 'REMOVED', roleIdentifier: string) {
    const embed = new EmbedBuilder()
      .setColor(0x34495e)
      .setTitle('🛡️ Admin Access Role Updated')
      .addFields(
        { name: '👤 Moderator', value: `\`${adminTag}\``, inline: true },
        { name: '📋 Action', value: action === 'ADDED' ? 'Role Added ✅' : 'Role Removed ❌', inline: true },
        { name: '🏷️ Role Identifier', value: `\`${roleIdentifier}\``, inline: true }
      )
      .setTimestamp();

    await this.send(embed);
  }

  /**
   * System & Unhandled Error Log
   */
  static async logSystemError(context: string, error: any, user?: { id: string; username: string }) {
    const errorMsg = String(error?.message || error || 'Unknown error');
    const embed = new EmbedBuilder()
      .setColor(0xe74c3c)
      .setTitle('⚠️ System Error Detected')
      .addFields(
        { name: '🔍 Context', value: `\`${context}\``, inline: true },
        { name: '👤 User', value: user ? `<@${user.id}> (\`${user.username}\`)` : '*N/A*', inline: true },
        { name: '❌ Error Message', value: `\`\`\`${errorMsg.slice(0, 950)}\`\`\``, inline: false }
      )
      .setTimestamp();

    await this.send(embed);
  }
}
