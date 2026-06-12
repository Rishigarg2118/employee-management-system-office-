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
    const todayStr = new Date().toISOString().split('T')[0];
    console.log(`Cleaning up today's records (${todayStr}) for Marcus (ID: 4) in PostgreSQL...`);
    
    // Delete heartbeats
    const delHb = await pool.query('DELETE FROM activity_heartbeats WHERE employee_id = 4;');
    console.log(`Deleted ${delHb.rowCount} heartbeats.`);

    // Delete attendance corrections
    const delCorr = await pool.query('DELETE FROM attendance_corrections WHERE employee_id = 4;');
    console.log(`Deleted ${delCorr.rowCount} attendance corrections.`);

    // Delete attendance
    const delAtt = await pool.query('DELETE FROM attendance WHERE employee_id = 4 AND date = $1;', [todayStr]);
    console.log(`Deleted ${delAtt.rowCount} attendance records.`);

    // Now clean up database.json
    const dbPath = path.resolve(__dirname, '../backend/database.json');
    if (fs.existsSync(dbPath)) {
      console.log('Cleaning up database.json...');
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      
      if (data.activity_heartbeats) {
        const initialLen = data.activity_heartbeats.length;
        data.activity_heartbeats = data.activity_heartbeats.filter(h => h.employee_id !== 4);
        console.log(`Removed ${initialLen - data.activity_heartbeats.length} heartbeats from database.json.`);
      }

      if (data.attendance_corrections) {
        const initialLen = data.attendance_corrections.length;
        data.attendance_corrections = data.attendance_corrections.filter(c => c.employee_id !== 4);
        console.log(`Removed ${initialLen - data.attendance_corrections.length} corrections from database.json.`);
      }

      if (data.attendance) {
        const initialLen = data.attendance.length;
        data.attendance = data.attendance.filter(a => !(a.employee_id === 4 && a.date === todayStr));
        console.log(`Removed ${initialLen - data.attendance.length} attendance records from database.json.`);
      }

      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
      console.log('database.json cleaned.');
    }
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

main();
