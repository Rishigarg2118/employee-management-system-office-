const { Pool } = require('pg');
const zlib = require('zlib');

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'workforce@123',
  database: 'premium_hrms'
});

const API_URL = 'http://localhost:5000/api';
const MOCK_DEVICE_UUID = 'INTEGRATION_TEST_DEVICE_UUID_888';
let token = '';
let employeeId = 4; // Marcus Vance (Employee role in seed)
let attendanceId = 0;

async function testFetch(url, options = {}) {
  options.headers = {
    'Origin': 'http://localhost:5173',
    ...options.headers
  };
  return fetch(url, options);
}

async function setup() {
  console.log('[Test Setup] Preparing mock database entries...');
  // Ensure Marcus Vance has checked in today for telemetry mock
  const todayStr = new Date().toISOString().split('T')[0];
  
  // Clean up any old test data
  await pool.query('DELETE FROM activity_heartbeats WHERE active_window LIKE \'%TEST_%\'');
  await pool.query('DELETE FROM agent_devices WHERE device_uuid = $1', [MOCK_DEVICE_UUID]);
  await pool.query('DELETE FROM productivity_classifications WHERE pattern = \'test_game.exe\'');

  // Insert/Retrieve attendance record for Marcus
  const attRes = await pool.query(
    'INSERT INTO attendance (employee_id, date, status, check_in) VALUES ($1, $2, \'Present\', NOW()) ON CONFLICT (employee_id, date) DO UPDATE SET check_out = NULL RETURNING id',
    [employeeId, todayStr]
  );
  attendanceId = attRes.rows[0].id;
  console.log(`[Test Setup] Attendance ID for today: ${attendanceId}`);
}

async function testAuthAndRegister() {
  console.log('\n--- Test 1: Authenticating and Registering Device ---');
  // Login as Marcus Vance using testFetch
  const loginRes = await testFetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'marcus.v@enterprise.io', password: 'password123' })
  });
  const loginJson = await loginRes.json();
  console.log('Login Response:', loginRes.status, loginJson);
  token = loginJson.token;
  if (!token) throw new Error('Authentication failed - no token returned!');
  console.log('[Pass] Authenticated successfully as Marcus Vance.');

  // Register device footprint
  const regRes = await testFetch(`${API_URL}/devices/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      device_uuid: MOCK_DEVICE_UUID,
      os_platform: 'Windows',
      hostname: 'INTEGRATION-TEST-PC',
      device_name: 'Workstation Test Rig'
    })
  });
  const regJson = await regRes.json();
  if (regRes.status !== 201) throw new Error(`Registration failed: ${JSON.stringify(regJson)}`);
  console.log('[Pass] Device registered successfully. Initial status:', regJson.device.status);
  return regJson.device.id;
}

async function testDeviceTrustMiddleware(deviceId) {
  console.log('\n--- Test 2: Asserting Device Trust Middleware ---');
  
  // 1. Submit heartbeat with no device header
  const resNoHeader = await testFetch(`${API_URL}/attendance/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ status: 'Active' })
  });
  console.log('No Device UUID Header Status:', resNoHeader.status);
  if (resNoHeader.status !== 400) throw new Error('Expected 400 Bad Request when header is missing');
  console.log('[Pass] Blocked heartbeat when x-device-uuid header is missing.');

  // 2. Submit heartbeat with unapproved status (Pending)
  const resPending = await testFetch(`${API_URL}/attendance/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-device-uuid': MOCK_DEVICE_UUID
    },
    body: JSON.stringify({ status: 'Active' })
  });
  console.log('Pending Device Heartbeat Status:', resPending.status);
  if (resPending.status !== 403) throw new Error('Expected 403 Forbidden for pending device status');
  console.log('[Pass] Blocked heartbeat from pending device.');

  // 3. Approve device via database
  console.log('Approving device in database...');
  await pool.query('UPDATE agent_devices SET status = \'Approved\' WHERE id = $1', [deviceId]);

  // 4. Submit heartbeat again
  const resApproved = await testFetch(`${API_URL}/attendance/heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-device-uuid': MOCK_DEVICE_UUID
    },
    body: JSON.stringify({
      status: 'Active',
      mouseClicks: 12,
      keyboardPresses: 25,
      activeWindow: 'VS Code - TEST_active_file.ts'
    })
  });
  console.log('Approved Device Heartbeat Status:', resApproved.status);
  if (resApproved.status !== 202) throw new Error(`Expected 202 Accepted, got ${resApproved.status}`);
  console.log('[Pass] Accepted heartbeat from approved device and enqueued it.');
}

