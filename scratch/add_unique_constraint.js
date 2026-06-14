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
    console.log('[Migration] Cleaning up existing duplicate heartbeats (keeping highest inputs)...');
    
    // Select duplicates and keep only one with max inputs
    await pool.query(`
      DELETE FROM activity_heartbeats a USING activity_heartbeats b
      WHERE a.id < b.id 
        AND a.employee_id = b.employee_id 
        AND a.timestamp = b.timestamp;
    `);
    
    console.log('[Migration] Adding unique constraint unique_employee_timestamp...');
    await pool.query(`
      ALTER TABLE activity_heartbeats 
      ADD CONSTRAINT unique_employee_timestamp UNIQUE (employee_id, timestamp);
    `);
    console.log('[Migration] Unique constraint added successfully.');
  } catch (err) {
    if (err.code === '42710') {
      console.log('[Migration] Unique constraint unique_employee_timestamp already exists.');
    } else {
      console.error('[Migration] Failed:', err);
    }
  } finally {
    await pool.end();
  }
}

main();
