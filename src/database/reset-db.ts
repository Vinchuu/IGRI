import { db } from './db.js';

console.log('🧹 Cleaning live database to pristine tournament state...');

db.prepare('DELETE FROM ticket_legs').run();
db.prepare('DELETE FROM tickets').run();
db.prepare('DELETE FROM matches').run();
db.prepare('DELETE FROM transactions_ledger').run();
db.prepare('DELETE FROM user_inventory').run();
db.prepare("DELETE FROM users WHERE id LIKE 'test_user_%' OR id LIKE 'user_%'").run();
db.prepare('UPDATE teams SET group_name = NULL').run();
db.prepare('DELETE FROM seasons WHERE id > 1').run();
db.prepare("UPDATE seasons SET total_pool = 0, distributable_pool = 0, rollover_amount = 0, status = 'ACTIVE' WHERE id = 1").run();

const ungroupedCount = (db.prepare('SELECT COUNT(*) as count FROM teams WHERE group_name IS NULL').get() as any).count;
const totalTeams = (db.prepare('SELECT COUNT(*) as count FROM teams').get() as any).count;

console.log(`✅ Success! ${ungroupedCount}/${totalTeams} teams are now cleanly UNGROUPED.`);
console.log('✅ Matches, dummy tickets, and test users have been wiped.');
