/**
 * useTelemetryAgent.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Enterprise in-browser telemetry agent.
 *
 * Tracks:
 *  • Current page URL & domain (sanitized — no query strings)
 *  • Browser name
 *  • Tab switch count (visibilitychange)
 *  • Window/app focus loss (window.blur / window.focus)
 *  • Mouse click & keyboard press counts
 *  • Idle detection (3 min of no activity = Idle)
 *  • Focus duration (seconds in focused state)
 *  • Auto-heartbeat every INTERVAL_MS
 *  • Offline queue → localStorage → flushed on reconnect
 *
 * Does NOT collect:
 *  • Passwords, form inputs, clipboard, typed text content
 *  • Emails or private messages
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useRef, useCallback } from 'react';
import { api } from '../services/api';

// ─── Config ──────────────────────────────────────────────────────────────────
const HEARTBEAT_INTERVAL_MS = 30_000;   // Send heartbeat every 30 seconds
const IDLE_THRESHOLD_MS     = 3 * 60 * 1000; // 3 minutes no activity = Idle
const OFFLINE_QUEUE_KEY     = 'hrms_telemetry_queue';
const MAX_OFFLINE_QUEUE     = 200;

// ─── Helpers ─────────────────────────────────────────────────────────────────
function detectBrowser(): string {
  const ua = navigator.userAgent;
  if (ua.includes('Edg/'))    return 'Edge';
  if (ua.includes('OPR/'))    return 'Opera';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Safari/')) return 'Safari';
  return 'Browser';
}

function getSanitizedUrl(): string {
  try {
    const url = new URL(window.location.href);
    return `${url.protocol}//${url.hostname}${url.pathname}`;
  } catch {
    return window.location.origin;
  }
}

function getDomain(): string {
  return window.location.hostname || document.domain || 'localhost';
}

function getAppName(browserName: string, domain: string): string {
  // Map well-known domains to friendly app names for the dashboard
  const knownApps: Record<string, string> = {
    'github.com': 'GitHub',
    'gitlab.com': 'GitLab',
    'stackoverflow.com': 'Stack Overflow',
    'youtube.com': 'YouTube',
    'chatgpt.com': 'ChatGPT',
    'chat.openai.com': 'ChatGPT',
    'gemini.google.com': 'Google Gemini',
    'notion.so': 'Notion',
    'figma.com': 'Figma',
    'docs.google.com': 'Google Docs',
    'sheets.google.com': 'Google Sheets',
    'mail.google.com': 'Gmail',
    'slack.com': 'Slack',
    'teams.microsoft.com': 'Microsoft Teams',
    'jira.atlassian.com': 'Jira',
    'confluence.atlassian.com': 'Confluence',
    'vercel.com': 'Vercel',
    'render.com': 'Render',
    'netlify.com': 'Netlify',
    'npmjs.com': 'npm',
    'instagram.com': 'Instagram',
    'twitter.com': 'Twitter / X',
    'x.com': 'Twitter / X',
    'facebook.com': 'Facebook',
    'linkedin.com': 'LinkedIn',
    'reddit.com': 'Reddit',
    'leetcode.com': 'LeetCode',
    'hackerrank.com': 'HackerRank',
    'codepen.io': 'CodePen',
    'replit.com': 'Replit',
    'codesandbox.io': 'CodeSandbox',
  };
  const rootDomain = domain.replace(/^www\./, '');
  return knownApps[rootDomain] || `${browserName} — ${rootDomain}`;
}

// ─── Offline queue helpers ────────────────────────────────────────────────────
function loadOfflineQueue(): any[] {
  try {
    return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveOfflineQueue(queue: any[]) {
  try {
    localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue.slice(-MAX_OFFLINE_QUEUE)));
  } catch { /* storage full — skip */ }
}

function clearOfflineQueue() {
  localStorage.removeItem(OFFLINE_QUEUE_KEY);
}

