const { Pool } = require('pg');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'workforce@123',
  database: 'premium_hrms'
});

async function main() {
  try {
    console.log('[Migration] Creating productivity_classifications table...');
    await pool.query(`
      CREATE TABLE IF NOT EXISTS productivity_classifications (
          id SERIAL PRIMARY KEY,
          pattern VARCHAR(255) NOT NULL UNIQUE,
          category VARCHAR(20) NOT NULL CHECK (category IN ('Productive', 'Unproductive', 'Neutral'))
      );
    `);

    console.log('[Migration] Seeding default classification rules...');
    const defaultRules = [
      ['code.exe', 'Productive'],
      ['vscode', 'Productive'],
      ['idea64.exe', 'Productive'],
      ['visual studio', 'Productive'],
      ['slack', 'Productive'],
      ['teams.exe', 'Productive'],
      ['slack.exe', 'Productive'],
      ['cmd.exe', 'Productive'],
      ['powershell.exe', 'Productive'],
      ['git', 'Productive'],
      ['docker', 'Productive'],
      ['github.com', 'Productive'],
      ['stackoverflow.com', 'Productive'],
      ['figma.com', 'Productive'],
      ['localhost', 'Productive'],
      ['enterprise.io', 'Productive'],
      ['excel.exe', 'Productive'],
      ['word.exe', 'Productive'],
      ['powerpnt.exe', 'Productive'],
      ['outlook.exe', 'Productive'],
      ['postman.exe', 'Productive'],
      ['youtube.com', 'Unproductive'],
      ['facebook.com', 'Unproductive'],
      ['reddit.com', 'Unproductive'],
      ['twitter.com', 'Unproductive'],
      ['instagram.com', 'Unproductive'],
      ['netflix.com', 'Unproductive'],
      ['steam.exe', 'Unproductive'],
      ['game.exe', 'Unproductive'],
      ['discord.exe', 'Unproductive'],
      ['roblox', 'Unproductive'],
      ['tiktok.com', 'Unproductive']
    ];

    for (const [pattern, category] of defaultRules) {
      await pool.query(
        'INSERT INTO productivity_classifications (pattern, category) VALUES ($1, $2) ON CONFLICT (pattern) DO NOTHING',
        [pattern, category]
      );
    }
    console.log('[Migration] Productivity classifications table seeded successfully.');
  } catch (err) {
    console.error('[Migration] Failed:', err);
  } finally {
    await pool.end();
  }
}

main();
