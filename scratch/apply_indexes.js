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
    console.log('[Migration] Creating indexes...');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_heartbeats_employee_timestamp ON activity_heartbeats(employee_id, timestamp DESC)');
    await pool.query('CREATE INDEX IF NOT EXISTS idx_heartbeats_active_window ON activity_heartbeats(active_window) WHERE active_window IS NOT NULL');
    console.log('[Migration] Indexes created successfully.');

    console.log('[Migration] Deploying productivity views...');
    await pool.query(`
      CREATE OR REPLACE VIEW daily_productivity_summary AS
      WITH telemetry_stats AS (
          SELECT 
              employee_id,
              attendance_id,
              timestamp::DATE AS date,
              COUNT(*) * 0.5 / 60.0 AS total_hours,
              SUM(CASE WHEN status = 'Active' THEN 1 ELSE 0 END) * 0.5 / 60.0 AS active_hours,
              SUM(CASE WHEN status = 'Idle' THEN 1 ELSE 0 END) * 0.5 / 60.0 AS idle_hours,
              SUM(CASE WHEN status = 'Break' THEN 1 ELSE 0 END) * 0.5 / 60.0 AS break_hours,
              SUM(mouse_clicks) AS total_mouse_clicks,
              SUM(keyboard_presses) AS total_keyboard_presses
          FROM activity_heartbeats
          GROUP BY employee_id, attendance_id, timestamp::DATE
      )
      SELECT 
          ts.employee_id,
          ts.attendance_id,
          ts.date,
          ts.total_hours,
          ts.active_hours,
          ts.idle_hours,
          ts.break_hours,
          ts.total_mouse_clicks,
          ts.total_keyboard_presses
      FROM telemetry_stats ts;
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW weekly_productivity_summary AS
      SELECT 
          employee_id,
          DATE_TRUNC('week', date)::DATE AS week_start,
          AVG(total_hours) AS avg_daily_hours,
          AVG(active_hours) AS avg_active_hours,
          AVG(idle_hours) AS avg_idle_hours,
          AVG(break_hours) AS avg_break_hours,
          SUM(total_mouse_clicks) AS weekly_mouse_clicks,
          SUM(total_keyboard_presses) AS weekly_keyboard_presses
      FROM daily_productivity_summary
      GROUP BY employee_id, DATE_TRUNC('week', date)::DATE;
    `);

    await pool.query(`
      CREATE OR REPLACE VIEW monthly_productivity_summary AS
      SELECT 
          employee_id,
          DATE_TRUNC('month', date)::DATE AS month_start,
          AVG(total_hours) AS avg_daily_hours,
          AVG(active_hours) AS avg_active_hours,
          AVG(idle_hours) AS avg_idle_hours,
          AVG(break_hours) AS avg_break_hours,
          SUM(total_mouse_clicks) AS monthly_mouse_clicks,
          SUM(total_keyboard_presses) AS monthly_keyboard_presses
      FROM daily_productivity_summary
      GROUP BY employee_id, DATE_TRUNC('month', date)::DATE;
    `);
    console.log('[Migration] Views deployed successfully.');
  } catch (err) {
    console.error('[Migration] Failed:', err);
  } finally {
    await pool.end();
  }
}

main();
