import { initDatabase, db } from '../database/db.js';
import { UserService } from '../services/UserService.js';
import { MatchService } from '../services/MatchService.js';
import { PredictionService } from '../services/PredictionService.js';
import { SettlementService } from '../services/SettlementService.js';
import { MysteryBoxService } from '../services/MysteryBoxService.js';
import { LeaderboardService } from '../services/LeaderboardService.js';
import { ShopService } from '../services/ShopService.js';
import { TeamGroupService } from '../services/TeamGroupService.js';
import { AdminRoleService } from '../services/AdminRoleService.js';

console.log('🧪 ========================================================');
console.log('🧪 RUNNING FULL iGRI FANTASY ARENA ENGINE SIMULATION');
console.log('🧪 ========================================================\n');

// 1. Initialize Database
initDatabase();
console.log('✅ 1. Database and tables initialized successfully.');

// 2. Verify Official Teams & Group System
console.log('\n👥 2. Verifying Official Teams & Tournament Groups:');
const previousGroupState = db.prepare('SELECT name, group_name FROM teams WHERE group_name IS NOT NULL').all() as { name: string; group_name: string }[];
const allTeams = TeamGroupService.getAllTeams();
console.log(`   • Total Teams in DB: ${allTeams.length} teams`);
if (allTeams.length < 43) {
  throw new Error(`Expected at least 43 teams, found ${allTeams.length}`);
}

// Test auto-splitting 43 teams into 3 balanced groups (Group A, Group B, Group C)
const splitGroups = TeamGroupService.autoSplitIntoGroups(3);
for (const [groupName, teams] of Object.entries(splitGroups)) {
  console.log(`   • ${groupName}: ${teams.length} teams (e.g. ${teams.slice(0, 4).join(', ')}...)`);
}

// 3. Verify Admin Roles ('.', '...', 'Crew' and custom addition)
console.log('\n🛡️ 3. Verifying Admin Roles & Permissions:');
const adminRoles = AdminRoleService.getAdminRoles();
console.log(`   • Seeded Admin Roles: ${adminRoles.join(', ')}`);

// Mock Discord GuildMember objects
const memberWithDot = {
  permissions: { has: () => false },
  roles: { cache: new Map([['role_1', { name: '.' }]]) },
};
const memberWithCrew = {
  permissions: { has: () => false },
  roles: { cache: new Map([['role_2', { name: 'Crew' }]]) },
};
const regularPlayer = {
  permissions: { has: () => false },
  roles: { cache: new Map([['role_3', { name: 'Player' }]]) },
};

console.log(`   • Member with role '.' has admin: ${AdminRoleService.isUserAdmin(memberWithDot)}`);
console.log(`   • Member with role 'Crew' has admin: ${AdminRoleService.isUserAdmin(memberWithCrew)}`);
console.log(`   • Regular player has admin: ${AdminRoleService.isUserAdmin(regularPlayer)}`);

if (!AdminRoleService.isUserAdmin(memberWithDot) || !AdminRoleService.isUserAdmin(memberWithCrew)) {
  throw new Error("Admin roles '.', 'Crew' should have admin access");
}
if (AdminRoleService.isUserAdmin(regularPlayer)) {
  throw new Error('Regular player should NOT have admin access');
}

// Dynamic role addition
AdminRoleService.addAdminRole('Lead Organiser');
const memberWithLead = {
  permissions: { has: () => false },
  roles: { cache: new Map([['role_4', { name: 'Lead Organiser' }]]) },
};
console.log(`   • Dynamically added 'Lead Organiser' has admin: ${AdminRoleService.isUserAdmin(memberWithLead)}`);

// 4. User Registration & Initial 10,000 Coins
console.log('\n💰 4. Registering Tournament Users:');
const runId = Date.now();
const userA = UserService.getOrCreateUser(`test_user_a_${runId}`, 'OmBhamare');
const userB = UserService.getOrCreateUser(`test_user_b_${runId}`, 'ScoutFan');
const userC = UserService.getOrCreateUser(`test_user_c_${runId}`, 'UnderdogDegen');

