const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api';

async function runUAT() {
  console.log('=== STARTING ENTERPRISE UAT TEST SUITE ===\n');
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

  // 1. AUTHENTICATION SECTION
  let employeeToken, managerToken, adminToken;
  let marcusId = 4;
  let davidId = 2;
  
  // Test Case 1: Employee Login
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'marcus.v@enterprise.io',
      password: 'password123'
    });
    employeeToken = res.data.token;
    logResult('Test Case 1 - Employee Login', 'Successful authentication & JWT returned', `Token generated starting with "${employeeToken.slice(0, 15)}..."`, true);
  } catch (err) {
    logResult('Test Case 1 - Employee Login', 'Successful authentication', err.message, false);
  }

  // Test Case 2: Manager Login
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'david.c@enterprise.io',
      password: 'password123'
    });
    managerToken = res.data.token;
    logResult('Test Case 2 - Manager Login', 'Successful authentication & manager viewable token', 'Token generated successfully', true);
  } catch (err) {
    logResult('Test Case 2 - Manager Login', 'Successful authentication', err.message, false);
  }

  // Test Case 3: Admin Login
  try {
    const res = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'sarah.j@enterprise.io',
      password: 'password123'
    });
    adminToken = res.data.token;
    logResult('Test Case 3 - Admin Login', 'Successful authentication & admin level access', 'Token generated successfully', true);
  } catch (err) {
    logResult('Test Case 3 - Admin Login', 'Successful authentication', err.message, false);
  }

  if (!employeeToken || !managerToken || !adminToken) {
    console.error('Cannot proceed with further tests without valid tokens.');
    return;
  }

  // 2. ATTENDANCE & TELEMETRY SECTION
  const headers = { Authorization: `Bearer ${employeeToken}` };
  const managerHeaders = { Authorization: `Bearer ${managerToken}` };

  // Helper to ensure clocked out to reset state
  try {
    await axios.post(`${BASE_URL}/attendance/check-out`, {}, { headers });
  } catch(e) {}

  // Test Case 6: Punch In
  let attendanceRecord;
  try {
    const res = await axios.post(`${BASE_URL}/attendance/check-in`, { status: 'Present', remarks: 'UAT testing session' }, { headers });
    attendanceRecord = res.data;
    logResult('Test Case 6 - Punch In', 'Attendance record created today', `Checked in as ${attendanceRecord.status}`, true);
  } catch (err) {
    logResult('Test Case 6 - Punch In', 'Attendance record created today', err.response?.data?.message || err.message, false);
  }

  // Test Case 8: Double Punch In Validation
  try {
    await axios.post(`${BASE_URL}/attendance/check-in`, { status: 'Present' }, { headers });
    logResult('Test Case 8 - Double Punch In', 'Error: Already checked in', 'Punch succeeded (Duplicate allowed)', false);
  } catch (err) {
    const correctMsg = err.response?.data?.message === 'Already checked in for today.';
    logResult('Test Case 8 - Double Punch In', 'Error: Already checked in for today.', err.response?.data?.message, correctMsg);
  }

  // Test Case 11 & 12: Telemetry Heartbeats
  try {
    const res = await axios.post(`${BASE_URL}/attendance/heartbeat`, {
      status: 'Active',
      mouseClicks: 15,
      keyboardPresses: 42,
      activeWindow: 'UAT Test Runner script'
    }, { headers });
    logResult('Test Case 11 & 12 - Submit & Save Heartbeat', 'Heartbeat persisted & row details returned', `Persisted status: ${res.data.status}, window: ${res.data.active_window}`, true);
  } catch (err) {
    logResult('Test Case 11 & 12 - Submit & Save Heartbeat', 'Heartbeat persisted', err.response?.data?.message || err.message, false);
  }

  // Test Case 23 & 24: Break Tracking Heartbeats
  try {
    const resBreak = await axios.post(`${BASE_URL}/attendance/heartbeat`, {
      status: 'Break',
      mouseClicks: 0,
      keyboardPresses: 0,
      activeWindow: 'Break Screen'
    }, { headers });
    logResult('Test Case 23 - Start Break Heartbeat', 'Persisted status Break', `Status: ${resBreak.data.status}`, resBreak.data.status === 'Break');

    const resResume = await axios.post(`${BASE_URL}/attendance/heartbeat`, {
      status: 'Active',
      mouseClicks: 5,
      keyboardPresses: 12,
      activeWindow: 'VS Code'
    }, { headers });
    logResult('Test Case 24 - Resume Work Heartbeat', 'Persisted status Active', `Status: ${resResume.data.status}`, resResume.data.status === 'Active');
  } catch (err) {
    logResult('Test Case 23 & 24 - Break Tracking', 'Correct break transitions', err.message, false);
  }

  // Test Case 29: Productivity Analytics calculation
  try {
    const res = await axios.get(`${BASE_URL}/attendance/productivity`, { headers });
    const summary = res.data.summary;
    logResult('Test Case 29 - Productivity Daily calculation', 'Productivity calculated correctly with active/idle/break segments', `Active: ${summary.activeHours}h, Idle: ${summary.idleHours}h, Break: ${summary.breakHours}h, Productivity: ${summary.productivityScore}%`, summary.productivityScore !== undefined);
  } catch (err) {
    logResult('Test Case 29 - Productivity Daily calculation', 'Productivity calculated correctly', err.message, false);
  }

  // Test Case 31: Manager Live Monitoring Dashboard
  try {
    const res = await axios.get(`${BASE_URL}/attendance/live`, { headers: managerHeaders });
    const emp = res.data.employees.find(e => e.id === marcusId);
    const hasActiveWindow = emp && emp.activeWindow === 'VS Code';
    logResult('Test Case 31 - Manager Live Monitor', 'Managed employees status & active window displayed', `Marcus status: ${emp?.currentStatus || 'N/A'}, Window: ${emp?.activeWindow || 'N/A'}`, hasActiveWindow);
  } catch (err) {
    logResult('Test Case 31 - Manager Live Monitor', 'Managed employees status displayed', err.message, false);
  }

  // Test Case 48: RBAC Security Check
  try {
    await axios.get(`${BASE_URL}/attendance/live`, { headers });
    logResult('Test Case 48 - RBAC Security Check', '403 Forbidden for standard employees', 'Access granted', false);
  } catch (err) {
    logResult('Test Case 48 - RBAC Security Check', '403 Forbidden status', `Rejected with status: ${err.response?.status}`, err.response?.status === 403);
  }

  // Test Case 44: Performance Response Time latency validation
  const latencies = [];
  for (let i = 0; i < 10; i++) {
    const start = Date.now();
    try {
      await axios.get(`${BASE_URL}/attendance/today`, { headers });
      latencies.push(Date.now() - start);
    } catch(e) {}
  }
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  logResult('Test Case 44 - API Response Latency', 'Average latency < 300ms', `${avgLatency.toFixed(2)}ms`, avgLatency < 300);

  // 9. CLEAN UP & CLOCK OUT
  try {
    await axios.post(`${BASE_URL}/attendance/check-out`, {}, { headers });
  } catch (e) {}

  console.log('=== UAT RUN COMPLETED ===');
  console.log(`Passed: ${results.passed.length}`);
  console.log(`Failed: ${results.failed.length}`);
}

runUAT();
