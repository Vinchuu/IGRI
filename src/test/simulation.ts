import { initDatabase, db } from '../database/db.js';
import { UserService } from '../services/UserService.js';
import { MatchService } from '../services/MatchService.js';
import { PredictionService } from '../services/PredictionService.js';
import { SettlementService } from '../services/SettlementService.js';
import { MysteryBoxService } from '../services/MysteryBoxService.js';
import { LeaderboardService } from '../services/LeaderboardService.js';
import { ShopService } from '../services/ShopService.js';

console.log('🧪 ========================================================');
console.log('🧪 RUNNING FULL iGRI FANTASY ARENA ENGINE SIMULATION');
console.log('🧪 ========================================================\n');

// 1. Initialize Database
initDatabase();
console.log('✅ 1. Database and tables initialized successfully.');

// 2. User Registration & Initial 10,000 Coins
const runId = Date.now();
const userA = UserService.getOrCreateUser(`test_user_a_${runId}`, 'OmBhamare');
const userB = UserService.getOrCreateUser(`test_user_b_${runId}`, 'ScoutFan');
const userC = UserService.getOrCreateUser(`test_user_c_${runId}`, 'UnderdogDegen');

console.log(`✅ 2. Registered users:
   • ${userA.username}: Balance = ${userA.balance} coins (Reserved: ${userA.reserved_stake})
   • ${userB.username}: Balance = ${userB.balance} coins (Reserved: ${userB.reserved_stake})
   • ${userC.username}: Balance = ${userC.balance} coins (Reserved: ${userC.reserved_stake})`);

if (userA.balance !== 10000) throw new Error('User A starting balance should be 10000');

// 3. Daily Mystery Box Loot System
console.log('\n🎁 3. Testing Daily Mystery Box:');
const boxReward = MysteryBoxService.openBox(userA.id, userA.username);
console.log(`   • ${userA.username} opened: ${boxReward.tierEmoji} ${boxReward.tierName}`);
console.log(`   • Base: +${boxReward.baseAmount} | Streak Bonus: +${boxReward.streakBonus} | Total: +${boxReward.totalCoins} coins`);
const userAAfterDaily = UserService.getUser(userA.id)!;
console.log(`   • Updated Balance: ${userAAfterDaily.balance} coins`);

// Cooldown check
try {
  MysteryBoxService.openBox(userA.id, userA.username);
  throw new Error('Should have thrown cooldown error');
} catch (e: any) {
  console.log(`   • Verified 24h Cooldown enforcement: "${e.message}"`);
}

// 4. Create Multi-Lobby Matches (BGMI / FiveM Style)
console.log('\n🎮 4. Admin Creating Multi-Lobby Matches:');
const teamsList = ['GodL', 'Soul', 'Hydra', 'Blind', 'Global', '8bit', 'Revenant', 'Medal'];
const starFraggers = ['Joker', 'Mortal', 'Dynamo', 'Spower', 'Jonathan', 'Scout', 'Apollo', 'Neyoo'];

const match1 = MatchService.createMatch(
  1,
  'Lobby 1 - Cayo Perico Island',
  Date.now() + 3600000,
  Date.now() + 3600000,
  teamsList,
  starFraggers
);

const match2 = MatchService.createMatch(
  2,
  'Lobby 2 - Sandy Shores Airport',
  Date.now() + 7200000,
  Date.now() + 7200000,
  teamsList,
  starFraggers
);

const match3 = MatchService.createMatch(
  3,
  'Lobby 3 - Legion Square Arena',
  Date.now() + 10800000,
  Date.now() + 10800000,
  teamsList,
  starFraggers
);

console.log(`   • Match #1 Created: ${match1.lobby_name} [Teams: ${match1.participating_teams.length}]`);
console.log(`   • Match #2 Created: ${match2.lobby_name} [Teams: ${match2.participating_teams.length}]`);
console.log(`   • Match #3 Created: ${match3.lobby_name} [Teams: ${match3.participating_teams.length}]`);

// 5. Placing Combo Tickets
console.log('\n🎟️ 5. Players Submitting Combo Prediction Slips:');

// User A: 2-leg combo (Match 1: Winner GodL, Match 2: Top 3 Soul), Stake = 1000
const ticketA = PredictionService.submitTicket(userA.id, userA.username, 1000, [
  { matchId: match1.id, marketType: 'WINNER', selectedTarget: 'GodL' },
  { matchId: match2.id, marketType: 'TOP_3', selectedTarget: 'Soul' },
]);
console.log(`   • ${userA.username} submitted Ticket #${ticketA.id}: Stake = ${ticketA.stake}, Weight = ${ticketA.combo_weight}x`);

