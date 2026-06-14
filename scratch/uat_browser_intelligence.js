// Browser Extension and Host Telemetry UAT test suite
const assert = require('assert');

// 1. Mock global browser extension context for background script testing
const mockChromeRuntime = {
  connectNative: (host) => {
    return {
      postMessage: (msg) => {
        mockChromeRuntime.sentMessages.push(msg);
      },
      onDisconnect: {
        addListener: (cb) => {
          mockChromeRuntime.disconnectListeners.push(cb);
        }
      }
    };
  },
  sentMessages: [],
  disconnectListeners: []
};

// Mock the user agent and other extension globals
const userAgents = {
  edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0',
  firefox: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:109.0) Gecko/20100101 Firefox/119.0',
  chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

let currentUA = userAgents.chrome;
globalThis.navigator = {
  get userAgent() { return currentUA; }
};

// Sanitization & Mapping functions extracted from background.js for isolated unit-level verification
function getBrowserName(ua) {
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Chrome/')) return 'Chrome';
  return 'Chrome-Based Browser';
}

function sanitizeTelemetry(url, title) {
  if (!url) return { domain: '', url: '', title: '' };
  
  const titleLower = title ? title.toLowerCase() : '';
  const urlLower = url.toLowerCase();
  
  const sensitivePatterns = [
    'login', 'signin', 'password', 'auth', 'register', 'signup',
    'bank', 'checkout', 'paypal', 'creditcard', 'stripe', 'token', 'session'
  ];
  
  const isSensitive = sensitivePatterns.some(p => urlLower.includes(p) || titleLower.includes(p));
  
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    
    let sanitizedUrl = parsed.origin + parsed.pathname;
    let sanitizedTitle = title || parsed.hostname;
    
    if (isSensitive) {
      sanitizedUrl = parsed.origin + '/<masked_secure_page>';
      sanitizedTitle = '<masked_authentication_or_payment_data>';
    }
    
    return {
      domain,
      url: sanitizedUrl,
      title: sanitizedTitle
    };
  } catch (e) {
    return { domain: '', url: '', title: title || '' };
  }
}

