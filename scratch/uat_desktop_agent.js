const crypto = require('crypto');

// Mocking browser/Tauri global APIs before importing telemetryService
const mockLocalStorageStore = {};
globalThis.localStorage = {
  getItem: (key) => mockLocalStorageStore[key] || null,
  setItem: (key, value) => { mockLocalStorageStore[key] = String(value); },
  removeItem: (key) => { delete mockLocalStorageStore[key]; }
};

// Mock window object
globalThis.window = {
  crypto: crypto
};

// Mock Tauri invoke calls
const mockNativeTelemetryState = {
  keyboard_clicks: 0,
  mouse_clicks: 0,
  mouse_moved: false,
  active_window: null,
  active_browser_tab: null,
  monitors: [{ id: 1, width: 1920, height: 1080 }],
  power_status: { is_locked: false, is_asleep: false },
  cpu_usage_percent: 5.5,
  memory_used_mb: 4096,
  memory_total_mb: 16384
};

let signatureCounter = 0;
const mockInvoke = async (command, args) => {
  if (command === 'get_native_telemetry') {
    return { ...mockNativeTelemetryState };
  }
  if (command === 'get_device_fingerprint') {
    return 'HW-FP-MOCK-777';
  }
  if (command === 'load_agent_credentials') {
    return { token: 'mock-jwt-token-111', refresh_token: 'mock-refresh-token-222' };
  }
  if (command === 'sign_agent_request') {
    signatureCounter++;
    return `mock-signature-hash-${signatureCounter}`;
  }
  if (command === 'save_agent_credentials') {
    return {};
  }
  throw new Error(`Unhandled mock command: ${command}`);
};

// Declare global __TAURI__ mock
globalThis.__TAURI__ = {
  invoke: mockInvoke
};

// Load the TelemetryService module
const { telemetryService } = require('./desktop-agent-core/src/services/telemetryService');

// Mock global fetch for API endpoints
let fetchCallCount = 0;
let fetchPayloads = [];
let fetchHeaders = [];
let fetchMustFail = false;

const salt = Buffer.from('workforce-salt');
const aesKey = crypto.pbkdf2Sync('enterprise-offline-hardened-key-material-2026', salt, 1000, 32, 'sha256');

function decryptPayload(bodyObj) {
  if (bodyObj && bodyObj.iv && bodyObj.ciphertext) {
    try {
      const iv = Buffer.from(bodyObj.iv, 'base64');
      const encrypted = Buffer.from(bodyObj.ciphertext, 'base64');
      const decipher = crypto.createDecipheriv('aes-256-gcm', aesKey, iv);
      const tag = encrypted.subarray(encrypted.length - 16);
      const ciphertext = encrypted.subarray(0, encrypted.length - 16);
      decipher.setAuthTag(tag);
      let decrypted = decipher.update(ciphertext, undefined, 'utf8');
      decrypted += decipher.final('utf8');
      return JSON.parse(decrypted);
    } catch (e) {
      console.error('UAT Mock Decryption error:', e);
    }
  }
  return bodyObj;
}

globalThis.fetch = async (url, options) => {
  fetchCallCount++;
  let bodyParsed = options.body ? JSON.parse(options.body) : null;
  if (bodyParsed) {
    bodyParsed = decryptPayload(bodyParsed);
  }
  fetchPayloads.push(bodyParsed);
  fetchHeaders.push(options.headers);

  if (fetchMustFail) {
    throw new Error('Network Connection Refused');
  }

  // Handle mock responses
  if (url.includes('/auth/refresh')) {
    return {
      ok: true,
      status: 200,
      json: async () => ({ token: 'new-token-333', refreshToken: 'new-refresh-token-444' })
    };
  }

  if (url.includes('/attendance/heartbeat')) {
    return {
      ok: true,
      status: 202,
      json: async () => ({ message: 'Enqueued' })
    };
  }

  if (url.includes('/attendance/bulk-heartbeat')) {
    return {
      ok: true,
      status: 201,
      json: async () => ({ count: 1 })
    };
  }

  return { ok: true, status: 200, json: async () => ({}) };
};

