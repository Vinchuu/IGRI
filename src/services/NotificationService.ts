import { Client, EmbedBuilder, TextBasedChannel } from 'discord.js';
import { MatchResultOutcome } from './SettlementService.js';
import { SERVER_EMOJIS, formatTeamWithEmoji } from '../utils/emojis.js';

export class NotificationService {
  /**
   * Generates Discord embed fields listing winning predictors and their payout amounts.
   */
  static formatWinnerFields(outcome: MatchResultOutcome) {
    if (outcome.winningTickets.length === 0) {
      return [
        {
          name: '🏆 Winning Predictors & Payouts',
          value: '• *No winning slips on this match. Better luck next round!*',
          inline: false,
        },
      ];
    }

    const lines = outcome.winningTickets.map((w) => {
      const picksDesc = w.legs.map((l) => formatTeamWithEmoji(l.selectedTarget)).join(', ');
      return `• <@${w.userId}> — Ticket **#${w.ticketId}**: Won **+${w.payout.toLocaleString()} coins** 🪙 (\`${w.multiplier.toFixed(2)}x\`)\n   ↳ Picks: ${picksDesc}`;
    });

    const fields = [];
    let currentChunk = '';
    let chunkIndex = 1;

    for (const line of lines) {
      if ((currentChunk + '\n' + line).length > 1000) {
        fields.push({
          name: chunkIndex === 1 ? `🏆 Winning Predictors & Winnings (${outcome.winningTickets.length})` : '🏆 Winners (Cont.)',
          value: currentChunk,
          inline: false,
        });
        currentChunk = line;
        chunkIndex++;
      } else {
        currentChunk = currentChunk ? `${currentChunk}\n${line}` : line;
      }
    }

    if (currentChunk) {
      fields.push({
        name: chunkIndex === 1 ? `🏆 Winning Predictors & Winnings (${outcome.winningTickets.length})` : '🏆 Winners (Cont.)',
        value: currentChunk,
        inline: false,
      });
    }

    return fields;
  }

  /**
   * Returns a mention string pinging all winning predictors in Discord.
   */
  static getWinnerMentionContent(outcome: MatchResultOutcome): string | undefined {
    if (!outcome.winningTickets || outcome.winningTickets.length === 0) {
      return undefined;
    }
    const uniqueWinners = Array.from(new Set(outcome.winningTickets.map((w) => `<@${w.userId}>`)));
    return `🎉 **Match #${outcome.match.match_number} Winnings Distributed!** Congratulations: ${uniqueWinners.join(' ')}`;
  }

