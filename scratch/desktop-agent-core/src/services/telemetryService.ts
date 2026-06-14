declare var window: any;
declare var localStorage: any;

let invoke: <T = any>(cmd: string, args?: any) => Promise<T>;
if (typeof globalThis !== 'undefined' && (globalThis as any).__TAURI__) {
  invoke = (globalThis as any).__TAURI__.invoke;
} else if (typeof window !== 'undefined' && (window as any).__TAURI__) {
  invoke = (window as any).__TAURI__.invoke;
} else {
  try {
    // @ts-ignore
    invoke = require('@tauri-apps/api/tauri').invoke;
  } catch (e) {
    invoke = async <T = any>(cmd: string, args?: any): Promise<T> => {
      console.warn(`[Mock Telemetry] Native tauri command invoked: ${cmd}`, args);
      return null as any;
    };
  }
}

export interface WindowSnapshot {
  title: string;
  process_name: string;
}

export interface MonitorMetadata {
  id: number;
  width: number;
  height: number;
}

export interface TelemetryPayload {
  keyboard_clicks: number;
  mouse_clicks: number;
  mouse_moved: boolean;
  active_window: WindowSnapshot | null;
  active_browser_tab?: {
    domain: string;
    url: string;
    title: string;
    is_incognito: boolean;
    tab_focus: boolean;
    tab_change: boolean;
    tab_duration_ms: number;
    browser_name: string;
    window_focus: boolean;
    timestamp: string;
  } | null;
  monitors: MonitorMetadata[];
  power_status: { is_locked: boolean; is_asleep: boolean };
  cpu_usage_percent: number;
  memory_used_mb: number;
  memory_total_mb: number;
}

export interface ActivityReport {
  timestamp: string;
  activeWindow: string | null;
  keyboardClicks: number;
  mouseClicks: number;
  durationMs: number;
  idleDurationMs: number;
  isIdle: boolean;
  monitorsCount: number;
  cpuPercent: number;
  ramUsageMb: number;
}

export type ClientStatus = 'Working' | 'Idle' | 'Break' | 'Offline';

type ActivityCallback = (report: ActivityReport) => void;
type SessionCallback = (event: 'lock' | 'unlock' | 'sleep' | 'wake') => void;
type IdleCallback = (isIdle: boolean) => void;
type StatusCallback = (status: ClientStatus) => void;