async function runAgentUAT() {
  console.log('=== STARTING DESKTOP PRODUCTIVITY AGENT UAT SUITE ===\n');
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

  // 1. Initial State validation
  try {
    await telemetryService.init('TEST-DEVICE-UUID-777');
    const status = telemetryService.getStatus();
    logResult(
      'Test Case 1 - Initialization State',
      'Status should initially be Working',
      `Status: ${status}`,
      status === 'Working'
    );
  } catch (err) {
    logResult('Test Case 1 - Initialization State', 'Working status', err.message, false);
  }

  // 2. Active Window & Input Detection -> Working Status
  try {
    mockNativeTelemetryState.keyboard_clicks = 5;
    mockNativeTelemetryState.mouse_clicks = 2;
    mockNativeTelemetryState.active_window = { title: 'VS Code', process_name: 'code.exe' };

    // Force one polling cycle manually
    await telemetryService['pollTelemetry']();

    const status = telemetryService.getStatus();
    const lastPayload = fetchPayloads[fetchPayloads.length - 1];

    logResult(
      'Test Case 2 - Active Window & Input Logging',
      'Working status with VS Code window and inputs reported',
      `Status: ${status}, Input Presses: ${lastPayload?.keyboardPresses}, App: ${lastPayload?.activeWindow}`,
      status === 'Working' && lastPayload?.keyboardPresses === 5 && lastPayload?.activeWindow === 'code.exe - VS Code'
    );
  } catch (err) {
    logResult('Test Case 2 - Active Window & Input Logging', 'Success metrics', err.message, false);
  }

  // 3. Focus Duration & Window Switch Detection
  try {
    const startSwitchTime = telemetryService['lastWindowSwitchTime'];
    
    // Change active window
    mockNativeTelemetryState.keyboard_clicks = 0;
    mockNativeTelemetryState.mouse_clicks = 0;
    mockNativeTelemetryState.active_window = { title: 'Google Chrome', process_name: 'chrome.exe' };

    // Run poll cycle
    await telemetryService['pollTelemetry']();

    const endSwitchTime = telemetryService['lastWindowSwitchTime'];
    const duration = endSwitchTime - startSwitchTime;
    const lastPayload = fetchPayloads[fetchPayloads.length - 1];

    logResult(
      'Test Case 3 - Focus Duration Switch Tracking',
      'Window switch duration is computed and window updates',
      `Duration logged: ${duration}ms, App: ${lastPayload?.activeWindow}`,
      duration >= 0 && lastPayload?.activeWindow === 'chrome.exe - Google Chrome'
    );
  } catch (err) {
    logResult('Test Case 3 - Focus Duration Switch Tracking', 'Success metrics', err.message, false);
  }

  // 4. Idle Detection
  try {
    // Reset inputs to simulate no activity
    mockNativeTelemetryState.keyboard_clicks = 0;
    mockNativeTelemetryState.mouse_clicks = 0;
    mockNativeTelemetryState.mouse_moved = false;

    // Simulate idle period elapsed (set inactive duration directly for test speed)
    telemetryService['inactiveDurationMs'] = 300000; // 5 mins

    // Run poll cycle
    await telemetryService['pollTelemetry']();

    const status = telemetryService.getStatus();
    const lastPayload = fetchPayloads[fetchPayloads.length - 1];

    logResult(
      'Test Case 4 - Idle Detection Transition',
      'Status transitions to Idle and submits Idle heartbeat',
      `Status: ${status}, Heartbeat Status: ${lastPayload?.status}`,
      status === 'Idle' && lastPayload?.status === 'Idle'
    );
  } catch (err) {
    logResult('Test Case 4 - Idle Detection Transition', 'Idle transition', err.message, false);
  }

  // 5. Break Detection (Locked screen)
  try {
    // Lock the screen
    mockNativeTelemetryState.power_status.is_locked = true;

    // Run poll cycle
    await telemetryService['pollTelemetry']();

    const status = telemetryService.getStatus();
    const lastPayload = fetchPayloads[fetchPayloads.length - 1];

    logResult(
      'Test Case 5 - Screen Lock Break Detection',
      'Status transitions to Break and submits Break heartbeat',
      `Status: ${status}, Heartbeat Status: ${lastPayload?.status}`,
      status === 'Break' && lastPayload?.status === 'Break'
    );
  } catch (err) {
    logResult('Test Case 5 - Screen Lock Break Detection', 'Break transition', err.message, false);
  }

  // Unlock the screen
  mockNativeTelemetryState.power_status.is_locked = false;

  // 6. Network Loss, Offline Mode, & Cryptographic Local Queue
  try {
    fetchMustFail = true;
    mockNativeTelemetryState.keyboard_clicks = 2; // trigger inputs

    // Run poll cycle
    await telemetryService['pollTelemetry']();

    const status = telemetryService.getStatus();
    const queue = await telemetryService['readDecryptedQueue']();

    logResult(
      'Test Case 6 - Network Failure & Encrypted Offline Queue',
      'Status transitions to Offline and packet is securely encrypted/stored locally',
      `Status: ${status}, Queue size: ${queue.length}, Ciphertext exists: ${!!mockLocalStorageStore['secure_telemetry_queue']}`,
      status === 'Offline' && queue.length === 1 && !!mockLocalStorageStore['secure_telemetry_queue']
    );
  } catch (err) {
    logResult('Test Case 6 - Network Failure & Encrypted Offline Queue', 'Offline encryption', err.message, false);
  }

  // 8. Network Reconnection & Bulk Sync Replay
  try {
    fetchMustFail = false;
    fetchCallCount = 0; // reset
    fetchPayloads = [];

    // Trigger next polling cycle - recovers network
    await telemetryService['pollTelemetry']();

    const status = telemetryService.getStatus();
    const queueAfterSync = await telemetryService['readDecryptedQueue']();
    const hasBulkCall = fetchPayloads.some(p => p && p.compressedData !== undefined);

    logResult(
      'Test Case 7 - Network Recovery & Bulk Queue Flushing',
      'Status restores to Working, bulk data compressed and flushed, local queue cleared',
      `Status: ${status}, Queue size: ${queueAfterSync.length}, Bulk payload sent: ${hasBulkCall}`,
      status === 'Working' && queueAfterSync.length === 0 && hasBulkCall
    );
  } catch (err) {
    logResult('Test Case 7 - Network Recovery & Bulk Queue Flushing', 'Bulk replay', err.message, false);
  }

  console.log('=== DESKTOP AGENT UAT COMPLETE ===');
  console.log(`Passed: ${results.passed.length}, Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

runAgentUAT();
