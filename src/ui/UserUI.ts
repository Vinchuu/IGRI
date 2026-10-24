import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import { MatchService } from '../services/MatchService.js';
import { UserService } from '../services/UserService.js';
import { ShopService } from '../services/ShopService.js';
import { Match, MarketType } from '../types/index.js';
import { OddsService } from '../services/OddsService.js';
import { SERVER_EMOJIS, formatTeamWithEmoji, getTeamEmoji, getTeamEmojiId } from '../utils/emojis.js';
import { FanService } from '../services/FanService.js';

export interface SlipPick {
  team: string;
  stake: number;
}

export interface UserSlipState {
  matchId: number;
  currentBracket: MarketType;
  currentStake: number;
  mode: 'SINGLE' | 'COMBO';
  comboStake: number;
  picks: Partial<Record<MarketType, SlipPick>>;
}

export const BRACKET_DEFS: { type: MarketType; emoji: string; label: string; desc: string }[] = [
  { type: 'POS_1', emoji: '🥇', label: '#1 Winner (Champion)', desc: 'Predict match champion (Highest odds multiplier)' },
  { type: 'POS_2_3', emoji: '🥈', label: '#2 - #3 Podium', desc: 'Predict 2nd or 3rd place finish' },
  { type: 'POS_3_5', emoji: '🥉', label: '#3 - #5 Top 5', desc: 'Predict 3rd to 5th place finish' },
  { type: 'POS_5_10', emoji: '🎯', label: '#5 - #10 Top 10', desc: 'Predict 5th to 10th placement' },
  { type: 'POS_11_16', emoji: '💀', label: '#11 - #16 Placement', desc: 'Predict 11th to 16th placement' },
];

export class UserUI {
  /**
   * Builds the central Interactive Arena Dashboard for players with sleek modern aesthetics
   */
  static buildPlayerHub(userId: string, username: string, guild?: any): { embed: EmbedBuilder; rows: ActionRowBuilder<any>[] } {
    const user = UserService.getOrCreateUser(userId, username);
    const season = MatchService.getActiveSeason();
    const openMatches = MatchService.getOpenMatches();
    const member = guild?.members?.cache?.get(userId);
    const teamRole = FanService.getUserTeamRole(member);

    const accuracy = user.resolved_selections > 0
      ? ((user.correct_selections / user.resolved_selections) * 100).toFixed(1)
      : '0.0';

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Player Hub`)
      .setDescription(
        `Welcome back, **${user.username}**!\n` +
        `Title: \`${user.equipped_title}\` • Streak: **${user.daily_streak}d** 🔥` +
        (teamRole ? ` • Fan of <@&${teamRole.roleId}>` : '')
      )
      .addFields(
        {
          name: '🪙 Balance',
          value: `**${user.balance.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '🔒 In Play',
          value: `**${user.reserved_stake.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '💼 Net Worth',
          value: `**${(user.balance + user.reserved_stake).toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '📈 Net Profit',
          value: `**${user.lifetime_profit >= 0 ? '+' : ''}${user.lifetime_profit.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '🎯 Accuracy',
          value: `**${accuracy}%** (${user.correct_selections}/${user.resolved_selections})`,
          inline: true,
        },
        {
          name: '🏆 Top Win',
          value: `**${user.biggest_win_payout.toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: '🎮 Live Matches',
          value:
            openMatches.length > 0
              ? `• **${openMatches.length}** open lobby available\n• Next: **Match #${openMatches[0].match_number} (${openMatches[0].lobby_name})** (<t:${Math.floor(openMatches[0].deadline / 1000)}:R>)`
              : '• *No open matches right now. Admin will open the next lobby soon!*',
          inline: false,
        }
      )
      .setFooter({ text: 'VC Arena • Select an option below to play' });

    const row1 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('user_ui_predict')
        .setLabel('Predict')
        .setStyle(ButtonStyle.Success)
        .setEmoji('🎯'),
      new ButtonBuilder()
        .setCustomId('btn_daily')
        .setLabel('Daily Crate')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎁'),
      new ButtonBuilder()
        .setCustomId('btn_matches')
        .setLabel('Matches')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎮')
    );

    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('btn_mytickets')
        .setLabel('My Slips')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🎫'),
      new ButtonBuilder()
        .setCustomId('btn_balance')
        .setLabel('Wallet')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('💳'),
      new ButtonBuilder()
        .setCustomId('btn_leaderboard')
        .setLabel('Leaderboard')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🏆'),
      new ButtonBuilder()
        .setCustomId('user_ui_open_shop')
        .setLabel('Shop')
        .setStyle(ButtonStyle.Secondary)
        .setEmoji('🛍️')
    );

