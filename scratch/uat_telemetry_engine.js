const axios = require('axios');
const crypto = require('crypto');
const zlib = require('zlib');

const BASE_URL = 'http://localhost:5000/api';
const HMAC_SECRET = 'enterprise-workforce-hardening-secret-key-2026';
const DECRYPTION_KEY_MATERIAL = 'enterprise-offline-hardened-key-material-2026';
const SALT = Buffer.from('workforce-salt');

// Derive the encryption key using pbkdf2 sync (reproducing clientside logic)
const aesKey = crypto.pbkdf2Sync(DECRYPTION_KEY_MATERIAL, SALT, 1000, 32, 'sha256');

// Helper to encrypt payload using AES-GCM
function encryptPayload(payload) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', aesKey, iv);
  
  let ciphertext = cipher.update(JSON.stringify(payload), 'utf8');
  ciphertext = Buffer.concat([ciphertext, cipher.final()]);
  const tag = cipher.getAuthTag();
  
  // Web Crypto AES-GCM format appends the tag to the ciphertext
  const finalCiphertext = Buffer.concat([ciphertext, tag]);

  return {
    iv: iv.toString('base64'),
    ciphertext: finalCiphertext.toString('base64')
  };
}

// Helper to compile HMAC headers
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

async function runTelemetryEngineUAT() {
  console.log('=== STARTING ENTERPRISE TELEMETRY ENGINE UAT SUITE ===\n');
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

  let employeeToken;
  const testDeviceUuid = 'UAT_SECURE_TEST_DEVICE_FINGERPRINT_999'; // Seeded approved device

  // 1. Authenticate Employee
  try {
    const endpoint = '/auth/login';
    const body = {
      email: 'marcus.v@enterprise.io',
      password: 'password123'
    };
    const headers = getSecurityHeaders('POST', endpoint, body, {
      'x-device-fingerprint': testDeviceUuid
    });
    
    const res = await axios.post(`${BASE_URL}${endpoint}`, body, { headers });
    employeeToken = res.data.token;
    logResult('Employee Authentication', 'Successful login and token retrieval', 'Token retrieved successfully', true);
  } catch (err) {
    logResult('Employee Authentication', 'Successful login', err.response?.data?.message || err.message, false);
    return;
  }

  // Ensure checked in
  try {
    const checkinEndpoint = '/attendance/check-in';
    const checkinBody = { status: 'Present', remarks: 'UAT telemetry engine checkin' };
    const checkinHeaders = getSecurityHeaders('POST', checkinEndpoint, checkinBody, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    await axios.post(`${BASE_URL}${checkinEndpoint}`, checkinBody, { headers: checkinHeaders });
  } catch(e) {}

  // 2. Transmit Encrypted Heartbeat
  let savedHeaders = null;
  let savedBody = null;
  try {
    const endpoint = '/attendance/heartbeat';
    const plainPayload = {
      status: 'Active',
      mouseClicks: 12,
      keyboardPresses: 42,
      activeWindow: 'chrome.exe - [https://github.com/google] - Google Repos (Chrome, Duration: 5000ms)',
      timestamp: new Date().toISOString()
    };

    const encryptedBody = encryptPayload(plainPayload);
    savedBody = encryptedBody;
    const headers = getSecurityHeaders('POST', endpoint, encryptedBody, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid,
      'x-device-uuid': testDeviceUuid
    });
    savedHeaders = headers;

    const res = await axios.post(`${BASE_URL}${endpoint}`, encryptedBody, { headers });
    logResult(
      'Encrypted Heartbeat Delivery',
      '202 Accepted status indicating successful decryption and ingestion',
      `HTTP Status: ${res.status}, Message: "${res.data.message}"`,
      res.status === 202
    );
  } catch (err) {
    logResult('Encrypted Heartbeat Delivery', '202 Accepted', err.response?.data?.message || err.message, false);
  }

  // 3. Prevent Replay Attack (Duplicate Headers & Body)
  try {
    const endpoint = '/attendance/heartbeat';
    await axios.post(`${BASE_URL}${endpoint}`, savedBody, { headers: savedHeaders });
    logResult('Replay Attack Prevention', '403 Forbidden', '202 OK (Replay Allowed)', false);
  } catch (err) {
    const code = err.response?.status;
    const msg = err.response?.data?.message;
    logResult(
      'Replay Attack Prevention',
      '403 Forbidden with Replay attack warning',
      `HTTP Status: ${code}, Message: "${msg}"`,
      code === 403 && msg.includes('Replay attack signature match')
    );
  }

  // 4. Time Drift Validation
  try {
    const endpoint = '/attendance/heartbeat';
    const plainPayload = { status: 'Active' };
    const encryptedBody = encryptPayload(plainPayload);
    
    // Inject expired timestamp (10 minutes ago)
    const expiredTime = (Date.now() - 10 * 60 * 1000).toString();
    const nonce = 'driftnonce123';
    const bodyStr = JSON.stringify(encryptedBody);
    const messageToSign = `POST:/attendance/heartbeat:${expiredTime}:${nonce}:${bodyStr}`;
    const forgedSignature = crypto.createHmac('sha256', HMAC_SECRET).update(messageToSign).digest('hex');

    const headers = {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid,
      'x-device-uuid': testDeviceUuid,
      'x-signature': forgedSignature,
      'x-timestamp': expiredTime,
      'x-nonce': nonce
    };

    await axios.post(`${BASE_URL}${endpoint}`, encryptedBody, { headers });
    logResult('Timestamp Drift Validation', '403 Forbidden', '202 OK (Expired request allowed)', false);
  } catch (err) {
    const code = err.response?.status;
    const msg = err.response?.data?.message;
    logResult(
      'Timestamp Drift Validation',
      '403 Forbidden with expired request message',
      `HTTP Status: ${code}, Message: "${msg}"`,
      code === 403 && msg.includes('timestamp expired')
    );
  }

  // 5. Sync Gzipped & Encrypted Bulk Telemetry Batch
  try {
    const endpoint = '/attendance/bulk-heartbeat';
    const mockTelemetryBatch = [
      { status: 'Active', mouseClicks: 5, keyboardPresses: 10, activeWindow: 'code.exe - index.js', timestamp: new Date(Date.now() - 90000).toISOString() },
      { status: 'Idle', mouseClicks: 0, keyboardPresses: 0, activeWindow: null, timestamp: new Date().toISOString() }
    ];

    const jsonStr = JSON.stringify(mockTelemetryBatch);
    const compressedB64 = zlib.gzipSync(Buffer.from(jsonStr)).toString('base64');
    
    const rawPayload = { compressedData: compressedB64 };
    const encryptedBody = encryptPayload(rawPayload);
    const headers = getSecurityHeaders('POST', endpoint, encryptedBody, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid,
      'x-device-uuid': testDeviceUuid
    });

    const res = await axios.post(`${BASE_URL}${endpoint}`, encryptedBody, { headers });
    logResult(
      'Gzipped & Encrypted Bulk Sync',
      '201 Created, with correct bulk record count parsed and saved',
      `HTTP Status: ${res.status}, Count Parsed: ${res.data.count}`,
      res.status === 201 && res.data.count > 0
    );
  } catch (err) {
    logResult('Gzipped & Encrypted Bulk Sync', '201 Created', err.response?.data?.message || err.message, false);
  }

  // Wait for the async telemetry worker to flush queue before ending
  console.log('Waiting 6 seconds for async queue to flush...');
  await new Promise(resolve => setTimeout(resolve, 6000));

  console.log('=== TELEMETRY ENGINE UAT COMPLETE ===');
  console.log(`Passed: ${results.passed.length}, Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

runTelemetryEngineUAT();
