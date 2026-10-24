import Database from 'better-sqlite3';

const db = new Database('./data/igri_arena.db');

const groups = {
  'Group A': [
    'GENZ',
    'Black Reign',
    'The Dark Shadows',
    'Phantoms',
    'Just Chill',
    'Goat Protocol',
    'NXT8',
    'W Esports',
  ],
  'Group B': [
    'No Limit',
    'Washed Out',
    'Mangalyaan',
    'No Rules',
    '1nvictuz',
    '2Fast',
    'Early Eliminators',
    'We Gucci',
  ],
  'Group C': [
    'Redline',
    'Say Less',
    'Wardogs',
    'Pew Pew',
    'Team Healers',
    'Kalyug',
    'Code 999',
    'WZ Demons',
  ],
  'Group D': [
    'Contract Killers',
    'Red Network',
    'Guns N Roses',
    'Pookie.Exe',
    'Sapola',
    'Team RIP',
    'Road Killers',
    'Battak Bna Denge',
  ],
};

// Reset all existing groups to NULL
db.prepare('UPDATE teams SET group_name = NULL').run();

// Clean up duplicate 1Invictuz if 1nvictuz exists
const row1nv = db.prepare('SELECT id FROM teams WHERE LOWER(name) = ?').get('1nvictuz');
const row1Inv = db.prepare('SELECT id FROM teams WHERE LOWER(name) = ?').get('1invictuz');
if (row1nv && row1Inv && row1nv.id !== row1Inv.id) {
  db.prepare('DELETE FROM teams WHERE id = ?').run(row1Inv.id);
}

for (const [groupName, teamList] of Object.entries(groups)) {
  for (const team of teamList) {
    const existing = db.prepare('SELECT id, name FROM teams WHERE LOWER(name) = LOWER(?)').get(team);
    if (existing) {
      db.prepare('UPDATE teams SET name = ?, group_name = ? WHERE id = ?').run(team, groupName, existing.id);
    } else {
      const stripped = team.toLowerCase().replace(/[^a-z0-9]/g, '');
      const all = db.prepare('SELECT id, name FROM teams').all();
      const match = all.find((t) => t.name.toLowerCase().replace(/[^a-z0-9]/g, '') === stripped);
      if (match) {
        db.prepare('UPDATE teams SET name = ?, group_name = ? WHERE id = ?').run(team, groupName, match.id);
      } else {
        db.prepare('INSERT INTO teams (name, group_name) VALUES (?, ?)').run(team, groupName);
      }
    }
  }
}

console.log('✅ Final groups updated successfully!\n');
console.log('Group counts:');
console.table(db.prepare('SELECT group_name, count(*) as count FROM teams GROUP BY group_name').all());

for (const [groupName] of Object.entries(groups)) {
  const teams = db.prepare('SELECT name FROM teams WHERE group_name = ? ORDER BY name ASC').all(groupName);
  console.log(`\n📁 ${groupName} (${teams.length} teams):`);
  console.log(teams.map((t) => `  • ${t.name}`).join('\n'));
}
