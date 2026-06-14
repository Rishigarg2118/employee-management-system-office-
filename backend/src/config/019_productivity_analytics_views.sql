-- Migration: Create productivity analytics views
-- 1. Daily Aggregates View
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

-- 2. Weekly Rollup View
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

-- 3. Monthly Rollup View
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
