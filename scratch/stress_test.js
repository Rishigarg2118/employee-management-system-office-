const axios = require('crypto');
const axiosLib = require('axios');
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

function getSecurityHeaders(method, endpoint, body = null, deviceUuid = 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999') {
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
    'x-device-fingerprint': deviceUuid,
    'x-device-uuid': deviceUuid
  };
}

async function runStressTest() {
  console.log('=== STARTING ENTERPRISE CONCURRENCY & STRESS TEST ===');
  
  try {
    // 1. Clear database state for today to ensure checks are valid
    console.log('[Setup] Cleaning up today\'s attendance and heartbeats in database...');
    await pool.query('DELETE FROM activity_heartbeats WHERE timestamp::DATE = CURRENT_DATE');
    await pool.query('DELETE FROM attendance WHERE date = CURRENT_DATE');

    const devices = [
      { uuid: 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999', email: 'marcus.v@enterprise.io', name: 'Marcus Workstation' },
      { uuid: 'DEVICE-STRESS-TEST-UUID-DAVID', email: 'david.c@enterprise.io', name: 'David Workstation' },
      { uuid: 'DEVICE-STRESS-TEST-UUID-SARAH', email: 'sarah.j@enterprise.io', name: 'Sarah Workstation' }
    ];

    for (const d of devices) {
      const empRes = await pool.query('SELECT id FROM employees WHERE email = $1', [d.email]);
      if (empRes.rows.length > 0) {
        const empId = empRes.rows[0].id;
        await pool.query(`
          INSERT INTO agent_devices (employee_id, device_uuid, os_platform, hostname, platform, status, device_name, hardware_fingerprint, installation_id)
          VALUES ($1, $2, 'Windows', 'STRESS-RIG', 'win32', 'Approved', $3, $2, $4)
          ON CONFLICT (device_uuid) DO UPDATE SET status = 'Approved', employee_id = $1
        `, [empId, d.uuid, d.name, 'INST-' + d.uuid]);
      }
    }
    console.log('[Setup] Setup complete.');
  } catch (err) {
    console.error('[Setup] Failed to seed/approve devices:', err);
  }

  const testAccounts = [
    { email: 'marcus.v@enterprise.io', pass: 'password123', deviceUuid: 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999' },
    { email: 'david.c@enterprise.io', pass: 'password123', deviceUuid: 'DEVICE-STRESS-TEST-UUID-DAVID' },
    { email: 'sarah.j@enterprise.io', pass: 'password123', deviceUuid: 'DEVICE-STRESS-TEST-UUID-SARAH' }
  ];

  const resolvedSessions = [];

  console.log('\n[Phase 1] Authenticating accounts concurrently...');
  for (const acc of testAccounts) {
    try {
      const endpoint = '/auth/login';
      const body = { email: acc.email, password: acc.pass };
      const headers = getSecurityHeaders('POST', endpoint, body, acc.deviceUuid);
      const res = await axiosLib.post(`${BASE_URL}${endpoint}`, body, { headers });
      
      resolvedSessions.push({
        email: acc.email,
        token: res.data.token,
        deviceUuid: acc.deviceUuid
      });
    } catch (err) {
      console.error(`Auth failed for ${acc.email}:`, err.response?.data?.message || err.message);
    }
  }

  console.log(`Authenticated ${resolvedSessions.length}/${testAccounts.length} sessions.`);

  // Ensure employees are checked in first to accept heartbeats
  console.log('\n[Phase 2] Punching in sessions...');
  for (const session of resolvedSessions) {
    try {
      const checkinEp = '/attendance/check-in';
      const checkinBody = { status: 'Present', remarks: 'Stress Test Checkin' };
      const checkinHeaders = {
        ...getSecurityHeaders('POST', checkinEp, checkinBody, session.deviceUuid),
        'Authorization': `Bearer ${session.token}`
      };
      await axiosLib.post(`${BASE_URL}${checkinEp}`, checkinBody, { headers: checkinHeaders });
      console.log(`  Punched in: ${session.email}`);
    } catch (e) {
      console.log(`  Punch-in failed for ${session.email}: ${e.response?.data?.message || e.message}`);
    }
  }

  const concurrencyCount = 200;
  console.log(`\n[Phase 3] Dispatching ${concurrencyCount} concurrent telemetry heartbeats...`);
  
  const startTime = Date.now();
  let successCount = 0;
  let errorCount = 0;
  const errors = [];

  const heartbeatPromises = Array.from({ length: concurrencyCount }).map(async (_, idx) => {
    const session = resolvedSessions[idx % resolvedSessions.length];
    const heartbeatEp = '/attendance/heartbeat';
    const payload = {
      status: idx % 10 === 0 ? 'Idle' : 'Active',
      mouseClicks: Math.floor(Math.random() * 50),
      keyboardPresses: Math.floor(Math.random() * 100),
      activeWindow: `Stress Test Process #${idx}`
    };

    const headers = {
      ...getSecurityHeaders('POST', heartbeatEp, payload, session.deviceUuid),
      'Authorization': `Bearer ${session.token}`
    };

    try {
      const res = await axiosLib.post(`${BASE_URL}${heartbeatEp}`, payload, { headers });
      if (res.status === 202) {
        successCount++;
      } else {
        errorCount++;
      }
    } catch (err) {
      errorCount++;
      if (errors.length < 5) {
        errors.push({
          email: session.email,
          status: err.response?.status,
          message: err.response?.data?.message || err.message
        });
      }
    }
  });

  await Promise.all(heartbeatPromises);
  const totalDuration = Date.now() - startTime;

  console.log('\n=== STRESS TEST METRICS ===');
  console.log(`Total Requests Sent : ${concurrencyCount}`);
  console.log(`Success Count       : ${successCount}`);
  console.log(`Error/Reject Count  : ${errorCount}`);
  console.log(`Total Time Taken    : ${totalDuration}ms`);
  console.log(`Avg Request Latency : ${(totalDuration / concurrencyCount).toFixed(2)}ms`);
  console.log(`Success Rate        : ${((successCount / concurrencyCount) * 100).toFixed(1)}%`);

  if (errors.length > 0) {
    console.log('\nSample Rejection Details:');
    console.log(errors);
  }

  const passed = successCount > 0 && errorCount === 0;
  console.log(`\nResult: ${passed ? '✅ PASSED' : '❌ FAILED'}`);
  
  await pool.end();
}

runStressTest();