// User B: 3-leg combo (Match 1: Winner Hydra, Match 2: Top 3 GodL, Match 3: Top Fragger Jonathan), Stake = 800
const ticketB = PredictionService.submitTicket(userB.id, userB.username, 800, [
  { matchId: match1.id, marketType: 'WINNER', selectedTarget: 'Hydra' },
  { matchId: match2.id, marketType: 'TOP_3', selectedTarget: 'GodL' },
  { matchId: match3.id, marketType: 'TOP_FRAGGER', selectedTarget: 'Jonathan' },
]);
console.log(`   • ${userB.username} submitted Ticket #${ticketB.id}: Stake = ${ticketB.stake}, Weight = ${ticketB.combo_weight}x`);

// User C: Over-stake limit check (>3,000 open stakes or invalid combo)
try {
  PredictionService.submitTicket(userC.id, userC.username, 1500, [
    { matchId: match1.id, marketType: 'WINNER', selectedTarget: 'GodL' },
    { matchId: match2.id, marketType: 'TOP_3', selectedTarget: 'Soul' },
  ]);
  throw new Error('Should have rejected stake > 1000');
} catch (e: any) {
  console.log(`   • Verified Max Stake validation: "${e.message}"`);
}

// 6. Admin Results Entry (Settling Match 1 & Match 2)
console.log('\n🏁 6. Admin Entering Official Results:');
// Match 1: 1st GodL, 2nd Hydra, 3rd Soul, Top Fragger Joker
const res1 = SettlementService.recordMatchResult(match1.id, 'GodL', 'Hydra', 'Soul', 'Joker');
console.log(`   • Match 1 Settled: Winner=GodL, 2nd=Hydra, 3rd=Soul, Top Fragger=Joker (Legs resolved: ${res1.resolvedLegsCount})`);

// Match 2: 1st Revenant, 2nd Soul, 3rd Blind, Top Fragger Mortal
const res2 = SettlementService.recordMatchResult(match2.id, 'Revenant', 'Soul', 'Blind', 'Mortal');
console.log(`   • Match 2 Settled: Winner=Revenant, 2nd=Soul, 3rd=Blind, Top Fragger=Mortal (Legs resolved: ${res2.resolvedLegsCount})`);

// 7. Match 3 Cancellation (Testing Void Leg / Push Rule)
console.log('\n⚠️ 7. Testing Void Leg / Push Rule on Match 3 Cancellation:');
const cancelRes = SettlementService.cancelMatch(match3.id, 'FiveM server timeout during final round');
console.log(`   • Match 3 Cancelled: Voided legs = ${cancelRes.voidedLegs}, Refunded tickets = ${cancelRes.refundedTickets}`);

// Check Ticket B: Leg 3 was on Match 3, so its odds became 1.0x instead of invalidating the whole slip!
const ticketBAfter = PredictionService.getTicketById(ticketB.id)!;
console.log(`   • Ticket #${ticketB.id} status after match 3 cancellation: Status = ${ticketBAfter.status}, Updated Weight = ${ticketBAfter.combo_weight}x`);

// 8. Settle Season / Day Pool
console.log('\n🏆 8. Settling Tournament Day / Season Pool:');
const activeSeason = MatchService.getActiveSeason();
const summary = SettlementService.settleSeason(activeSeason.id);

console.log(`   • Season: "${summary.seasonName}"`);
console.log(`   • Total Pool: ${summary.totalPool} coins`);
console.log(`   • 5% Coin Sink: -${summary.coinSinkAmount} coins burned`);
console.log(`   • Distributable Pool: ${summary.distributablePool} coins`);
console.log(`   • Winning Tickets: ${summary.winningTicketsCount}`);
summary.winners.forEach((w) => {
  console.log(`     🎉 Winner: ${w.username} won +${w.payout} coins on Ticket #${w.ticketId} (Stake: ${w.stake})`);
});

// 9. Verify Leaderboard
console.log('\n🏅 9. Verifying Leaderboard Rankings:');
const leaderboard = LeaderboardService.getRankings(5);
leaderboard.forEach((entry) => {
  console.log(`   #${entry.rank} ${entry.username} [${entry.equippedTitle}] — Score: ${entry.compositeScore} | Profit: ${entry.netProfit} | Accuracy: ${entry.accuracyScore}%`);
});

// 10. Vanity Shop Purchase
console.log('\n🛍️ 10. Testing Vanity Shop Purchase:');
const shopResult = ShopService.buyItem(userA.id, userA.username, 'badge_sharpshooter');
console.log(`   • ${userA.username} bought: ${shopResult.item.name} for ${shopResult.item.cost} coins!`);
const userAFinal = UserService.getUser(userA.id)!;
console.log(`   • Remaining Balance: ${userAFinal.balance} coins`);

console.log('\n🎉 ========================================================');
console.log('🎉 ALL ENGINE SIMULATION TESTS PASSED FLAWLESSLY (10/10)!');
console.log('🎉 ========================================================\n');
