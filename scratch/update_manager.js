const fs = require('fs');
const path = require('path');
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
    // 1. Update PostgreSQL
    console.log('Updating PostgreSQL departments...');
    const result = await pool.query('UPDATE departments SET manager_id = 2 WHERE id = 1;');
    console.log('PostgreSQL update result:', result.rowCount, 'rows updated.');

    // 2. Update database.json
    const dbPath = path.resolve(__dirname, '../backend/database.json');
    if (fs.existsSync(dbPath)) {
      console.log('Updating backend/database.json...');
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      if (data.departments && data.departments[0]) {
        data.departments[0].manager_id = 2;
        fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
        console.log('backend/database.json updated.');
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