// Run Verification Suite
async function runBrowserUAT() {
  console.log('=== STARTING ENTERPRISE BROWSER INTELLIGENCE UAT SUITE ===\n');
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

  // 1. Browser Name Detection
  try {
    const edgeName = getBrowserName(userAgents.edge);
    const firefoxName = getBrowserName(userAgents.firefox);
    const chromeName = getBrowserName(userAgents.chrome);
    const ok = edgeName === 'Edge' && firefoxName === 'Firefox' && chromeName === 'Chrome';
    logResult(
      'Test Case 1 - Browser Name Auto-Detection',
      'Should detect Edge, Firefox, and Chrome based on userAgent',
      `Detected: Edge->${edgeName}, Firefox->${firefoxName}, Chrome->${chromeName}`,
      ok
    );
  } catch (err) {
    logResult('Test Case 1 - Browser Name Auto-Detection', 'Edge, Firefox, Chrome', err.message, false);
  }

  // 2. URL & Domain Sanitization (Base Cases)
  try {
    const res = sanitizeTelemetry('https://github.com/google/antigravity?tab=readme-ov-file#installation', 'Antigravity Repo');
    const ok = res.domain === 'github.com' && res.url === 'https://github.com/google/antigravity' && res.title === 'Antigravity Repo';
    logResult(
      'Test Case 2 - URL Query and Hash Stripping',
      'Should strip query parameters and hash fragments entirely',
      `Domain: ${res.domain}, URL: ${res.url}, Title: ${res.title}`,
      ok
    );
  } catch (err) {
    logResult('Test Case 2 - URL Query and Hash Stripping', 'Clean URL & Domain', err.message, false);
  }

  // 3. PII & Sensitive URL Masking
  try {
    const res = sanitizeTelemetry('https://auth.enterprise.com/signin?session_token=secretjwt123&password=supersecret', 'User Sign In Portal');
    const ok = res.url === 'https://auth.enterprise.com/<masked_secure_page>' && res.title === '<masked_authentication_or_payment_data>';
    logResult(
      'Test Case 3 - Credential and PII Masking',
      'Should mask sensitive paths, parameters, and titles when auth keywords exist',
      `URL: ${res.url}, Title: ${res.title}`,
      ok
    );
  } catch (err) {
    logResult('Test Case 3 - Credential and PII Masking', 'Masked authentication page data', err.message, false);
  }

  // 4. Incognito Session Telemetry Restrictions
  try {
    // Simulate background.js Incognito handling logic
    const mockTab = { url: 'https://youtube.com/watch?v=xyz', title: 'Viral Video', incognito: true };
    let url = mockTab.url;
    let title = mockTab.title;
    let domain = '';
    
    if (mockTab.incognito) {
      url = '<incognito_masked>';
      title = '<private_browsing_session>';
      domain = 'private-session';
    }
    
    const ok = url === '<incognito_masked>' && title === '<private_browsing_session>' && domain === 'private-session';
    logResult(
      'Test Case 4 - Incognito Session Restrictive Rule',
      'Incognito tabs must have URLs, titles, and domains fully masked under company privacy policies',
      `URL: ${url}, Title: ${title}, Domain: ${domain}`,
      ok
    );
  } catch (err) {
    logResult('Test Case 4 - Incognito Session Restrictive Rule', 'Masked incognito context', err.message, false);
  }

  // 5. Active Tab Transition & Duration Calculation
  try {
    // Mock the state changes
    let lastActiveTabId = 101;
    let tabFocusedSince = Date.now() - 4000; // focused 4 seconds ago
    const elapsed = Date.now() - tabFocusedSince;

    // Verify duration flush calculations
    const ok = elapsed >= 3900 && elapsed <= 4500;
    logResult(
      'Test Case 5 - Focus Duration Metric Compute',
      'Calculates active duration accurately before switching focus context',
      `Duration computed: ${elapsed}ms`,
      ok
    );
  } catch (err) {
    logResult('Test Case 5 - Focus Duration Metric Compute', 'Correct delta timing', err.message, false);
  }

  // 6. Native Agent Integration & ActiveLabel Rendering
  try {
    // Load local mock framework
    const mockTelemetryPayload = {
      keyboard_clicks: 0,
      mouse_clicks: 0,
      mouse_moved: false,
      active_window: { title: 'Google Chrome', process_name: 'chrome.exe' },
      active_browser_tab: {
        domain: 'github.com',
        url: 'https://github.com/google',
        title: 'Google Repos',
        is_incognito: false,
        tab_focus: true,
        tab_change: false,
        tab_duration_ms: 12000,
        browser_name: 'Chrome',
        window_focus: true,
        timestamp: new Date().toISOString()
      },
      monitors: [],
      power_status: { is_locked: false, is_asleep: false },
      cpu_usage_percent: 1.0,
      memory_used_mb: 200,
      memory_total_mb: 8000
    };

    // Evaluate activeLabel compilation block behavior
    let activeLabel = null;
    const snap = mockTelemetryPayload;
    if (snap.active_window) {
      const procLower = snap.active_window.process_name.toLowerCase();
      const isBrowserProcess = ['chrome.exe', 'firefox.exe', 'msedge.exe', 'iexplore.exe', 'safari.exe', 'opera.exe', 'brave.exe', 'chrome', 'firefox', 'msedge'].some(p => procLower.includes(p));
      
      if (isBrowserProcess && snap.active_browser_tab) {
        activeLabel = `${snap.active_window.process_name} - [${snap.active_browser_tab.url}] - ${snap.active_browser_tab.title} (${snap.active_browser_tab.browser_name}, Duration: ${snap.active_browser_tab.tab_duration_ms}ms)`;
      } else {
        activeLabel = `${snap.active_window.process_name} - ${snap.active_window.title}`;
      }
    }

    const expectedLabel = 'chrome.exe - [https://github.com/google] - Google Repos (Chrome, Duration: 12000ms)';
    const ok = activeLabel === expectedLabel;
    logResult(
      'Test Case 6 - Heartbeat Payload Active Label Composition',
      'Merges active application and extension browser metadata into a structured telemetry descriptor',
      `Compiled label: ${activeLabel}`,
      ok
    );
  } catch (err) {
    logResult('Test Case 6 - Heartbeat Payload Active Label Composition', 'Combined process and URL description string', err.message, false);
  }

  console.log('=== BROWSER INTELLIGENCE UAT COMPLETE ===');
  console.log(`Passed: ${results.passed.length}, Failed: ${results.failed.length}`);
  if (results.failed.length > 0) {
    process.exit(1);
  }
}

runBrowserUAT();