async function testIngestionQueue() {
  console.log('\n--- Test 3: Asserting Asynchronous Queue and Bulk Ingestion ---');
  
  // Verify that database does not have the heartbeat yet (as queue worker flushes every 5s)
  const immediateCheck = await pool.query(
    'SELECT * FROM activity_heartbeats WHERE employee_id = $1 AND active_window = \'VS Code - TEST_active_file.ts\'',
    [employeeId]
  );
  console.log('Immediate database check row count:', immediateCheck.rows.length);
  if (immediateCheck.rows.length !== 0) {
    console.warn('[Warning] Heartbeat already written. Check flushInterval timing.');
  } else {
    console.log('[Pass] Queue successfully buffered heartbeat asynchronously.');
  }

  // Wait 6 seconds for worker to flush
  console.log('Waiting 6 seconds for queue background worker to flush to PostgreSQL...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  const delayedCheck = await pool.query(
    'SELECT * FROM activity_heartbeats WHERE employee_id = $1 AND active_window = \'VS Code - TEST_active_file.ts\'',
    [employeeId]
  );
  console.log('Delayed database check row count:', delayedCheck.rows.length);
  if (delayedCheck.rows.length === 0) throw new Error('Heartbeat was not flushed to database!');
  console.log('[Pass] Heartbeat flushed to PostgreSQL by background worker.');
}

async function testConflictResolution() {
  console.log('\n--- Test 4: Asserting Last-Write-Wins Conflict Resolution ---');

  // Submit two overlapping bulk heartbeats for the same rounded time slot.
  // Rounded timestamp: 2026-06-13T12:00:00.000Z
  const tStr = '2026-06-13T12:00:05.000Z'; // rounds to 12:00:00

  const pack1 = [
    {
      status: 'Active',
      mouseClicks: 5,
      keyboardPresses: 10,
      activeWindow: 'chrome.exe - TEST_google.com',
      timestamp: tStr
    }
  ];

  console.log('Submitting first packet...');
  const comp1 = zlib.gzipSync(JSON.stringify(pack1)).toString('base64');
  const res1 = await testFetch(`${API_URL}/attendance/bulk-heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-device-uuid': MOCK_DEVICE_UUID
    },
    body: JSON.stringify({ compressedData: comp1 })
  });
  console.log('Status 1:', res1.status);

  // Submit a second packet with higher inputs (15 clicks, 20 presses) and a different window focus
  const pack2 = [
    {
      status: 'Active',
      mouseClicks: 15,
      keyboardPresses: 20,
      activeWindow: 'code.exe - TEST_editor.ts',
      timestamp: '2026-06-13T12:00:10.000Z' // rounds to same 12:00:00 slot
    }
  ];

  console.log('Submitting second overlapping packet...');
  const comp2 = zlib.gzipSync(JSON.stringify(pack2)).toString('base64');
  const res2 = await testFetch(`${API_URL}/attendance/bulk-heartbeat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      'x-device-uuid': MOCK_DEVICE_UUID
    },
    body: JSON.stringify({ compressedData: comp2 })
  });
  console.log('Status 2:', res2.status);

  // Check merged results in database
  const dbCheck = await pool.query(
    'SELECT * FROM activity_heartbeats WHERE employee_id = $1 AND timestamp = \'2026-06-13T12:00:00.000Z\'',
    [employeeId]
  );
  
  if (dbCheck.rows.length === 0) throw new Error('Bulk insert failed to write overlapping heartbeat.');
  const merged = dbCheck.rows[0];
  console.log(`Merged Heartbeat - status: ${merged.status}, clicks: ${merged.mouse_clicks}, presses: ${merged.keyboard_presses}, app: ${merged.active_window}`);
  
  if (merged.mouse_clicks !== 15 || merged.keyboard_presses !== 20) {
    throw new Error('Conflict resolution failed to keep maximum input density values!');
  }
  if (!merged.active_window.includes('TEST_editor.ts')) {
    throw new Error('Conflict resolution failed to overwrite active window focus with LWW focus!');
  }
  console.log('[Pass] Database correctly applied LWW merge parameters.');
}

async function testClassifications() {
  console.log('\n--- Test 5: Asserting Productivity Classification Customizations ---');
  
  // 1. Fetch classifications
  const listRes = await testFetch(`${API_URL}/attendance/productivity/classification`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const list = await listRes.json();
  console.log('Classifications returned:', list.length);
  if (!Array.isArray(list)) throw new Error('Expected array of classifications');
  console.log('[Pass] Retrieved classifications list.');

  // 2. Add a custom classification rule
  console.log('Adding new classification rule for "test_game.exe" set to Unproductive...');
  const addRes = await testFetch(`${API_URL}/attendance/productivity/classification`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ pattern: 'test_game.exe', category: 'Unproductive' })
  });
  const addJson = await addRes.json();
  console.log('Add status:', addRes.status, addJson.message);
  if (addRes.status !== 200) throw new Error('Failed to create classification rule');
  console.log('[Pass] Custom classification rule successfully saved.');
}

async function run() {
  try {
    await setup();
    const deviceId = await testAuthAndRegister();
    await testDeviceTrustMiddleware(deviceId);
    await testIngestionQueue();
    await testConflictResolution();
    await testClassifications();
    console.log('\n=======================================');
    console.log('  ALL INTEGRATION TESTS PASSED OK!');
    console.log('=======================================');
  } catch (err) {
    console.error('\n[Test Failure]:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