    return { embed, rows: [row1, row2] };
  }

  /**
   * Interactive Multi-Bracket Prediction Slip Builder UI
   * Supports all 5 tournament positions, individual stakes per bracket, and Single/Combo modes.
   */
  static buildSlipBuilder(
    match: Match,
    slipStateOrWinner?: UserSlipState | string,
    selectedPodium?: string,
    stake: number = 200
  ): { embed: EmbedBuilder; rows: ActionRowBuilder<any>[] } {
    let slipState: UserSlipState;

    if (slipStateOrWinner && typeof slipStateOrWinner === 'object' && 'currentBracket' in slipStateOrWinner) {
      slipState = slipStateOrWinner as UserSlipState;
    } else {
      slipState = {
        matchId: match.id,
        currentBracket: 'POS_1',
        currentStake: stake || 200,
        mode: 'SINGLE',
        comboStake: stake || 200,
        picks: {},
      };
      if (typeof slipStateOrWinner === 'string') {
        slipState.picks['POS_1'] = { team: slipStateOrWinner, stake: stake || 200 };
      }
      if (selectedPodium) {
        slipState.picks['POS_2_3'] = { team: selectedPodium, stake: stake || 200 };
      }
    }

    const teams = match.participating_teams.slice(0, 25);
    const activeBracketDef = BRACKET_DEFS.find((b) => b.type === slipState.currentBracket) || BRACKET_DEFS[0];
    const currentPick = slipState.picks[slipState.currentBracket];

    const pickEntries = Object.entries(slipState.picks) as [MarketType, SlipPick][];
    const pickCount = pickEntries.length;
    const totalStake = pickEntries.reduce((sum, [, p]) => sum + p.stake, 0);

    // Calculate combo odds
    let comboMultiplier = 1.0;
    for (const [bType, pick] of pickEntries) {
      const odds = OddsService.getOdds(match.id, bType, pick.team, match.participating_teams.length);
      comboMultiplier *= odds;
    }

    const embed = new EmbedBuilder()
      .setColor('#57F287')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} Match #${match.match_number} • Prediction Slip`)
      .setDescription(
        `**Lobby:** ${match.lobby_name} • **Closes:** <t:${Math.floor(match.deadline / 1000)}:R>\n` +
        `Configure your position picks and stake below, then lock it in!`
      )
      .addFields(
        {
          name: `📋 Slip Picks (${pickCount}/5)`,
          value: pickCount === 0
            ? '*Slip is currently empty. Pick a bracket and team below.*'
            : pickEntries
                .map(([bType, p]) => {
                  const bDef = BRACKET_DEFS.find((b) => b.type === bType)!;
                  const odds = OddsService.getOdds(match.id, bType, p.team, match.participating_teams.length);
                  const potential = Math.floor(p.stake * odds);
                  const formattedTeam = formatTeamWithEmoji(p.team);
                  return `• **${bDef.label}:** ${formattedTeam}\n  ↳ Stake: **${p.stake.toLocaleString()}** coins • \`${odds.toFixed(2)}x\` → **+${potential.toLocaleString()}**`;
                })
                .join('\n'),
          inline: false,
        },
        {
          name: '⚙️ Active Bracket',
          value: `• Position: **${activeBracketDef.label}**\n• Team: ${currentPick ? formatTeamWithEmoji(currentPick.team) : '*None selected*'}\n• Stake: **${(currentPick ? currentPick.stake : slipState.currentStake).toLocaleString()}** coins`,
          inline: true,
        },
        {
          name: slipState.mode === 'SINGLE' ? '🎯 Mode: Single Bets' : '🔥 Mode: Combo Parlay',
          value: slipState.mode === 'SINGLE'
            ? `• Total Stake: **${totalStake.toLocaleString()}** coins\n• *Each pick wins independently!*`
            : `• Combo Stake: **${slipState.comboStake.toLocaleString()}** coins\n• Multiplier: **${comboMultiplier.toFixed(2)}x**\n• Payout: **+${Math.floor(slipState.comboStake * comboMultiplier).toLocaleString()}** coins`,
          inline: true,
        }
      )
      .setFooter({ text: 'VC Arena • 1 team per bracket • Zero typing required' });

    const rows: ActionRowBuilder<any>[] = [];

    // Row 1: Position Bracket Selector Dropdown
    const bracketSelect = new StringSelectMenuBuilder()
      .setCustomId(`user_slip_bracket:${match.id}`)
      .setPlaceholder(`📍 Step 1: Position: ${activeBracketDef.label}...`)
      .addOptions(
        BRACKET_DEFS.map((b) => {
          const hasPick = !!slipState.picks[b.type];
          return new StringSelectMenuOptionBuilder()
            .setLabel(`${b.label}${hasPick ? ` (${slipState.picks[b.type]!.team})` : ''}`)
            .setDescription(b.desc)
            .setValue(b.type)
            .setEmoji(b.emoji)
            .setDefault(b.type === slipState.currentBracket);
        })
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(bracketSelect));

    // Row 2: Team Selector Dropdown for Active Bracket (With custom server emojis!)
    const teamSelect = new StringSelectMenuBuilder()
      .setCustomId(`user_slip_team:${match.id}`)
      .setPlaceholder(`🛡️ Step 2: Choose Team for ${activeBracketDef.label}...`)
      .addOptions(
        teams.map((t) => {
          const opt = new StringSelectMenuOptionBuilder()
            .setLabel(t)
            .setValue(t)
            .setDefault(currentPick?.team === t);

          const emojiId = getTeamEmojiId(t);
          if (emojiId) {
            opt.setEmoji(emojiId);
          } else {
            opt.setEmoji(activeBracketDef.emoji);
          }
          return opt;
        })
      );
    rows.push(new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(teamSelect));

    // Row 3: Stake Buttons for the Active Bracket
    const activeStake = currentPick ? currentPick.stake : slipState.currentStake;
    const isCustom = ![100, 250, 500, 1000].includes(activeStake);
    const stakeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId(`user_slip_stake:${match.id}:100`)
        .setLabel('100 🪙')
        .setStyle(activeStake === 100 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`user_slip_stake:${match.id}:250`)
        .setLabel('250 🪙')
        .setStyle(activeStake === 250 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`user_slip_stake:${match.id}:500`)
        .setLabel('500 🪙')
        .setStyle(activeStake === 500 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`user_slip_stake:${match.id}:1000`)
        .setLabel('1,000 🪙')
        .setStyle(activeStake === 1000 ? ButtonStyle.Success : ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`user_slip_custom_stake:${match.id}`)
        .setLabel(isCustom ? `${activeStake.toLocaleString()} 🪙 ✏️` : '✏️ Custom')
        .setStyle(isCustom ? ButtonStyle.Success : ButtonStyle.Primary)
    );
    rows.push(stakeRow);

    // Row 4: Mode & Management Row
    const modeBtn = new ButtonBuilder()
      .setCustomId(`user_slip_toggle_mode:${match.id}`)
      .setLabel(slipState.mode === 'SINGLE' ? 'Mode: 🎯 Single Bets' : 'Mode: 🔥 Combo Slip')
      .setStyle(slipState.mode === 'SINGLE' ? ButtonStyle.Primary : ButtonStyle.Success);

    const removeBtn = new ButtonBuilder()
      .setCustomId(`user_slip_remove_bracket:${match.id}`)
      .setLabel('Remove Pick')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🗑️')
      .setDisabled(!currentPick);

    const clearBtn = new ButtonBuilder()
      .setCustomId(`user_slip_clear_all:${match.id}`)
      .setLabel('Clear All')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🧹')
      .setDisabled(pickCount === 0);

    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(modeBtn, removeBtn, clearBtn));

    // Row 5: Submission & Navigation Row
    const canSubmit = slipState.mode === 'SINGLE' ? pickCount > 0 : pickCount >= 2;
    const submitLabel =
      slipState.mode === 'SINGLE'
        ? pickCount === 0
          ? 'Select a Team First'
          : `Lock In ${pickCount} Bet${pickCount > 1 ? 's' : ''} (${totalStake.toLocaleString()} 🪙)`
        : pickCount < 2
        ? 'Pick 2+ Teams for Combo'
        : `Lock In Combo (${slipState.comboStake.toLocaleString()} 🪙)`;

    const submitBtn = new ButtonBuilder()
      .setCustomId(`user_slip_submit:${match.id}`)
      .setLabel(submitLabel)
      .setStyle(canSubmit ? ButtonStyle.Success : ButtonStyle.Secondary)
      .setDisabled(!canSubmit)
      .setEmoji('🚀');

    const homeBtn = new ButtonBuilder()
      .setCustomId('user_ui_home')
      .setLabel('Hub')
      .setStyle(ButtonStyle.Secondary)
      .setEmoji('🏠');

    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(submitBtn, homeBtn));

    return { embed, rows };
  }

  /**
   * Interactive Vanity Boutique UI with Dropdown
   */
  static buildShopUI(userId: string, username: string): { embed: EmbedBuilder; rows: ActionRowBuilder<any>[] } {
    const user = UserService.getOrCreateUser(userId, username);
    const items = ShopService.getItems();

    const embed = new EmbedBuilder()
      .setColor('#9B59B6')
      .setTitle(`${SERVER_EMOJIS.VC_BADGE} VC Arena • Vanity Shop`)
      .setDescription(
        `Available Balance: **${user.balance.toLocaleString()}** coins 🪙\n` +
        `Unlock exclusive titles, badges, and roles using your virtual coins!`
      );

    items.forEach((item) => {
      embed.addFields({
        name: `${item.badge_emoji || '🏷️'} ${item.name}`,
        value: `**${item.cost.toLocaleString()}** coins\n*${item.description}*`,
        inline: true,
      });
    });

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId('shop_purchase_select')
      .setPlaceholder('Select an item to purchase...')
      .addOptions(
        items.map((it) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${it.name} (${it.cost.toLocaleString()} coins)`)
            .setDescription(it.description.slice(0, 50))
            .setValue(it.id)
            .setEmoji(it.badge_emoji || '🏷️')
        )
      );

    const row1 = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const row2 = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('user_ui_home').setLabel('Back to Hub').setStyle(ButtonStyle.Secondary).setEmoji('🏠')
    );

    return { embed, rows: [row1, row2] };
  }
}
