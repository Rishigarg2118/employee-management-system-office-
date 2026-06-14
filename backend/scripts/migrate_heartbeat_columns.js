/**
 * migrate_heartbeat_columns.js
 * Adds new telemetry columns to activity_heartbeats table.
 * Safe to run multiple times (uses ADD COLUMN IF NOT EXISTS).
 *
 * Run: node backend/scripts/migrate_heartbeat_columns.js
 */

require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_DATABASE || 'premium_hrms',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

const MIGRATIONS = [
  `ALTER TABLE activity_heartbeats ADD COLUMN IF NOT EXISTS current_url TEXT`,
  `ALTER TABLE activity_heartbeats ADD COLUMN IF NOT EXISTS current_domain VARCHAR(255)`,
  `ALTER TABLE activity_heartbeats ADD COLUMN IF NOT EXISTS browser_name VARCHAR(100)`,
  `ALTER TABLE activity_heartbeats ADD COLUMN IF NOT EXISTS app_name VARCHAR(255)`,
  `ALTER TABLE activity_heartbeats ADD COLUMN IF NOT EXISTS tab_switch_count INTEGER DEFAULT 0`,
  `ALTER TABLE activity_heartbeats ADD COLUMN IF NOT EXISTS focus_duration_seconds INTEGER DEFAULT 0`,
  `ALTER TABLE activity_heartbeats ADD COLUMN IF NOT EXISTS is_focused BOOLEAN DEFAULT TRUE`,
  // Widen active_window from 255 to 500 chars
  `ALTER TABLE activity_heartbeats ALTER COLUMN active_window TYPE VARCHAR(500)`,
  // Performance index on domain for leaderboard queries
  `CREATE INDEX IF NOT EXISTS idx_heartbeats_domain ON activity_heartbeats(current_domain)`,
  `CREATE INDEX IF NOT EXISTS idx_heartbeats_focused ON activity_heartbeats(is_focused)`,
];

async function run() {
  const client = await pool.connect();
  console.log('\n🚀  Running Heartbeat Telemetry Migration');
  console.log('─'.repeat(55));
  try {
    for (const sql of MIGRATIONS) {
      try {
        await client.query(sql);
        const label = sql.split(' ').slice(0, 6).join(' ');
        console.log(`  ✅  ${label}...`);
      } catch (err) {
        console.error(`  ❌  Failed: ${sql.slice(0, 60)}...`, err.message);
      }
    }
    console.log('─'.repeat(55));
    console.log('🎉  Migration complete!\n');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch(err => {
  console.error('Migration failed:', err.message);
  process.exit(1);
});