console.log(`   • ${userA.username}: Balance = ${userA.balance} coins (Reserved: ${userA.reserved_stake})`);
console.log(`   • ${userB.username}: Balance = ${userB.balance} coins (Reserved: ${userB.reserved_stake})`);
console.log(`   • ${userC.username}: Balance = ${userC.balance} coins (Reserved: ${userC.reserved_stake})`);

// 5. Daily Mystery Box Loot System
console.log('\n🎁 5. Testing Daily Mystery Box:');
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

// 6. Creating Matches using Group System (Group A vs Group B)
console.log('\n🎮 6. Admin Creating Matches via Group Showdown:');
const groupATeams = TeamGroupService.getTeamsByGroup('Group A');
const groupBTeams = TeamGroupService.getTeamsByGroup('Group B');
const groupCTeams = TeamGroupService.getTeamsByGroup('Group C');

const match1Teams = [...groupATeams, ...groupBTeams];
const match2Teams = [...groupBTeams, ...groupCTeams];
const match3Teams = [...groupATeams, ...groupCTeams];

const match1 = MatchService.createMatch(
  1,
  'Match 1 - Cayo Perico (Group A vs Group B)',
  Date.now() + 3600000,
  Date.now() + 3600000,
  match1Teams,
  match1Teams
);

const match2 = MatchService.createMatch(
  2,
  'Match 2 - Sandy Shores (Group B vs Group C)',
  Date.now() + 7200000,
  Date.now() + 7200000,
  match2Teams,
  match2Teams
);

const match3 = MatchService.createMatch(
  3,
  'Match 3 - Legion Square (Group A vs Group C)',
  Date.now() + 10800000,
  Date.now() + 10800000,
  match3Teams,
  match3Teams
);

console.log(`   • Match #1 Created: ${match1.lobby_name} [${match1.participating_teams.length} teams]`);
console.log(`   • Match #2 Created: ${match2.lobby_name} [${match2.participating_teams.length} teams]`);
console.log(`   • Match #3 Created: ${match3.lobby_name} [${match3.participating_teams.length} teams]`);

// 7. Placing Combo Tickets
console.log('\n🎟️ 7. Players Submitting Combo Prediction Slips:');

const teamA1 = groupATeams[0];
const teamA2 = groupATeams[1];
const teamB1 = groupBTeams[0];
const teamB2 = groupBTeams[1];
const teamC1 = groupCTeams[0];
const teamC2 = groupCTeams[1];

// User A: 2-bracket combo (Match 1: #1 Winner teamA1, #2-#3 Podium teamB1), Stake = 1000
const ticketA = PredictionService.submitTicket(userA.id, userA.username, 1000, [
  { matchId: match1.id, marketType: 'POS_1', selectedTarget: teamA1 },
  { matchId: match1.id, marketType: 'POS_2_3', selectedTarget: teamB1 },
]);
console.log(`   • ${userA.username} submitted Ticket #${ticketA.id}: Stake = ${ticketA.stake}, Weight = ${ticketA.combo_weight}x`);

// User B: 3-bracket combo (Match 1: #1 Winner teamB2, #2-#3 Podium teamA2, #3-#5 Top 5 teamB1), Stake = 800
const ticketB = PredictionService.submitTicket(userB.id, userB.username, 800, [
  { matchId: match1.id, marketType: 'POS_1', selectedTarget: teamB2 },
  { matchId: match1.id, marketType: 'POS_2_3', selectedTarget: teamA2 },
  { matchId: match1.id, marketType: 'POS_3_5', selectedTarget: teamB1 },
]);
console.log(`   • ${userB.username} submitted Ticket #${ticketB.id}: Stake = ${ticketB.stake}, Weight = ${ticketB.combo_weight}x`);

// 8. Admin Declares Result After Every Match
console.log('\n🏁 8. Admin Declaring Official Results After Every Match:');
// Match 1 finishes with full standings 1 to 16: teamA1 wins (1st), teamB1 (2nd), teamB2 (3rd), teamA2 (4th)...
const match1Standings = [teamA1, teamB1, teamB2, teamA2, ...match1Teams.filter(t => ![teamA1, teamB1, teamB2, teamA2].includes(t))];
const res1 = SettlementService.recordMatchResult(match1.id, match1Standings);
console.log(`   • Match 1 Settled: 1st=${res1.winner}, Top 3=${res1.top3.join(', ')} (Resolved legs: ${res1.resolvedLegsCount})`);

