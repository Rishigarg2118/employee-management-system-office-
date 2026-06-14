const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5000/api';
const HMAC_SECRET = 'enterprise-workforce-hardening-secret-key-2026';

function getSecurityHeaders(method, endpoint, body = null, extraHeaders = {}) {
  const timestamp = Date.now().toString();
  const nonce = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  const bodyStr = body && Object.keys(body).length > 0 ? JSON.stringify(body) : '';
  
  // Strip /api if endpoint has it
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

async function runDeviceTrustUAT() {
  console.log('=== STARTING ENTERPRISE DEVICE TRUST UAT TEST SUITE ===\n');
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

  let employeeToken, adminToken;
  let deviceRecordId;
  const testDeviceUuid = `DEVICE-TRUST-TEST-UUID-${Date.now()}`;

  // 1. Log in as employee
  try {
    const endpoint = '/auth/login';
    const body = {
      email: 'marcus.v@enterprise.io',
      password: 'password123'
    };
    const headers = getSecurityHeaders('POST', endpoint, body, {
      'x-device-fingerprint': 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999' // Seeded approved device for login
    });
    
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    employeeToken = res.data.token;
    logResult('Employee Login', 'Successful authentication', 'Token received successfully', true);
  } catch (err) {
    logResult('Employee Login', 'Successful authentication', err.response?.data?.message || err.message, false);
    return;
  }

  // 2. Log in as admin
  try {
    const endpoint = '/auth/login';
    const body = {
      email: 'sarah.j@enterprise.io',
      password: 'password123'
    };
    const headers = getSecurityHeaders('POST', endpoint, body, {
      'x-device-fingerprint': 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999'
    });
    
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    adminToken = res.data.token;
    logResult('Admin Login', 'Successful authentication', 'Token received successfully', true);
  } catch (err) {
    logResult('Admin Login', 'Successful authentication', err.response?.data?.message || err.message, false);
    return;
  }

  // 3. Register device as employee
  try {
    const endpoint = '/devices/register';
    const body = {
      device_uuid: testDeviceUuid,
      os_platform: 'Windows',
      hostname: 'UAT-TRUST-HOST',
      platform: 'win32',
      architecture: 'x64',
      app_version: '1.2.0',
      agent_version: '1.2.0',
      timezone: 'GMT+5:30',
      language: 'en-US',
      screen_resolution: '1920x1080',
      device_name: 'Workstation Trust Rig',
      hardware_fingerprint: 'HW-FINGERPRINT-TEST-999',
      installation_id: 'INST-ID-TEST-999'
    };
    const headers = getSecurityHeaders('POST', endpoint, body, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid // Self-referencing fingerprint for registration route
    });
    
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    deviceRecordId = res.data.device.id;
    const initialStatus = res.data.device.status;
    logResult(
      'Register Device',
      'Device registered successfully with status Pending',
      `Device ID: ${deviceRecordId}, Status: ${initialStatus}`,
      initialStatus === 'Pending'
    );
  } catch (err) {
    logResult('Register Device', 'Device registered successfully', JSON.stringify(err.response?.data || err.message), false);
    return;
  }

  // 4. Try sending heartbeat with Pending device - Expect 403 Forbidden
  try {
    const endpoint = '/attendance/heartbeat';
    const body = { status: 'Active' };
    const headers = getSecurityHeaders('POST', endpoint, body, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid,
      'x-device-uuid': testDeviceUuid
    });
    
    await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    logResult('Heartbeat from Pending Device', '403 Forbidden', '200 OK (Allowed improperly)', false);
  } catch (err) {
    const code = err.response?.status;
    const msg = err.response?.data?.message;
    logResult(
      'Heartbeat from Pending Device',
      '403 Forbidden with device approval message',
      `HTTP Status: ${code}, Message: "${msg}"`,
      code === 403 && (msg.includes('must be Approved') || msg.includes('authorization status is: Pending'))
    );
  }

  // 5. Admin Approves device
  try {
    const endpoint = `/devices/${deviceRecordId}/status`;
    const body = { status: 'Approved' };
    const headers = getSecurityHeaders('PUT', endpoint, body, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999'
    });
    
    const res = await axios.put(`${BASE_URL}${endpoint}`, body, { headers });
    logResult(
      'Approve Device Status',
      'Device status changed to Approved',
      `Status: ${res.data.device.status}`,
      res.data.device.status === 'Approved'
    );
  } catch (err) {
    logResult('Approve Device Status', 'Device status changed to Approved', err.response?.data?.message || err.message, false);
  }

  // 6. Try sending heartbeat with Approved device - Expect 200 OK or 202 Accepted
  try {
    // Check-in first if needed
    try {
      const checkinEndpoint = '/attendance/check-in';
      const checkinBody = { status: 'Present', remarks: 'UAT setup checkin' };
      const checkinHeaders = getSecurityHeaders('POST', checkinEndpoint, checkinBody, {
        'Authorization': `Bearer ${employeeToken}`,
        'x-device-fingerprint': testDeviceUuid
      });
      await axios.post(`${BASE_URL}${checkinEndpoint}`, checkinBody, { headers: checkinHeaders });
    } catch(e) {}

    const endpoint = '/attendance/heartbeat';
    const body = { status: 'Active' };
    const headers = getSecurityHeaders('POST', endpoint, body, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid,
      'x-device-uuid': testDeviceUuid
    });
    
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    logResult(
      'Heartbeat from Approved Device',
      '200 OK or 202 Accepted with success indicator',
      `HTTP Status: ${res.status}, Success: ${res.data.success || 'true'}`,
      res.status === 200 || res.status === 201 || res.status === 202
    );
  } catch (err) {
    logResult('Heartbeat from Approved Device', '200 OK or 202 Accepted', err.response?.data?.message || err.message, false);
  }

  // 7. Admin Blocks device
  try {
    const endpoint = `/devices/${deviceRecordId}/status`;
    const body = { status: 'Blocked' };
    const headers = getSecurityHeaders('PUT', endpoint, body, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999'
    });
    
    const res = await axios.put(`${BASE_URL}${endpoint}`, body, { headers });
    logResult(
      'Block Device Status',
      'Device status changed to Blocked',
      `Status: ${res.data.device.status}`,
      res.data.device.status === 'Blocked'
    );
  } catch (err) {
    logResult('Block Device Status', 'Device status changed to Blocked', err.response?.data?.message || err.message, false);
  }

  // 8. Try sending heartbeat with Blocked device - Expect 403 Forbidden
  try {
    const endpoint = '/attendance/heartbeat';
    const body = { status: 'Active' };
    const headers = getSecurityHeaders('POST', endpoint, body, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid,
      'x-device-uuid': testDeviceUuid
    });
    
    await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    logResult('Heartbeat from Blocked Device', '403 Forbidden', '200 OK (Allowed improperly)', false);
  } catch (err) {
    const code = err.response?.status;
    const msg = err.response?.data?.message;
    logResult(
      'Heartbeat from Blocked Device',
      '403 Forbidden with blocked status message',
      `HTTP Status: ${code}, Message: "${msg}"`,
      code === 403 && (msg.includes('Blocked') || msg.includes('must be Approved') || msg.includes('authorization status is: Blocked'))
    );
  }

  // 9. Admin Unblocks/Re-approves device
  try {
    const endpoint = `/devices/${deviceRecordId}/status`;
    const body = { status: 'Approved' };
    const headers = getSecurityHeaders('PUT', endpoint, body, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999'
    });
    
    const res = await axios.put(`${BASE_URL}${endpoint}`, body, { headers });
    logResult(
      'Unblock Device Status',
      'Device status restored to Approved',
      `Status: ${res.data.device.status}`,
      res.data.device.status === 'Approved'
    );
  } catch (err) {
    logResult('Unblock Device Status', 'Device status restored to Approved', err.response?.data?.message || err.message, false);
  }

  // 10. Check Audit Logs for registration and status transitions
  try {
    const endpoint = '/audit-logs';
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999'
    });
    
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });
    const logs = res.data;
    const hasRegLog = logs.some(l => 
      (l.action && l.action.includes(testDeviceUuid)) || 
      (l.new_value && l.new_value.includes(testDeviceUuid))
    );
    const hasStatusLog = logs.some(l => 
      (l.action && l.action.includes('Blocked')) || 
      (l.new_value && l.new_value.includes('Blocked'))
    );
    logResult(
      'Audit Logging Verification',
      'Audit entries exist for device registration and Block status transition',
      `Registration Log found: ${hasRegLog}, Status Log found: ${hasStatusLog}`,
      hasRegLog && hasStatusLog
    );
  } catch (err) {
    logResult('Audit Logging Verification', 'Audit entries verified', err.response?.data?.message || err.message, false);
  }

  console.log('=== DEVICE TRUST UAT COMPLETE ===');
  console.log(`Passed: ${results.passed.length}, Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

runDeviceTrustUAT();
