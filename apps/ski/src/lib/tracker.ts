import { uploadPoints } from './logApi';
import type { TripPass } from './logTypes';

export interface Fix {
  ts: number;
  lat: number;
  lng: number;
  alt: number | null;
  acc: number | null;
  speed: number | null;
}

export interface TrackerState {
  tracking: boolean;
  lastFix: Fix | null;
  queued: number;
  uploaded: number;
  awake: boolean;
  error: string;
}

const FLUSH_MS = 30_000;
const MIN_GAP_MS = 4_000;
const MAX_QUEUE = 20_000;
const BATCH = 2_000;

interface WakeLockLike {
  release(): Promise<void>;
  addEventListener(type: 'release', cb: () => void): void;
}

const queueKey = (code: string) => `skiLog.queue.${code}`;
const TRACKING_KEY = 'skiLog.tracking';

/** Live GPS → localStorage queue → batched upload. iPhone Safari only reports while the page is open and lit. */
export class Tracker {
  private watchId: number | null = null;
  private timer: number | null = null;
  private lock: WakeLockLike | null = null;
  private flushing = false;
  private state: TrackerState;

  constructor(
    private pass: TripPass,
    private onChange: (s: TrackerState) => void,
    private onFix?: (f: Fix) => void
  ) {
    this.state = { tracking: false, lastFix: null, queued: this.readQueue().length, uploaded: 0, awake: false, error: '' };
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  get snapshot() {
    return this.state;
  }

  static wasTracking(code: string) {
    return localStorage.getItem(TRACKING_KEY) === code;
  }

  private set(patch: Partial<TrackerState>) {
    this.state = { ...this.state, ...patch };
    this.onChange(this.state);
  }

  private readQueue(): Fix[] {
    try {
      return JSON.parse(localStorage.getItem(queueKey(this.pass.code)) || '[]');
    } catch {
      return [];
    }
  }

  private writeQueue(q: Fix[]) {
    const trimmed = q.length > MAX_QUEUE ? q.slice(q.length - MAX_QUEUE) : q;
    try {
      localStorage.setItem(queueKey(this.pass.code), JSON.stringify(trimmed));
    } catch {
      /* storage full — keep going in memory until the next flush */
    }
    this.set({ queued: trimmed.length });
  }

  start() {
    if (!('geolocation' in navigator)) {
      this.set({ error: 'This browser has no GPS access.' });
      return;
    }
    if (this.watchId != null) return;
    localStorage.setItem(TRACKING_KEY, this.pass.code);
    this.watchId = navigator.geolocation.watchPosition(this.onPosition, this.onError, {
      enableHighAccuracy: true,
      maximumAge: 0,
      timeout: 30_000,
    });
    this.timer = window.setInterval(() => void this.flush(), FLUSH_MS);
    this.set({ tracking: true, error: '' });
    void this.acquireWakeLock();
  }

  stop() {
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    this.watchId = null;
    if (this.timer != null) window.clearInterval(this.timer);
    this.timer = null;
    localStorage.removeItem(TRACKING_KEY);
    void this.lock?.release().catch(() => undefined);
    this.lock = null;
    this.set({ tracking: false, awake: false });
    void this.flush();
  }

  dispose() {
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (this.watchId != null) navigator.geolocation.clearWatch(this.watchId);
    if (this.timer != null) window.clearInterval(this.timer);
    void this.lock?.release().catch(() => undefined);
  }

  private async acquireWakeLock() {
    const wl = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<WakeLockLike> } }).wakeLock;
    if (!wl || document.visibilityState !== 'visible') return;
    try {
      this.lock = await wl.request('screen');
      this.set({ awake: true });
      this.lock.addEventListener('release', () => this.set({ awake: false }));
    } catch {
      this.set({ awake: false });
    }
  }

  private onVisibility = () => {
    if (document.visibilityState === 'visible') {
      if (this.state.tracking && !this.lock) void this.acquireWakeLock();
      void this.flush();
    } else {
      this.lock = null;
      void this.flush(true);
    }
  };

  private onPosition = (pos: GeolocationPosition) => {
    const c = pos.coords;
    const fix: Fix = {
      ts: pos.timestamp || Date.now(),
      lat: c.latitude,
      lng: c.longitude,
      alt: c.altitude ?? null,
      acc: Number.isFinite(c.accuracy) ? Math.round(c.accuracy) : null,
      speed: c.speed != null && c.speed >= 0 ? c.speed : null,
    };
    this.onFix?.(fix);
    const prev = this.state.lastFix;
    this.set({ lastFix: fix, error: '' });
    if (prev && fix.ts - prev.ts < MIN_GAP_MS) return;
    const q = this.readQueue();
    q.push(fix);
    this.writeQueue(q);
  };

  private onError = (err: GeolocationPositionError) => {
    const msg =
      err.code === err.PERMISSION_DENIED
        ? 'Location is blocked. In iPhone Settings → Safari → Location, allow it for this site.'
        : err.code === err.TIMEOUT
          ? 'Still looking for GPS…'
          : 'GPS is not available right now.';
    this.set({ error: msg });
  };

  async flush(keepalive = false) {
    if (this.flushing) return;
    const q = this.readQueue();
    if (!q.length) return;
    this.flushing = true;
    try {
      const batch = q.slice(0, BATCH);
      await uploadPoints(this.pass, batch, keepalive && batch.length < 400);
      const rest = this.readQueue().slice(batch.length);
      this.writeQueue(rest);
      this.set({ uploaded: this.state.uploaded + batch.length });
    } catch {
      /* offline on the lift — points stay queued */
    } finally {
      this.flushing = false;
    }
  }
}

export function getOneFix(timeoutMs = 15_000): Promise<Fix> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new Error('This browser has no GPS access.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          ts: pos.timestamp || Date.now(),
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          alt: pos.coords.altitude ?? null,
          acc: Math.round(pos.coords.accuracy),
          speed: pos.coords.speed ?? null,
        }),
      (err) =>
        reject(
          new Error(
            err.code === err.PERMISSION_DENIED
              ? 'Location is blocked. Allow it for this site in Settings → Safari → Location.'
              : 'Could not get a GPS fix — try again in the open.'
          )
        ),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 10_000 }
    );
  });
}
