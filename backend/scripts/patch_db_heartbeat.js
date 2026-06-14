const fs = require('fs');
const path = require('path');

const file = path.resolve(__dirname, '../src/config/db.ts');
let content = fs.readFileSync(file, 'utf8');

// Find the corrupted function start and end
const startMarker = '  async addHeartbeatsBulk(packets: any[]): Promise<any[]> {';
const endMarker = '  async getHeartbeatsForDate(employeeId: number, dateStr: string)';

const startIdx = content.indexOf(startMarker);
const endIdx   = content.indexOf(endMarker);

if (startIdx === -1 || endIdx === -1) {
  console.error('Could not find markers. Aborting.');
  process.exit(1);
}

const REPLACEMENT = `  async addHeartbeatsBulk(packets: any[]): Promise<any[]> {
    if (packets.length === 0) return [];

    if (this.isPostgres() && pool) {
      const uniquePacketsMap = new Map<string, any>();

      packets.forEach((p) => {
        const empId = p.employee_id || p.employeeId;
        const targetTime = p.timestamp || new Date().toISOString();
        const roundedTime = new Date(Math.round(new Date(targetTime).getTime() / 30000) * 30000).toISOString();
        const key = \`\${empId}_\${roundedTime}\`;

        const existing = uniquePacketsMap.get(key);
        if (existing) {
          existing.mouse_clicks = Math.max(existing.mouse_clicks || 0, p.mouse_clicks || p.mouseClicks || 0);
          existing.keyboard_presses = Math.max(existing.keyboard_presses || 0, p.keyboard_presses || p.keyboardPresses || 0);
          if (p.status === 'Active' || existing.status !== 'Active') {
            existing.status = p.status || existing.status;
          }
          existing.active_window = p.active_window || p.activeWindow || existing.active_window;
          existing.screenshot_url = p.screenshot_url || p.screenshotUrl || existing.screenshot_url;
          existing.current_url = p.current_url || existing.current_url;
          existing.current_domain = p.current_domain || existing.current_domain;
          existing.browser_name = p.browser_name || existing.browser_name;
          existing.app_name = p.app_name || existing.app_name;
          existing.tab_switch_count = Math.max(existing.tab_switch_count || 0, p.tab_switch_count || 0);
          existing.focus_duration_seconds = Math.max(existing.focus_duration_seconds || 0, p.focus_duration_seconds || 0);
          existing.is_focused = p.is_focused ?? existing.is_focused ?? true;
        } else {
          uniquePacketsMap.set(key, {
            employee_id: empId,
            attendance_id: p.attendance_id || p.attendanceId,
            roundedTime,
            status: p.status || 'Active',
            mouse_clicks: p.mouse_clicks || p.mouseClicks || 0,
            keyboard_presses: p.keyboard_presses || p.keyboardPresses || 0,
            active_window: p.active_window || p.activeWindow || null,
            screenshot_url: p.screenshot_url || p.screenshotUrl || null,
            current_url: p.current_url || null,
            current_domain: p.current_domain || null,
            browser_name: p.browser_name || null,
            app_name: p.app_name || null,
            tab_switch_count: p.tab_switch_count || 0,
            focus_duration_seconds: p.focus_duration_seconds || 0,
            is_focused: p.is_focused ?? true,
          });
        }
      });

      const uniquePackets = Array.from(uniquePacketsMap.values());
      const values: any[] = [];
      const placeholders: string[] = [];
      let valIdx = 1;

      uniquePackets.forEach((p) => {
        const ph = Array.from({ length: 15 }, () => \`$\${valIdx++}\`).join(', ');
        placeholders.push(\`(\${ph})\`);
        values.push(
          p.employee_id, p.attendance_id, p.roundedTime, p.status,
          p.mouse_clicks, p.keyboard_presses, p.active_window, p.screenshot_url,
          p.current_url, p.current_domain, p.browser_name, p.app_name,
          p.tab_switch_count, p.focus_duration_seconds, p.is_focused
        );
      });

      const query = \`
        INSERT INTO activity_heartbeats (
          employee_id, attendance_id, timestamp, status,
          mouse_clicks, keyboard_presses, active_window, screenshot_url,
          current_url, current_domain, browser_name, app_name,
          tab_switch_count, focus_duration_seconds, is_focused
        )
        VALUES \${placeholders.join(', ')}
        ON CONFLICT (employee_id, timestamp)
        DO UPDATE SET
          status = EXCLUDED.status,
          mouse_clicks = GREATEST(activity_heartbeats.mouse_clicks, EXCLUDED.mouse_clicks),
          keyboard_presses = GREATEST(activity_heartbeats.keyboard_presses, EXCLUDED.keyboard_presses),
          active_window = COALESCE(EXCLUDED.active_window, activity_heartbeats.active_window),
          screenshot_url = COALESCE(EXCLUDED.screenshot_url, activity_heartbeats.screenshot_url),
          current_url = COALESCE(EXCLUDED.current_url, activity_heartbeats.current_url),
          current_domain = COALESCE(EXCLUDED.current_domain, activity_heartbeats.current_domain),
          browser_name = COALESCE(EXCLUDED.browser_name, activity_heartbeats.browser_name),
          app_name = COALESCE(EXCLUDED.app_name, activity_heartbeats.app_name),
          tab_switch_count = GREATEST(activity_heartbeats.tab_switch_count, EXCLUDED.tab_switch_count),
          focus_duration_seconds = GREATEST(activity_heartbeats.focus_duration_seconds, EXCLUDED.focus_duration_seconds),
          is_focused = EXCLUDED.is_focused
        RETURNING *
      \`;

      const res = await pool.query(query, values);
      return res.rows;
    }

    const results = [];
    for (const p of packets) {
      const res = await this.addHeartbeat(
        p.employee_id || p.employeeId,
        p.attendance_id || p.attendanceId,
        p.status || 'Active',
        p.mouse_clicks || p.mouseClicks || 0,
        p.keyboard_presses || p.keyboardPresses || 0,
        p.active_window || p.activeWindow || undefined,
        p.screenshot_url || p.screenshotUrl || undefined,
        p.timestamp
      );
      results.push(res);
    }
    return results;
  },

`;

const before = content.substring(0, startIdx);
const after  = content.substring(endIdx);
const fixed  = before + REPLACEMENT + after;

fs.writeFileSync(file, fixed, 'utf8');
console.log('✅  db.ts patched successfully.');
