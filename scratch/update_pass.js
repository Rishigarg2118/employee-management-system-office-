const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'workforce@123',
  database: 'premium_hrms'
});

async function main() {
  try {
    const hp = await bcrypt.hash('password123', 10);
    await pool.query('UPDATE employees SET password = $1 WHERE id = 4', [hp]);
    console.log('[Setup] Marcus Vance password reset successfully.');
  } catch (err) {
    console.error('[Setup] Reset failed:', err);
  } finally {
    await pool.end();
  }
}

main();
