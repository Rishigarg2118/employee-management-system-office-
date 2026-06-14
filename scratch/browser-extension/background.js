let nativePort = null;
const HOST_NAME = 'com.enterprise.telemetry.host';

// Connection Resilience: Connect to Tauri local Native Messaging Host with exponential/linear backoff
function connectNativeHost() {
  try {
    nativePort = chrome.runtime.connectNative(HOST_NAME);
    nativePort.onDisconnect.addListener(() => {
      console.warn('Disconnected from native messaging host. Retrying in 5s...');
      nativePort = null;
      setTimeout(connectNativeHost, 5000);
    });
    console.log('Connected to Native Messaging Host:', HOST_NAME);
  } catch (err) {
    console.error('Failed to connect to native host:', err);
    setTimeout(connectNativeHost, 5000);
  }
}

connectNativeHost();

// Helper to detect Browser Name
function getBrowserName() {
  const ua = navigator.userAgent || '';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Chrome/')) return 'Chrome';
  return 'Chrome-Based Browser';
}

// Helper to sanitize URL and domain (PII / Security Protection Rules)
function sanitizeTelemetry(url, title) {
  if (!url) return { domain: '', url: '', title: '' };
  
  const titleLower = title ? title.toLowerCase() : '';
  const urlLower = url.toLowerCase();
  
  // Strict PII / Auth / Payment / Credential page patterns
  const sensitivePatterns = [
    'login', 'signin', 'password', 'auth', 'register', 'signup',
    'bank', 'checkout', 'paypal', 'creditcard', 'stripe', 'token', 'session'
  ];
  
  const isSensitive = sensitivePatterns.some(p => urlLower.includes(p) || titleLower.includes(p));
  
  try {
    const parsed = new URL(url);
    const domain = parsed.hostname;
    
    // Always strip query string and hash variables entirely to prevent leakage of credentials
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

// Session State variables for tracking tab focus duration
let lastActiveTabId = null;
let lastActiveWindowId = null;
let tabFocusedSince = Date.now();
let currentWindowFocused = true;

// Send telemetry payload to Native Host
function sendTelemetry(tab, durationMs, eventType) {
  if (!nativePort || !tab) return;

  const isIncognito = !!tab.incognito;
  
  // Strict Incognito/Private window masking rules
  let url = tab.url || '';
  let title = tab.title || '';
  let domain = '';
  
  if (isIncognito) {
    // Under default configuration, obscure all incognito data
    url = '<incognito_masked>';
    title = '<private_browsing_session>';
    domain = 'private-session';
  } else {
    const sanitized = sanitizeTelemetry(url, title);
    domain = sanitized.domain;
    url = sanitized.url;
    title = sanitized.title;
  }

  const payload = {
    domain: domain,
    url: url,
    title: title,
    is_incognito: isIncognito,
    tab_focus: eventType === 'focus' || eventType === 'active',
    tab_change: eventType === 'change',
    tab_duration_ms: Math.round(durationMs),
    browser_name: getBrowserName(),
    window_focus: currentWindowFocused,
    timestamp: new Date().toISOString()
  };

  try {
    nativePort.postMessage(payload);
    console.log(`[Browser Extension] Telemetry (${eventType}) sent:`, payload);
  } catch (err) {
    console.error('[Browser Extension] Failed to post native message:', err);
  }
}

// Track transition when tab focus changes or window focus shifts
async function handleTabTransition(eventType) {
  const now = Date.now();
  const elapsed = now - tabFocusedSince;
  tabFocusedSince = now;

  // Process previous active tab duration report
  if (lastActiveTabId !== null && elapsed > 100) {
    try {
      const prevTab = await chrome.tabs.get(lastActiveTabId);
      if (prevTab) {
        sendTelemetry(prevTab, elapsed, 'duration_flush');
      }
    } catch (e) {
      // Prev tab might have been closed already
    }
  }

  // Set new active tab pointers
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab) {
      lastActiveTabId = tab.id;
      lastActiveWindowId = tab.windowId;
      sendTelemetry(tab, 0, eventType);
    }
  } catch (err) {
    console.error('[Browser Extension] Transition error:', err);
  }
}

// Hook Browser Tab and Window Focus changes
chrome.tabs.onActivated.addListener(() => {
  handleTabTransition('focus');
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete') {
    handleTabTransition('change');
  }
});

chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    currentWindowFocused = false;
    handleTabTransition('window_blur');
  } else {
    currentWindowFocused = true;
    handleTabTransition('window_focus');
  }
});

// Periodic heartbeat sanity check (e.g. every 5 seconds send status update of active tab)
setInterval(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && currentWindowFocused) {
      const now = Date.now();
      const elapsed = now - tabFocusedSince;
      tabFocusedSince = now;
      sendTelemetry(tab, elapsed, 'heartbeat');
    }
  } catch (e) {
    // Suppress console errors for minor fetch events
  }
}, 5000);
