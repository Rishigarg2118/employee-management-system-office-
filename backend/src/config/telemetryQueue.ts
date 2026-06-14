import db from './db';

interface TelemetryPacket {
  employeeId: number;
  attendanceId: number;
  status: 'Active' | 'Idle' | 'Break';
  mouseClicks: number;
  keyboardPresses: number;
  activeWindow?: string;
  screenshotUrl?: string;
  timestamp?: string;
  // New enriched telemetry fields
  currentUrl?: string;
  currentDomain?: string;
  browserName?: string;
  appName?: string;
  tabSwitchCount?: number;
  focusDurationSeconds?: number;
  isFocused?: boolean;
}

class TelemetryQueue {
  private buffer: TelemetryPacket[] = [];
  private flushInterval: NodeJS.Timeout | null = null;
  private isProcessing = false;

  private readonly MAX_BUFFER_SIZE = 10000;

  constructor() {
    this.startWorker();
  }

  // Enqueue a heartbeat packet
  public enqueue(packet: TelemetryPacket): void {
    if (this.buffer.length >= this.MAX_BUFFER_SIZE) {
      console.warn(`[Queue] Telemetry queue buffer size reached limit (${this.MAX_BUFFER_SIZE}). Dropping oldest packets.`);
      this.buffer = this.buffer.slice(this.buffer.length - this.MAX_BUFFER_SIZE + 1);
    }
    this.buffer.push(packet);
    console.log(`[Queue] Telemetry packet enqueued. Buffer size: ${this.buffer.length}`);
  }

  // Flush buffer to database in bulk
  public async flush(): Promise<void> {
    if (this.buffer.length === 0 || this.isProcessing) return;

    this.isProcessing = true;
    const packetsToWrite = [...this.buffer];
    this.buffer = [];

    console.log(`[Queue] Flushing ${packetsToWrite.length} packets in bulk to database...`);
    try {
      // Map properties to db schema naming
      const mapped = packetsToWrite.map(p => ({
        employee_id: p.employeeId,
        attendance_id: p.attendanceId,
        status: p.status,
        mouse_clicks: p.mouseClicks,
        keyboard_presses: p.keyboardPresses,
        active_window: p.activeWindow,
        screenshot_url: p.screenshotUrl,
        timestamp: p.timestamp,
        current_url: p.currentUrl,
        current_domain: p.currentDomain,
        browser_name: p.browserName,
        app_name: p.appName,
        tab_switch_count: p.tabSwitchCount ?? 0,
        focus_duration_seconds: p.focusDurationSeconds ?? 0,
        is_focused: p.isFocused ?? true,
      }));

      await db.addHeartbeatsBulk(mapped);
      console.log(`[Queue] Successfully saved ${packetsToWrite.length} telemetry packets.`);
    } catch (err: any) {
      console.error('[Queue] Error saving bulk telemetry, checking retry eligibility...', err);
      
      const pgCode = err.code || '';
      // Only retry if it is a network error or database connection issue (class 08, 57, or system code)
      const isConnectionErr = pgCode.startsWith('08') || pgCode.startsWith('57') || 
                              err.message?.includes('connection') || err.message?.includes('closed') ||
                              ['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND'].includes(err.code);
                              
      if (isConnectionErr) {
        console.warn(`[Queue] Database connection issue detected (${pgCode || err.code}). Re-inserting ${packetsToWrite.length} packets for retry.`);
        this.buffer = [...packetsToWrite, ...this.buffer];
      } else {
        console.error(`[Queue] Hard database constraint or query error (${pgCode || err.code}). Discarding ${packetsToWrite.length} un-savable telemetry packets.`);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  // Start background flush loop
  public startWorker(intervalMs: number = 5000): void {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => this.flush(), intervalMs);
    this.flushInterval.unref();
    console.log(`[Queue] Asynchronous telemetry worker started (Flush interval: ${intervalMs}ms).`);
  }

  // Stop background loop
  public stopWorker(): void {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
      console.log('[Queue] Telemetry worker stopped.');
    }
  }

  // Return queue size
  public size(): number {
    return this.buffer.length;
  }
}

export const telemetryQueue = new TelemetryQueue();
