const axios = require('axios');
const crypto = require('crypto');
const { Pool } = require('pg');

const BASE_URL = 'http://localhost:5000/api';
const HMAC_SECRET = 'enterprise-workforce-hardening-secret-key-2026';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  user: 'postgres',
  password: 'workforce@123',
  database: 'premium_hrms'
});

function getSecurityHeaders(method, endpoint, body = null) {
  const timestamp = Date.now().toString();
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  
  const messageToSign = `${method.toUpperCase()}:${endpoint}:${timestamp}:${nonce}:${bodyStr}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(messageToSign).digest('hex');
  
  return {
    'x-signature': signature,
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    'x-device-fingerprint': 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999'
  };
}

async function runUAT() {
  console.log('=== STARTING SECURE ENTERPRISE UAT TEST SUITE ===\n');
  
  try {
    console.log('[Setup] Cleaning up today\'s UAT checkins and heartbeats in database...');
    await pool.query('DELETE FROM activity_heartbeats WHERE timestamp::DATE = CURRENT_DATE');
    await pool.query('DELETE FROM attendance WHERE date = CURRENT_DATE');
    console.log('[Setup] Database clean completed.');
  } catch (err) {
    console.error('[Setup] Database cleanup failed:', err);
  }

  const results = {
    passed: [],
    failed: []
  };

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

  let employeeToken, managerToken, adminToken;
  let marcusId = 4;
  let davidId = 2;
  
  // Test Case 1: Employee Login
  try {
    const endpoint = '/auth/login';
    const body = {
      email: 'marcus.v@enterprise.io',
      password: 'password123'
    };
    const secHeaders = getSecurityHeaders('POST', endpoint, body);
    
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers: secHeaders });
    employeeToken = res.data.token;
    logResult('Test Case 1 - Employee Login', 'Successful authentication & JWT returned', `Token generated starting with "${employeeToken.slice(0, 15)}..."`, true);
  } catch (err) {
    logResult('Test Case 1 - Employee Login', 'Successful authentication', err.response?.data?.message || err.message, false);
  }

  // Test Case 2: Manager Login
  try {
    const endpoint = '/auth/login';
    const body = {
      email: 'david.c@enterprise.io',
      password: 'password123'
    };
    const secHeaders = getSecurityHeaders('POST', endpoint, body);
    
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers: secHeaders });
    managerToken = res.data.token;
    logResult('Test Case 2 - Manager Login', 'Successful authentication & manager viewable token', 'Token generated successfully', true);
  } catch (err) {
    logResult('Test Case 2 - Manager Login', 'Successful authentication', err.response?.data?.message || err.message, false);
  }

  // Test Case 3: Admin Login
  try {
    const endpoint = '/auth/login';
    const body = {
      email: 'sarah.j@enterprise.io',
      password: 'password123'
    };
    const secHeaders = getSecurityHeaders('POST', endpoint, body);
    
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers: secHeaders });
    adminToken = res.data.token;
    logResult('Test Case 3 - Admin Login', 'Successful authentication & admin level access', 'Token generated successfully', true);
  } catch (err) {
    logResult('Test Case 3 - Admin Login', 'Successful authentication', err.response?.data?.message || err.message, false);
  }

  if (!employeeToken || !managerToken || !adminToken) {
    console.error('Cannot proceed with further UAT checks without valid session tokens.');
    await pool.end();
    return;
  }

  // Define headers for sessions
  const getEmpHeaders = (method, endpoint, body = null) => ({
    ...getSecurityHeaders(method, endpoint, body),
    'x-device-uuid': 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999',
    Authorization: `Bearer ${employeeToken}`
  });

  const getMgrHeaders = (method, endpoint, body = null) => ({
    ...getSecurityHeaders(method, endpoint, body),
    'x-device-uuid': 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999',
    Authorization: `Bearer ${managerToken}`
  });

  // Test Case 6: Punch In
  let attendanceRecord;
  try {
    const endpoint = '/attendance/check-in';
    const body = { status: 'Present', remarks: 'UAT testing session' };

    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers: getEmpHeaders('POST', endpoint, body) });
    attendanceRecord = res.data;
    logResult('Test Case 6 - Punch In', 'Attendance record created today', `Checked in as ${attendanceRecord.status}`, true);
  } catch (err) {
    logResult('Test Case 6 - Punch In', 'Attendance record created today', err.response?.data?.message || err.message, false);
  }

  // Test Case 8: Double Punch In Validation
  try {
    const endpoint = '/attendance/check-in';
    const body = { status: 'Present' };
    await axios.post(`${BASE_URL}${endpoint}`, body, { headers: getEmpHeaders('POST', endpoint, body) });
    logResult('Test Case 8 - Double Punch In', 'Error: Already checked in', 'Punch succeeded (Duplicate allowed)', false);
  } catch (err) {
    const correctMsg = err.response?.data?.message === 'Already checked in for today.';
    logResult('Test Case 8 - Double Punch In', 'Error: Already checked in for today.', err.response?.data?.message, correctMsg);
  }

  // Test Case 11: Heartbeat submissions
  try {
    const endpoint = '/attendance/heartbeat';
    const body = {
      status: 'Active',
      mouseClicks: 15,
      keyboardPresses: 42,
      activeWindow: 'VS Code'
    };
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers: getEmpHeaders('POST', endpoint, body) });
    logResult('Test Case 11 - Submit Heartbeat', 'Heartbeat enqueued with 202 Accepted status', `HTTP Status: ${res.status}`, res.status === 202);
  } catch (err) {
    logResult('Test Case 11 - Submit Heartbeat', 'Heartbeat persisted', err.response?.data?.message || err.message, false);
  }

  // Test Case 23 & 24: Break Tracking Heartbeats
  try {
    const ep1 = '/attendance/heartbeat';
    const bodyBreak = { status: 'Break', mouseClicks: 0, keyboardPresses: 0, activeWindow: 'Break Screen' };
    const resBreak = await axios.post(`${BASE_URL}${ep1}`, bodyBreak, { headers: getEmpHeaders('POST', ep1, bodyBreak) });
    logResult('Test Case 23 - Start Break Heartbeat', 'Persisted status Break', `Status: ${resBreak.status}`, resBreak.status === 202);

    const bodyResume = { status: 'Active', mouseClicks: 5, keyboardPresses: 12, activeWindow: 'VS Code' };
    const resResume = await axios.post(`${BASE_URL}${ep1}`, bodyResume, { headers: getEmpHeaders('POST', ep1, bodyResume) });
    logResult('Test Case 24 - Resume Work Heartbeat', 'Persisted status Active', `Status: ${resResume.status}`, resResume.status === 202);
  } catch (err) {
    logResult('Test Case 23 & 24 - Break Tracking', 'Correct break transitions', err.response?.data?.message || err.message, false);
  }

  // Wait 6 seconds for telemetry queue database flushing
  console.log('Waiting 6 seconds for async telemetry worker to flush queue...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  // Test Case 29: Productivity Analytics calculation
  try {
    const endpoint = '/attendance/productivity';
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers: getEmpHeaders('GET', endpoint) });
    const summary = res.data.summary;
    logResult('Test Case 29 - Productivity Daily calculation', 'Productivity calculated correctly', `Active: ${summary.activeHours}h, Idle: ${summary.idleHours}h, Break: ${summary.breakHours}h, Productivity: ${summary.productivityScore}%`, summary.productivityScore !== undefined);
  } catch (err) {
    logResult('Test Case 29 - Productivity Daily calculation', 'Productivity calculated correctly', err.response?.data?.message || err.message, false);
  }

  // Test Case 31: Manager Live Monitoring Dashboard
  try {
    const endpoint = '/attendance/live';
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers: getMgrHeaders('GET', endpoint) });
    const emp = res.data.employees.find(e => e.id === marcusId);
    const hasActiveWindow = emp && emp.activeWindow === 'VS Code';
    logResult('Test Case 31 - Manager Live Monitor', 'Managed employees status & active window displayed', `Marcus status: ${emp?.currentStatus || 'N/A'}, Window: ${emp?.activeWindow || 'N/A'}`, hasActiveWindow);
  } catch (err) {
    logResult('Test Case 31 - Manager Live Monitor', 'Managed employees status displayed', err.response?.data?.message || err.message, false);
  }

  // Test Case 48: RBAC Security Check
  try {
    const endpoint = '/attendance/live';
    await axios.get(`${BASE_URL}${endpoint}`, { headers: getEmpHeaders('GET', endpoint) });
    logResult('Test Case 48 - RBAC Security Check', '403 Forbidden for standard employees', 'Access granted', false);
  } catch (err) {
    logResult('Test Case 48 - RBAC Security Check', '403 Forbidden status', `Rejected with status: ${err.response?.status}`, err.response?.status === 403);
  }

  // Test Case 44: Performance Response Time latency validation
  const latencies = [];
  const endpointToday = '/attendance/today';
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    try {
      await axios.get(`${BASE_URL}${endpointToday}`, { headers: getEmpHeaders('GET', endpointToday) });
      latencies.push(Date.now() - start);
    } catch(e) {}
  }
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  logResult('Test Case 44 - API Response Latency', 'Average latency < 300ms', `${avgLatency.toFixed(2)}ms`, avgLatency < 300);

  // Replay Attack Validation
  try {
    const endpointToday = '/attendance/today';
    const duplicateHeaders = getEmpHeaders('GET', endpointToday);
    // Request 1: Succeeded
    await axios.get(`${BASE_URL}${endpointToday}`, { headers: duplicateHeaders });
    // Request 2: Reused nonce & signature
    await axios.get(`${BASE_URL}${endpointToday}`, { headers: duplicateHeaders });
    logResult('Test Case 50 - Replay Attack Protection', 'Reused nonce rejected with 403', 'Reused nonce accepted', false);
  } catch (err) {
    logResult('Test Case 50 - Replay Attack Protection', 'Reused nonce rejected with 403', `Rejected successfully with status: ${err.response?.status}`, err.response?.status === 403);
  }

  // Clean up
  try {
    const coHeaders = getEmpHeaders('POST', '/attendance/check-out', {});
    await axios.post(`${BASE_URL}/attendance/check-out`, {}, { headers: coHeaders });
  } catch (e) {}

  console.log('=== SECURE UAT RUN COMPLETED ===');
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
  
  await pool.end();
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

runUAT();