// Web-standard gzip compression using CompressionStream
async function gzipCompress(str: string): Promise<string> {
  const byteArray = new TextEncoder().encode(str);
  const cs = new CompressionStream('gzip');
  const writer = cs.writable.getWriter();
  writer.write(byteArray);
  writer.close();
  
  const response = new Response(cs.readable);
  const buffer = await response.arrayBuffer();
  
  // Base64 encode arraybuffer safely
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

class TelemetryService {
  private pollIntervalMs = 5000; // Heartbeat loop every 5 seconds
  private idleThresholdMs = 300000; // 5 mins idle threshold (300s)
  private timerId: any = null;
  private apiBaseUrl = 'http://localhost:5000/api';

  // State trackers
  private inactiveDurationMs = 0;
  private currentStatus: ClientStatus = 'Working';
  private currentWindow: WindowSnapshot | null = null;
  private lastWindowSwitchTime = Date.now();
  private credentials: { token: string; refresh_token: string } | null = null;
  private deviceUuid = '';
  private hardwareFingerprint = '';

  // Input counters
  private aggregatedKeyboardClicks = 0;
  private aggregatedMouseClicks = 0;

  // Observers
  private activityListeners: Set<ActivityCallback> = new Set();
  private sessionListeners: Set<SessionCallback> = new Set();
  private idleListeners: Set<IdleCallback> = new Set();
  private statusListeners: Set<StatusCallback> = new Set();

  public async init(deviceUuid: string) {
    this.deviceUuid = deviceUuid;
    try {
      this.hardwareFingerprint = await invoke<string>('get_device_fingerprint');
      this.credentials = await invoke<{ token: string; refresh_token: string }>('load_agent_credentials');
    } catch (err) {
      console.warn('[Telemetry Service] Could not load local security credentials:', err);
    }
  }

  public start() {
    if (this.timerId) return;
    this.lastWindowSwitchTime = Date.now();
    this.timerId = setInterval(() => this.pollTelemetry(), this.pollIntervalMs);
    console.log('[Telemetry Service] Hardened native tracking loop started.');
  }

  public stop() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  // Observers Subscriptions
  public subscribeActivity(cb: ActivityCallback) {
    this.activityListeners.add(cb);
    return () => this.activityListeners.delete(cb);
  }

  public subscribeSession(cb: SessionCallback) {
    this.sessionListeners.add(cb);
    return () => this.sessionListeners.delete(cb);
  }

  public subscribeIdle(cb: IdleCallback) {
    this.idleListeners.add(cb);
    return () => this.idleListeners.delete(cb);
  }

  public subscribeStatus(cb: StatusCallback) {
    this.statusListeners.add(cb);
    return () => this.statusListeners.delete(cb);
  }

  public getStatus(): ClientStatus {
    return this.currentStatus;
  }

  private setStatus(newStatus: ClientStatus) {
    if (this.currentStatus !== newStatus) {
      this.currentStatus = newStatus;
      this.statusListeners.forEach(l => l(newStatus));
      console.log(`[Telemetry Service] Status changed: ${newStatus}`);
    }
  }

  private isPolling = false;

  // Central Polling & Heartbeat Loop
  private async pollTelemetry() {
    if (this.isPolling) {
      console.warn('[Telemetry Service] Telemetry poll already in progress. Skipping concurrent execution.');
      return;
    }
    this.isPolling = true;
    try {
      const snap = await invoke<TelemetryPayload>('get_native_telemetry');
      const now = Date.now();
      const hasInputs = snap.keyboard_clicks > 0 || snap.mouse_clicks > 0 || snap.mouse_moved;

      // Aggregating activity counters
      this.aggregatedKeyboardClicks += snap.keyboard_clicks;
      this.aggregatedMouseClicks += snap.mouse_clicks;

      // 1. Idle Detection & State Management
      if (!hasInputs) {
        this.inactiveDurationMs += this.pollIntervalMs;
      } else {
        this.inactiveDurationMs = 0;
        if (this.currentStatus === 'Idle') {
          this.idleListeners.forEach(l => l(false));
          this.setStatus('Working');
        }
      }

      // Transition to Idle if threshold crossed
      if (this.inactiveDurationMs >= this.idleThresholdMs && this.currentStatus === 'Working') {
        this.idleListeners.forEach(l => l(true));
        this.setStatus('Idle');
      }

      // 2. Break Detection
      if (snap.power_status.is_locked || snap.power_status.is_asleep) {
        this.setStatus('Break');
        this.sessionListeners.forEach(l => l(snap.power_status.is_locked ? 'lock' : 'sleep'));
      } else if (this.currentStatus === 'Break') {
        this.setStatus('Working');
        this.sessionListeners.forEach(l => l('unlock'));
      }

      // 3. Window Change and Focus Duration Tracking
      const windowChanged = this.hasWindowChanged(snap.active_window);
      let windowDuration = this.pollIntervalMs;
      if (windowChanged) {
        windowDuration = now - this.lastWindowSwitchTime;
        this.lastWindowSwitchTime = now;
        this.currentWindow = snap.active_window;
      }

      // Active application / window label compilation
      let activeLabel = null;
      if (snap.active_window) {
        const procLower = snap.active_window.process_name.toLowerCase();
        const isBrowserProcess = ['chrome.exe', 'firefox.exe', 'msedge.exe', 'iexplore.exe', 'safari.exe', 'opera.exe', 'brave.exe', 'chrome', 'firefox', 'msedge'].some(p => procLower.includes(p));
        
        if (isBrowserProcess && snap.active_browser_tab) {
          activeLabel = `${snap.active_window.process_name} - [${snap.active_browser_tab.url}] - ${snap.active_browser_tab.title} (${snap.active_browser_tab.browser_name}, Duration: ${snap.active_browser_tab.tab_duration_ms}ms)`;
        } else {
          activeLabel = `${snap.active_window.process_name} - ${snap.active_window.title}`;
        }
      } else if (snap.active_browser_tab) {
        activeLabel = `${snap.active_browser_tab.browser_name || 'browser'} - [${snap.active_browser_tab.url}] - ${snap.active_browser_tab.title} (Duration: ${snap.active_browser_tab.tab_duration_ms}ms)`;
      }

      // 4. Send Heartbeat to server
      const statusMap: Record<ClientStatus, 'Active' | 'Idle' | 'Break' | 'Offline'> = {
        Working: 'Active',
        Idle: 'Idle',
        Break: 'Break',
        Offline: 'Active' // Mapping Offline to Active status check on server
      };

      const heartbeatPayload = {
        status: statusMap[this.currentStatus] || 'Active',
        mouseClicks: snap.mouse_clicks,
        keyboardPresses: snap.keyboard_clicks,
        activeWindow: activeLabel || undefined,
        timestamp: new Date().toISOString()
      };

      // Compile report for listeners
      const report: ActivityReport = {
        timestamp: heartbeatPayload.timestamp,
        activeWindow: heartbeatPayload.activeWindow || null,
        keyboardClicks: heartbeatPayload.keyboardPresses,
        mouseClicks: heartbeatPayload.mouseClicks,
        durationMs: windowDuration,
        idleDurationMs: this.currentStatus === 'Idle' ? this.pollIntervalMs : 0,
        isIdle: this.currentStatus === 'Idle',
        monitorsCount: snap.monitors.length,
        cpuPercent: snap.cpu_usage_percent,
        ramUsageMb: snap.memory_used_mb
      };
      this.activityListeners.forEach(l => l(report));

      // Deliver heartbeat
      await this.deliverHeartbeat(heartbeatPayload);

    } catch (err) {
      console.error('[Telemetry Service] Poll loop native invoke error:', err);
    } finally {
      this.isPolling = false;
    }
  }

  private async encryptPayload(payload: any): Promise<{ iv: string; ciphertext: string }> {
    const rawText = JSON.stringify(payload);
    const key = await this.getCryptoKey();
    const iv = (globalThis as any).crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await (globalThis as any).crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(rawText)
    );
    return {
      iv: btoa(String.fromCharCode(...iv)),
      ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
    };
  }

  // Delivery Pipeline & Offline Resiliency
  private async deliverHeartbeat(payload: any) {
    if (!this.credentials?.token) {
      console.warn('[Telemetry Service] No token stored. Queuing heartbeat offline.');
      await this.queueOffline(payload);
      return;
    }

    const timestamp = Date.now().toString();
    const nonce = Math.random().toString(36).substring(2, 15);

    try {
      const encrypted = await this.encryptPayload(payload);
      const bodyStr = JSON.stringify(encrypted);

      // Sign using Tauri native Command
      const signature = await invoke<string>('sign_agent_request', {
        method: 'POST',
        endpoint: '/attendance/heartbeat',
        timestamp,
        nonce,
        body: bodyStr
      });

      const response = await fetch(`${this.apiBaseUrl}/attendance/heartbeat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.credentials.token}`,
          'x-signature': signature,
          'x-timestamp': timestamp,
          'x-nonce': nonce,
          'x-device-uuid': this.deviceUuid,
          'x-device-fingerprint': this.hardwareFingerprint
        },
        body: bodyStr
      });

      if (response.ok) {
        if (this.currentStatus === 'Offline') {
          this.setStatus('Working');
          // Try to flush queue upon reconnection
          await this.flushOfflineQueue();
        }
      } else {
        console.warn(`[Telemetry Service] Heartbeat response code ${response.status}. Queuing payload.`);
        await this.queueOffline(payload);
        if (response.status === 401 || response.status === 403) {
          // Attempt token refresh on authentication failures
          this.tryTokenRefresh();
        }
      }
    } catch (err) {
      console.warn('[Telemetry Service] Network error. Transitioning to Offline mode.', err);
      this.setStatus('Offline');
      await this.queueOffline(payload);
    }
  }

  // Local Cryptographic Queueing (Secure Local Storage)
  private async getCryptoKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await (globalThis as any).crypto.subtle.importKey(
      'raw',
      encoder.encode('enterprise-offline-hardened-key-material-2026'),
      { name: 'PBKDF2' },
      false,
      ['deriveKey']
    );
    return (globalThis as any).crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode('workforce-salt'),
        iterations: 1000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async queueOffline(payload: any) {
    try {
      const existingQueue = await this.readDecryptedQueue();
      existingQueue.push(payload);

      // Encrypt queue array
      const rawText = JSON.stringify(existingQueue);
      const key = await this.getCryptoKey();
      const iv = (globalThis as any).crypto.getRandomValues(new Uint8Array(12));
      const encrypted = await (globalThis as any).crypto.subtle.encrypt(
        { name: 'AES-GCM', iv },
        key,
        new TextEncoder().encode(rawText)
      );

      // Save encrypted bytes + IV to localStorage
      const packed = {
        iv: btoa(String.fromCharCode(...iv)),
        ciphertext: btoa(String.fromCharCode(...new Uint8Array(encrypted)))
      };
      (globalThis as any).localStorage.setItem('secure_telemetry_queue', JSON.stringify(packed));
      console.log(`[Telemetry Service] Heartbeat queued offline. Queue size: ${existingQueue.length}`);
    } catch (e) {
      console.error('[Telemetry Service] Encryption failure on local queue:', e);
    }
  }

  private async readDecryptedQueue(): Promise<any[]> {
    const data = (globalThis as any).localStorage.getItem('secure_telemetry_queue');
    if (!data) return [];

    try {
      const { iv, ciphertext } = JSON.parse(data);
      const key = await this.getCryptoKey();
      
      const ivBytes = new Uint8Array(atob(iv).split('').map(c => c.charCodeAt(0)));
      const cipherBytes = new Uint8Array(atob(ciphertext).split('').map(c => c.charCodeAt(0)));

      const decrypted = await (globalThis as any).crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: ivBytes },
        key,
        cipherBytes
      );
      
      return JSON.parse(new TextDecoder().decode(decrypted));
    } catch (e) {
      console.warn('[Telemetry Service] Could not decrypt offline queue. Returning empty array.', e);
      return [];
    }
  }

  // Flush Offline Queue in bulk using bulk-heartbeat API
  private async flushOfflineQueue() {
    const queue = await this.readDecryptedQueue();
    if (queue.length === 0) return;

    console.log(`[Telemetry Service] Recovered connection. Synchronizing ${queue.length} offline heartbeats...`);
    
    if (!this.credentials?.token) return;

    try {
      const jsonStr = JSON.stringify(queue);
      const compressedB64 = await gzipCompress(jsonStr);

      const endpoint = '/attendance/bulk-heartbeat';
      const rawPayload = { compressedData: compressedB64 };
      const encrypted = await this.encryptPayload(rawPayload);
      const bodyStr = JSON.stringify(encrypted);
      const timestamp = Date.now().toString();
      const nonce = Math.random().toString(36).substring(2, 15);

      const signature = await invoke<string>('sign_agent_request', {
        method: 'POST',
        endpoint,
        timestamp,
        nonce,
        body: bodyStr
      });

      const response = await fetch(`${this.apiBaseUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.credentials.token}`,
          'x-signature': signature,
          'x-timestamp': timestamp,
          'x-nonce': nonce,
          'x-device-uuid': this.deviceUuid,
          'x-device-fingerprint': this.hardwareFingerprint
        },
        body: bodyStr
      });

      if (response.ok) {
        console.log(`[Telemetry Service] Bulk telemetry synchronized successfully.`);
        (globalThis as any).localStorage.removeItem('secure_telemetry_queue');
      } else {
        console.warn(`[Telemetry Service] Bulk sync failed with status ${response.status}. Queue preserved.`);
      }
    } catch (err) {
      console.error('[Telemetry Service] Error flushing offline queue in bulk:', err);
    }
  }

  // Token Refresh Logic
  private async tryTokenRefresh() {
    if (!this.credentials?.refresh_token) return;
    try {
      console.log('[Telemetry Service] Access token expired. Attempting rotation...');
      const response = await fetch(`${this.apiBaseUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: this.credentials.refresh_token })
      });
      if (response.ok) {
        const data = await response.json() as any;
        this.credentials.token = data.token;
        if (data.refreshToken) {
          this.credentials.refresh_token = data.refreshToken;
        }
        // Save new credentials back to native vault
        await invoke('save_agent_credentials', {
          token: this.credentials.token,
          refreshToken: this.credentials.refresh_token,
          secret: 'enterprise-workforce-hardening-secret-key-2026'
        });
        console.log('[Telemetry Service] Access token rotated successfully.');
      }
    } catch (e) {
      console.warn('[Telemetry Service] Token refresh failed:', e);
    }
  }

  private hasWindowChanged(newWin: WindowSnapshot | null): boolean {
    if (!this.currentWindow && !newWin) return false;
    if (!this.currentWindow || !newWin) return true;
    return (
      this.currentWindow.title !== newWin.title ||
      this.currentWindow.process_name !== newWin.process_name
    );
  }
}

export const telemetryService = new TelemetryService();
export default telemetryService;