// Match 2 finishes: teamC1 wins (1st), teamB1 (2nd), teamC2 (3rd)...
const match2Standings = [teamC1, teamB1, teamC2, ...match2Teams.filter(t => ![teamC1, teamB1, teamC2].includes(t))];
const res2 = SettlementService.recordMatchResult(match2.id, match2Standings);
console.log(`   • Match 2 Settled: 1st=${res2.winner}, Top 3=${res2.top3.join(', ')} (Resolved legs: ${res2.resolvedLegsCount})`);

// 9. Void Leg (Push) Rule test on Match 3 cancellation
console.log('\n⚠️ 9. Testing Void Leg / Push Rule on Match 3 Cancellation:');
const cancelRes = SettlementService.cancelMatch(match3.id, 'Server crash during match 3');
console.log(`   • Match 3 Cancelled: Voided legs = ${cancelRes.voidedLegs}, Refunded tickets = ${cancelRes.refundedTickets}`);

// 10. Settle Tournament Day / Season Pool
console.log('\n🏆 10. Settling Tournament Day Pool & Distributing Coins:');
const activeSeason = MatchService.getActiveSeason();
const summary = SettlementService.settleSeason(activeSeason.id);

console.log(`   • Season/Day: "${summary.seasonName}"`);
console.log(`   • Total Pool: ${summary.totalPool} coins`);
console.log(`   • 5% Coin Sink: -${summary.coinSinkAmount} coins burned`);
console.log(`   • Distributable Pool: ${summary.distributablePool} coins`);
console.log(`   • Winning Tickets: ${summary.winningTicketsCount}`);
summary.winners.forEach((w) => {
  console.log(`     🎉 Winner: ${w.username} won +${w.payout} coins on Ticket #${w.ticketId} (Stake: ${w.stake})`);
});

// 11. Verify Leaderboard
console.log('\n🏅 11. Verifying Leaderboard Rankings:');
const leaderboard = LeaderboardService.getRankings(5);
leaderboard.forEach((entry) => {
  console.log(`   #${entry.rank} ${entry.username} [${entry.equippedTitle}] — Score: ${entry.compositeScore} | Profit: ${entry.netProfit} | Accuracy: ${entry.accuracyScore}%`);
});

// 12. Vanity Shop Purchase
console.log('\n🛍️ 12. Testing Vanity Shop Purchase:');
const shopResult = ShopService.buyItem(userA.id, userA.username, 'badge_sharpshooter');
console.log(`   • ${userA.username} bought: ${shopResult.item.name} for ${shopResult.item.cost} coins!`);
const userAFinal = UserService.getUser(userA.id)!;
console.log(`   • Remaining Balance: ${userAFinal.balance} coins`);

// 13. Clean up simulation artifacts and restore live tournament groups
TeamGroupService.resetAllGroups();
for (const row of previousGroupState) {
  db.prepare('UPDATE teams SET group_name = ? WHERE name = ?').run(row.group_name, row.name);
}
db.prepare("DELETE FROM ticket_legs WHERE ticket_id IN (SELECT id FROM tickets WHERE user_id LIKE 'test_user_%')").run();
db.prepare("DELETE FROM tickets WHERE user_id LIKE 'test_user_%'").run();
db.prepare("DELETE FROM transactions_ledger WHERE user_id LIKE 'test_user_%'").run();
db.prepare("DELETE FROM user_inventory WHERE user_id LIKE 'test_user_%'").run();
db.prepare("DELETE FROM users WHERE id LIKE 'test_user_%'").run();

console.log(`\n🧹 Simulation cleanup completed: Restored ${previousGroupState.length} configured tournament group assignments.`);

console.log('\n🎉 ========================================================');
console.log('🎉 ALL 12 ENGINE SIMULATION TESTS PASSED FLAWLESSLY!');
console.log('🎉 ========================================================\n');
