const axios = require('axios');
const crypto = require('crypto');

const BASE_URL = 'http://localhost:5000/api';
const HMAC_SECRET = 'enterprise-workforce-hardening-secret-key-2026';

// HMAC request signature helper
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

async function runReportsUAT() {
  console.log('=== STARTING ENTERPRISE ANALYTICS REPORTING ENGINE UAT ===\n');
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

    logResult('UAT Authentication Handshake', 'Tokens for employee and admin retrieved', 'Tokens retrieved successfully', true);
  } catch (err) {
    logResult('UAT Authentication Handshake', 'Tokens retrieved', err.response?.data?.message || err.message, false);
    return;
  }

  // 2. Fetch Daily Report (Admin)
  try {
    const todayStr = new Date().toISOString().split('T')[0];
    const endpoint = `/reports/analytics?reportType=daily&startDate=${todayStr}&endDate=${todayStr}`;
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });
    
    const ok = res.status === 200 && Array.isArray(res.data.data) && res.data.total !== undefined;
    logResult(
      'Fetch Daily Activity Report',
      'Get list of daily active staff metrics and checkin states',
      `Data records: ${res.data.data.length}, Total: ${res.data.total}`,
      ok
    );
  } catch (err) {
    logResult('Fetch Daily Activity Report', 'Success response', err.response?.data?.message || err.message, false);
  }

  // 3. Fetch Weekly Report with Pagination
  try {
    const today = new Date();
    const lastWeek = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7);
    const startDate = lastWeek.toISOString().split('T')[0];
    const endDate = today.toISOString().split('T')[0];

    const endpoint = `/reports/analytics?reportType=weekly&startDate=${startDate}&endDate=${endDate}&page=1&limit=2`;
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });
    
    const ok = res.status === 200 && res.data.data.length <= 2 && res.data.limit === 2 && res.data.page === 1;
    logResult(
      'Weekly Report with Pagination',
      'Get paginated weekly metrics list (limit: 2, page: 1)',
      `Data records: ${res.data.data.length}, Page: ${res.data.page}, Limit: ${res.data.limit}, Total: ${res.data.total}`,
      ok
    );
  } catch (err) {
    logResult('Weekly Report with Pagination', 'Success paginated response', err.response?.data?.message || err.message, false);
  }

  // 4. Fetch Department Report with Filter
  try {
    const endpoint = '/reports/analytics?reportType=department&departmentId=1';
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });
    
    const ok = res.status === 200 && res.data.data.length >= 0;
    logResult(
      'Department Report Filtered',
      'Get department analytics filtered to Engineering (ID: 1)',
      `Departments returned: ${res.data.data.length}`,
      ok
    );
  } catch (err) {
    logResult('Department Report Filtered', 'Success response', err.response?.data?.message || err.message, false);
  }

  // 5. Test Role-Based Restrictions (Low Privilege Block)
  try {
    const endpoint = '/reports/analytics?reportType=weekly';
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${employeeToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    await axios.get(`${BASE_URL}${endpoint}`, { headers });
    logResult('Role Authorization Enforcement', 'Access blocked with 403 Forbidden for low-privilege employee', 'Access was incorrectly allowed', false);
  } catch (err) {
    const blocked = err.response && err.response.status === 403;
    logResult(
      'Role Authorization Enforcement',
      'Access blocked with 403 Forbidden for low-privilege employee',
      `HTTP Status: ${err.response?.status}, Message: ${err.response?.data?.message}`,
      blocked
    );
  }

  // 6. Fetch Application Usage Report
  try {
    const endpoint = '/reports/analytics?reportType=application-usage';
    const headers = getSecurityHeaders('GET', endpoint, null, {
      'Authorization': `Bearer ${adminToken}`,
      'x-device-fingerprint': testDeviceUuid
    });
    const res = await axios.get(`${BASE_URL}${endpoint}`, { headers });
    
    const ok = res.status === 200 && Array.isArray(res.data.data);
    logResult(
      'Fetch Application Usage Report',
      'Retrieve ranking list of corporate application process durations',
      `App Records: ${res.data.data.length}`,
      ok
    );
  } catch (err) {
    logResult('Fetch Application Usage Report', 'Success response', err.response?.data?.message || err.message, false);
  }

  console.log('=== ENTERPRISE ANALYTICS REPORTING ENGINE UAT COMPLETE ===');
  console.log(`Passed: ${results.passed.length}, Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

runReportsUAT();
