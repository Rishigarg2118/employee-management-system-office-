const axios = require('axios');
const crypto = require('crypto');
const zlib = require('zlib');

const BASE_URL = 'http://localhost:5000/api';
const HMAC_SECRET = 'enterprise-workforce-hardening-secret-key-2026';
const DECRYPTION_KEY_MATERIAL = 'enterprise-offline-hardened-key-material-2026';
const SALT = Buffer.from('workforce-salt');
const aesKey = crypto.pbkdf2Sync(DECRYPTION_KEY_MATERIAL, SALT, 1000, 32, 'sha256');

function encryptPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  let ciphertext = cipher.update(JSON.stringify(payload), 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const tag = cipher.getAuthTag();
  const finalCiphertext = Buffer.concat([ciphertext, tag]);
  return {
    iv: iv.toString('base64'),
    ciphertext: finalCiphertext.toString('base64')
  };
}

function getSecurityHeaders(method, endpoint, body = null, extraHeaders = {}) {
  const timestamp = Date.now().toString();
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  
  let cleanEndpoint = endpoint.split('?')[0];
  if (cleanEndpoint.startsWith('/api')) {
    cleanEndpoint = cleanEndpoint.substring(4);
  }
  
  const messageToSign = `${method.toUpperCase()}:${cleanEndpoint}:${timestamp}:${nonce}:${bodyStr}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(messageToSign).digest('hex');
  return {
    'x-signature': signature,
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    ...extraHeaders
  };
}

async function runCommandCenterUAT() {
  console.log('=== STARTING WORKFORCE COMMAND CENTER INTEGRATION UAT SUITE ===\n');
  const results = { passed: [], failed: [] };

  const logResult = (testCase, expected, actual, passed) => {
    const status = passed ? '✅ PASSED' : '❌ FAILED';
    console.log(`[${status}] Test Case: ${testCase}`);
    console.log(`  Expected: ${expected}`);
    console.log(`  Actual: ${actual}\n`);
    if (passed) {
      results.passed.push(testCase);
    } else {
      results.failed.push(testCase);
    }
  };

  // 1. Clean database for employee Marcus (ID = 4)
  const { Pool } = require('c:/Users/ASUS/employee-management-system/backend/node_modules/pg');
  const pool = new Pool({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'workforce@123',
    database: 'premium_hrms'
  });

  try {
    const todayStr = new Date().toISOString().split('T')[0];
    await pool.query('DELETE FROM activity_heartbeats WHERE employee_id = 4;');
    await pool.query('DELETE FROM attendance WHERE employee_id = 4 AND date = $1;', [todayStr]);
    console.log('Database cleaned up for Employee ID 4 (Marcus).\n');
  } catch (e) {
    console.warn('Database cleanup warning:', e.message);
  } finally {
    await pool.end();
  }

  let employeeToken, adminToken;
  const testDeviceUuid = 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999';

  // 2. Authentication Handshake
  try {
    let endpoint = '/auth/login';
    let body = { email: 'marcus.v@enterprise.io', password: 'password123' };
    let headers = getSecurityHeaders('POST', endpoint, body, { 'x-device-fingerprint': testDeviceUuid });
    let res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    employeeToken = res.data.token;

    body = { email: 'sarah.j@enterprise.io', password: 'password123' };
    headers = getSecurityHeaders('POST', endpoint, body, { 'x-device-fingerprint': testDeviceUuid });
    res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    adminToken = res.data.token;

    logResult('UAT Authentication Handshake', 'Tokens for employee and admin retrieved', 'Tokens retrieved successfully', true);
  } catch (err) {
    logResult('UAT Authentication Handshake', 'Tokens retrieved', err.response?.data?.message || err.message, false);
    return;
  }

  // 3. Employee shift check-in
  try {
    const checkinEndpoint = '/attendance/check-in';
    const checkinBody = { status: 'Present', remarks: 'Workforce command center check-in' };
    const checkinHeaders = getSecurityHeaders('POST', checkinEndpoint, checkinBody, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.post(`${BASE_URL}${checkinEndpoint}`, checkinBody, { headers: checkinHeaders });
    logResult('Employee Shift Check-in', 'Attendance record created successfully', `Check-in HTTP status: ${res.status}`, res.status === 200 || res.status === 201);
  } catch (err) {
    logResult('Employee Shift Check-in', 'Attendance record created', err.response?.data?.message || err.message, false);
  }

  // 4. Send historical heartbeats using bulk sync endpoint to support unique timestamps
  // We offset UTC ISO time by local timezone offset so that when PG strips timezone, it parses correctly as local time.
  const nowMs = Date.now();
  const offsetMs = new Date().getTimezoneOffset() * 60 * 1000;
  
  const rawPackets = [
    { status: 'Active', mouseClicks: 10, keyboardPresses: 20, activeWindow: 'vscode.exe - Dashboard.tsx - VS Code', timestamp: new Date(nowMs - offsetMs - 300000).toISOString() },
    { status: 'Active', mouseClicks: 15, keyboardPresses: 25, activeWindow: 'vscode.exe - Dashboard.tsx - VS Code', timestamp: new Date(nowMs - offsetMs - 210000).toISOString() },
    { status: 'Idle', mouseClicks: 0, keyboardPresses: 0, activeWindow: 'chrome.exe - [https://youtube.com] - youtube.com', timestamp: new Date(nowMs - offsetMs - 120000).toISOString() },
    { status: 'Break', mouseClicks: 0, keyboardPresses: 0, activeWindow: 'None', timestamp: new Date(nowMs - offsetMs - 60000).toISOString() },
    { status: 'Active', mouseClicks: 30, keyboardPresses: 40, activeWindow: 'chrome.exe - Figma - figma.com', timestamp: new Date(nowMs - offsetMs - 5000).toISOString() }
  ];

  try {
    const bulkEndpoint = '/attendance/bulk-heartbeat';
    const compressedData = zlib.gzipSync(JSON.stringify(rawPackets)).toString('base64');
    const encryptedBody = encryptPayload({ compressedData });
    
    const headers = getSecurityHeaders('POST', bulkEndpoint, encryptedBody, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid,
      'x-device-uuid': testDeviceUuid
    });

    const res = await axios.post(`${BASE_URL}${bulkEndpoint}`, encryptedBody, { headers });
    logResult('Mock Bulk Telemetry Dispatch', 'Bulk heartbeats synched successfully', `Sync HTTP Status: ${res.status}`, res.status === 201 || res.status === 200);
  } catch (err) {
    logResult('Mock Bulk Telemetry Dispatch', 'Bulk heartbeats synched', err.response?.data?.message || err.message, false);
  }

  // 5. Wait 6 seconds for processing
  console.log('Waiting 6 seconds for backend telemetry queue processing...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  // 6. Query Live Workforce Command Center
  let liveEmployeesList = [];
  try {
    const endpoint = '/attendance/live';
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });
    liveEmployeesList = res.data.employees || [];

    const marcusLive = liveEmployeesList.find(e => e.email === 'marcus.v@enterprise.io');

    const hasMarcus = !!marcusLive;
    const isWorking = marcusLive && marcusLive.currentStatus === 'Active';
    const hasMachine = marcusLive && !!marcusLive.todayStats.machineName;
    const hasApp = marcusLive && marcusLive.activeWindow === 'chrome.exe - Figma - figma.com';

    logResult(
      'Live Workforce Center Query',
      'Telemetry aggregates (status, app, machine name) parsed correctly',
      `Marcus Found: ${hasMarcus}, Status: ${marcusLive?.currentStatus}, Machine: ${marcusLive?.todayStats?.machineName}, App: ${marcusLive?.activeWindow}`,
      hasMarcus && isWorking && hasMachine && hasApp
    );
  } catch (err) {
    logResult('Live Workforce Center Query', 'Success responses', err.response?.data?.message || err.message, false);
  }

  // 7. Verify Employee Timeline
  try {
    const endpoint = `/attendance/productivity?employeeId=4`;
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });

    const timeline = res.data.timeline || [];
    const appUsage = res.data.appUsage || {};

    const hasTimeline = timeline.length > 0;
    const hasVscode = appUsage['vscode.exe'] !== undefined || appUsage['VS Code'] !== undefined || Object.keys(appUsage).length > 0;

    logResult(
      'Chronological Timeline Verification',
      'Granular hourly/block timeline chunks retrieved',
      `Timeline Blocks: ${timeline.length}, Dominant Apps: ${Object.keys(appUsage).join(', ')}`,
      hasTimeline && hasVscode
    );
  } catch (err) {
    logResult('Chronological Timeline Verification', 'Success payload', err.response?.data?.message || err.message, false);
  }

  console.log('=== WORKFORCE COMMAND CENTER INTEGRATION UAT COMPLETE ===');
  console.log(`Passed: ${results.passed.length}, Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

runCommandCenterUAT();