  /**
   * Dispatches direct messages to all winning (and optionally eliminated) predictors
   * and optionally sends an announcement to the tournament channel.
   */
  static async notifyMatchResults(
    client?: Client,
    outcome?: MatchResultOutcome,
    announcementChannel?: any
  ): Promise<void> {
    if (!outcome || !client) return;

    // 1. Direct Messages to Winners
    for (const winner of outcome.winningTickets) {
      try {
        const discordUser = await client.users.fetch(winner.userId);
        if (discordUser) {
          const selectionsFormatted = winner.legs
            .map((l) => {
              const bracketName =
                l.marketType === 'POS_1'
                  ? '🥇 #1 Winner'
                  : l.marketType === 'POS_2_3'
                  ? '🥈 #2 - #3 Podium'
                  : l.marketType === 'POS_3_5'
                  ? '🥉 #3 - #5 Top 5'
                  : l.marketType === 'POS_5_10' || l.marketType === 'POS_6_10'
                  ? '🎯 #5 - #10 Top 10'
                  : l.marketType === 'POS_11_16'
                  ? '💀 #11 - #16 Placement'
                  : l.marketType;
              const teamFormatted = formatTeamWithEmoji(l.selectedTarget);
              return `• **${bracketName}**: ${teamFormatted} (Odds: \`${l.lockedOdds}x\`) ✅`;
            })
            .join('\n');

          const dmEmbed = new EmbedBuilder()
            .setColor('#57F287')
            .setTitle(`${SERVER_EMOJIS.VC_BADGE} You Won! • Match #${outcome.match.match_number}`)
            .setDescription(
              `Congratulations **${discordUser.username}**! Your prediction on **${outcome.match.lobby_name}** hit!`
            )
            .addFields(
              { name: '🪙 Stake', value: `${winner.stake.toLocaleString()} coins`, inline: true },
              { name: '📈 Multiplier', value: `\`${winner.multiplier.toFixed(2)}x\``, inline: true },
              { name: '🎉 Payout', value: `**+${winner.payout.toLocaleString()}** coins`, inline: true },
              { name: '📈 Net Profit', value: `**+${winner.netProfit.toLocaleString()}** coins`, inline: true },
              { name: '💳 New Balance', value: `**${winner.newBalance.toLocaleString()}** coins`, inline: true },
              { name: '🎟️ Slip ID', value: `#${winner.ticketId}`, inline: true },
              {
                name: '🎯 Winning Selections',
                value: selectionsFormatted || 'All selections hit!',
                inline: false,
              }
            )
            .setFooter({ text: 'VC Arena • Winnings credited to your wallet' })
            .setTimestamp();

          await discordUser.send({ embeds: [dmEmbed] });
        }
      } catch (err: any) {
        console.warn(`[NotificationService] Could not send winning DM to ${winner.userId}: ${err.message}`);
      }
    }

    // 2. Direct Messages to Eliminated Predictors
    for (const eliminated of outcome.eliminatedTickets) {
      try {
        const discordUser = await client.users.fetch(eliminated.userId);
        if (discordUser) {
          const dmEmbed = new EmbedBuilder()
            .setColor('#E74C3C')
            .setTitle(`${SERVER_EMOJIS.VC_BADGE} Match #${outcome.match.match_number} Concluded`)
            .setDescription(
              `Hello **${discordUser.username}**, **${outcome.match.lobby_name}** has concluded.\n\n` +
              `Your Ticket **#${eliminated.ticketId}** (Stake: \`${eliminated.stake.toLocaleString()}\` coins) did not hit this time.\n` +
              `• 🥇 **1st Place:** ${formatTeamWithEmoji(outcome.winner)}\n` +
              `• 🥈 **2nd Place:** ${outcome.second ? formatTeamWithEmoji(outcome.second) : 'N/A'}\n` +
              `• 🥉 **3rd Place:** ${outcome.third ? formatTeamWithEmoji(outcome.third) : 'N/A'}\n\n` +
              `*Better luck next match! Use \`!daily\` for free bonus coins and \`!arena\` to join upcoming lobbies.*`
            )
            .setFooter({ text: 'iGRI Fantasy Arena • FiveM Esports' })
            .setTimestamp();

          if (outcome.imageUrl) {
            dmEmbed.setImage(outcome.imageUrl);
          }

          await discordUser.send({ embeds: [dmEmbed] });
        }
      } catch {
        // Fallback gracefully
      }
    }

    // 3. Optional Channel Announcement if specified
    if (announcementChannel && typeof announcementChannel.send === 'function' && outcome.winningTickets.length > 0) {
      try {
        const channelEmbed = new EmbedBuilder()
          .setColor('#FFD700')
          .setTitle(`${SERVER_EMOJIS.VC_BADGE} WINNING PREDICTORS — MATCH #${outcome.match.match_number}`)
          .setDescription(
            `**${outcome.match.lobby_name}** has settled and coins have been deposited into winners' balances!\n\n` +
            outcome.winningTickets
              .map((w) => `🎉 <@${w.userId}> won **+${w.payout.toLocaleString()} coins** 🪙 on Ticket **#${w.ticketId}** (\`${w.multiplier.toFixed(2)}x\`)`)
              .join('\n')
          )
          .setFooter({ text: 'Official results confirmed • Winnings credited in real-time' })
          .setTimestamp();

        if (outcome.imageUrl) {
          channelEmbed.setImage(outcome.imageUrl);
        }

        const pingContent = this.getWinnerMentionContent(outcome);
        await announcementChannel.send({
          content: pingContent,
          embeds: [channelEmbed],
        });
      } catch (err: any) {
        console.warn(`[NotificationService] Could not send channel announcement: ${err.message}`);
      }
    }
  }
}
