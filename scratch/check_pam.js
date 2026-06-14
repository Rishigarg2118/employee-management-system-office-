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
    const res = await pool.query("SELECT first_name, last_name, email, role, status FROM employees WHERE first_name = 'Pam';");
    console.log('Pam Details:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
