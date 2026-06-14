const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5000/api';
const HMAC_SECRET = 'enterprise-workforce-hardening-secret-key-2026';
const DECRYPTION_KEY_MATERIAL = 'enterprise-offline-hardened-key-material-2026';
const SALT = Buffer.from('workforce-salt');
const aesKey = crypto.pbkdf2Sync(DECRYPTION_KEY_MATERIAL, SALT, 1000, 32, 'sha256');

// Encrypt payload function
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

// Security headers helper
function getSecurityHeaders(method, endpoint, body = null, extraHeaders = {}) {
  const timestamp = Date.now().toString();
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  const cleanEndpoint = endpoint.startsWith('/api') ? endpoint.substring(4) : endpoint;
  const messageToSign = `${method.toUpperCase()}:${cleanEndpoint}:${timestamp}:${nonce}:${bodyStr}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(messageToSign).digest('hex');
  return {
    'x-signature': signature,
    'x-timestamp': timestamp,
    'x-nonce': nonce,
    ...extraHeaders
  };
}

async function runProductivityUAT() {
  console.log('=== STARTING ENTERPRISE PRODUCTIVITY INTELLIGENCE UAT SUITE ===\n');

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

  // Perform database cleanup for Marcus to get accurate Focus Score results
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
    
    // Clean database.json as well if it exists
    const fs = require('fs');
    const path = require('path');
    const dbPath = path.resolve(__dirname, '../backend/database.json');
    if (fs.existsSync(dbPath)) {
      const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));
      if (data.activity_heartbeats) {
        data.activity_heartbeats = data.activity_heartbeats.filter(h => h.employee_id !== 4);
      }
      if (data.attendance) {
        data.attendance = data.attendance.filter(a => !(a.employee_id === 4 && a.date === todayStr));
      }
      fs.writeFileSync(dbPath, JSON.stringify(data, null, 2), 'utf8');
    }
  } catch (e) {
    console.warn('Cleanup warning:', e.message);
  } finally {
    await pool.end();
  }

  let employeeToken, adminToken;
  const testDeviceUuid = 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999';

  // 1. Authenticate users
  try {
    // Employee
    let endpoint = '/auth/login';
    let body = { email: 'marcus.v@enterprise.io', password: 'password123' };
    let headers = getSecurityHeaders('POST', endpoint, body, { 'x-device-fingerprint': testDeviceUuid });
    let res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    employeeToken = res.data.token;

    // Admin
    body = { email: 'sarah.j@enterprise.io', password: 'password123' };
    headers = getSecurityHeaders('POST', endpoint, body, { 'x-device-fingerprint': testDeviceUuid });
    res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    adminToken = res.data.token;

    logResult('Authentication Handshake', 'Retrieve employee & admin tokens', 'Tokens retrieved successfully', true);
  } catch (err) {
    logResult('Authentication Handshake', 'Tokens retrieved', err.response?.data?.message || err.message, false);
    return;
  }

  // Ensure checked in
  try {
    const checkinEndpoint = '/attendance/check-in';
    const checkinBody = { status: 'Present', remarks: 'UAT productivity engine checkin' };
    const checkinHeaders = getSecurityHeaders('POST', checkinEndpoint, checkinBody, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    await axios.post(`${BASE_URL}${checkinEndpoint}`, checkinBody, { headers: checkinHeaders });
  } catch(e) {}

  // 2. Fetch current classifications
  try {
    const endpoint = '/productivity/classifications';
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });
    logResult(
      'Fetch Productivity Classifications',
      'List of active corporate patterns, categories, and tags retrieved',
      `Rules Count: ${res.data.length}, Sample: ${res.data[0]?.pattern}`,
      res.status === 200 && res.data.length > 0
    );
  } catch (err) {
    logResult('Fetch Productivity Classifications', 'Rules list', err.response?.data?.message || err.message, false);
  }

  // 3. Admin creates/updates a dynamic classification rule live
  const customPattern = 'youtube.com';
  try {
    const endpoint = '/productivity/classifications';
    const body = {
      pattern: customPattern,
      category: 'Productive',
      tag: 'Learning',
      score: 95
    };
    const headers = getSecurityHeaders('POST', endpoint, body, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    logResult(
      'Live Rule Management Update',
      'Rules updated dynamically (e.g. YouTube -> Productive/Learning/95%)',
      `Pattern: ${res.data.pattern}, Category: ${res.data.category}, Tag: ${res.data.tag}, Score: ${res.data.score}%`,
      res.status === 200 && res.data.pattern === customPattern && res.data.score === 95
    );
  } catch (err) {
    logResult('Live Rule Management Update', 'Success response', err.response?.data?.message || err.message, false);
  }

  // 4. Employee sends telemetry using modified domain
  try {
    const endpoint = '/attendance/heartbeat';
    const plainPayload = {
      status: 'Active',
      mouseClicks: 15,
      keyboardPresses: 30,
      activeWindow: 'chrome.exe - [https://youtube.com/watch?v=react] - Learning React - youtube.com',
      timestamp: new Date().toISOString()
    };
    const encryptedBody = encryptPayload(plainPayload);
    const headers = getSecurityHeaders('POST', endpoint, encryptedBody, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid,
      'x-device-uuid': testDeviceUuid
    });

    const res = await axios.post(`${BASE_URL}${endpoint}`, encryptedBody, { headers });
    logResult(
      'Telemetry Heartbeat Dispatch',
      'Heartbeat successfully enqueued with modified domain context',
      `HTTP Status: ${res.status}`,
      res.status === 202
    );
  } catch (err) {
    logResult('Telemetry Heartbeat Dispatch', 'Success status', err.response?.data?.message || err.message, false);
  }

  // Wait 6 seconds for the backend's async queue worker to flush heartbeats to database
  console.log('Waiting 6 seconds for async queue flush...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  // 5. Manager queries live statistics to verify instantaneous scoring calculation
  try {
    const endpoint = '/attendance/live';
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });
    
    // Find our employee (Marcus)
    const empRecord = res.data.employees.find(e => e.email === 'marcus.v@enterprise.io');
    const ok = empRecord && empRecord.todayStats.focusScore === 95;
    
    logResult(
      'Realtime Dynamic Scoring & Verification',
      'Calculated Focus Score matches newly seeded rules (95%) instantly without restarts',
      `Employee Focus Score: ${empRecord?.todayStats?.focusScore}%, Weekly: ${empRecord?.todayStats?.weeklyScore}%, Monthly: ${empRecord?.todayStats?.monthlyScore}%`,
      ok
    );
  } catch (err) {
    logResult('Realtime Dynamic Scoring & Verification', 'Instant focus score verification', err.response?.data?.message || err.message, false);
  }

  console.log('=== PRODUCTIVITY INTELLIGENCE UAT COMPLETE ===');
  console.log(`Passed: ${results.passed.length}, Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

runProductivityUAT();