// ─── Hook ─────────────────────────────────────────────────────────────────────
export function useTelemetryAgent(isCheckedIn: boolean, isCheckedOut: boolean) {
  // Live counters (refs to avoid re-renders)
  const mouseClicksRef      = useRef(0);
  const keyboardPressesRef  = useRef(0);
  const tabSwitchCountRef   = useRef(0);
  const lastActivityRef     = useRef(Date.now());
  const isFocusedRef        = useRef(!document.hidden);
  const focusStartRef       = useRef(document.hidden ? 0 : Date.now());
  const focusDurationRef    = useRef(0);
  const intervalRef         = useRef<ReturnType<typeof setInterval> | null>(null);

  const browserName = detectBrowser();

  // ── Send one heartbeat ────────────────────────────────────────────────────
  const sendHeartbeat = useCallback(async (statusOverride?: 'Active' | 'Idle' | 'Break') => {
    const idleMs = Date.now() - lastActivityRef.current;
    let status: 'Active' | 'Idle' | 'Break' = statusOverride || (idleMs >= IDLE_THRESHOLD_MS ? 'Idle' : 'Active');

    // Accumulate focus duration
    if (isFocusedRef.current && focusStartRef.current > 0) {
      focusDurationRef.current += Math.round((Date.now() - focusStartRef.current) / 1000);
      focusStartRef.current = Date.now();
    }

    const domain   = getDomain();
    const url      = getSanitizedUrl();
    const appName  = getAppName(browserName, domain);

    const packet = {
      status,
      mouseClicks:          mouseClicksRef.current,
      keyboardPresses:      keyboardPressesRef.current,
      currentUrl:           url,
      currentDomain:        domain,
      browserName,
      appName,
      tabSwitchCount:       tabSwitchCountRef.current,
      focusDurationSeconds: focusDurationRef.current,
      isFocused:            isFocusedRef.current,
    };

    // Reset per-interval counters
    mouseClicksRef.current     = 0;
    keyboardPressesRef.current = 0;
    tabSwitchCountRef.current  = 0;
    focusDurationRef.current   = 0;

    try {
      // Flush any offline queue first
      const offlineQueue = loadOfflineQueue();
      if (offlineQueue.length > 0) {
        for (const p of offlineQueue) {
          await api.submitHeartbeat(p);
        }
        clearOfflineQueue();
      }
      await api.submitHeartbeat(packet);
    } catch (err: any) {
      // Network offline — buffer locally
      if (!err?.response) {
        const q = loadOfflineQueue();
        q.push({ ...packet, timestamp: new Date().toISOString() });
        saveOfflineQueue(q);
      }
      // 401/403 means not checked in — don't buffer
    }
  }, [browserName]);

  // ── Activity event listeners ───────────────────────────────────────────────
  useEffect(() => {
    if (!isCheckedIn || isCheckedOut) return;

    const onMouseClick = () => {
      mouseClicksRef.current++;
      lastActivityRef.current = Date.now();
    };
    const onKeyDown = () => {
      keyboardPressesRef.current++;
      lastActivityRef.current = Date.now();
    };
    const onMouseMove = () => {
      lastActivityRef.current = Date.now();
    };

    // Tab switch detection
    const onVisibilityChange = () => {
      const hidden = document.hidden;
      if (hidden) {
        tabSwitchCountRef.current++;
        isFocusedRef.current = false;
        // Accumulate focus time before leaving
        if (focusStartRef.current > 0) {
          focusDurationRef.current += Math.round((Date.now() - focusStartRef.current) / 1000);
          focusStartRef.current = 0;
        }
        // Fire immediate heartbeat on tab leave so dashboard updates fast
        sendHeartbeat('Active');
      } else {
        isFocusedRef.current = true;
        focusStartRef.current = Date.now();
        lastActivityRef.current = Date.now();
      }
    };

    // Window/app blur (switched to another OS app — minimized, alt-tab)
    const onWindowBlur = () => {
      isFocusedRef.current = false;
      if (focusStartRef.current > 0) {
        focusDurationRef.current += Math.round((Date.now() - focusStartRef.current) / 1000);
        focusStartRef.current = 0;
      }
    };
    const onWindowFocus = () => {
      isFocusedRef.current = true;
      focusStartRef.current = Date.now();
      lastActivityRef.current = Date.now();
    };

    document.addEventListener('click', onMouseClick, { passive: true });
    document.addEventListener('keydown', onKeyDown, { passive: true });
    document.addEventListener('mousemove', onMouseMove, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('blur', onWindowBlur);
    window.addEventListener('focus', onWindowFocus);

    return () => {
      document.removeEventListener('click', onMouseClick);
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('blur', onWindowBlur);
      window.removeEventListener('focus', onWindowFocus);
    };
  }, [isCheckedIn, isCheckedOut, sendHeartbeat]);

  // ── Heartbeat interval ────────────────────────────────────────────────────
  useEffect(() => {
    if (!isCheckedIn || isCheckedOut) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    // Send immediately on check-in
    sendHeartbeat();

    intervalRef.current = setInterval(() => {
      sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isCheckedIn, isCheckedOut, sendHeartbeat]);
}
