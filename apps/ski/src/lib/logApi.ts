import type { Member, SnapCandidate, TripDay, TripInfo, TripPass } from './logTypes';

const PASSES_KEY = 'skiLog.passes';
const CURRENT_KEY = 'skiLog.current';
const BASE = '/api/ski/log';

export class LogApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

function readPasses(): Record<string, TripPass> {
  try {
    return JSON.parse(localStorage.getItem(PASSES_KEY) || '{}') || {};
  } catch {
    return {};
  }
}

export function listPasses(): TripPass[] {
  return Object.values(readPasses());
}

export function currentPass(): TripPass | null {
  const code = localStorage.getItem(CURRENT_KEY);
  return code ? readPasses()[code] || null : null;
}

export function savePass(pass: TripPass) {
  const all = readPasses();
  all[pass.code] = pass;
  localStorage.setItem(PASSES_KEY, JSON.stringify(all));
  localStorage.setItem(CURRENT_KEY, pass.code);
}

export function switchPass(code: string | null) {
  if (code) localStorage.setItem(CURRENT_KEY, code);
  else localStorage.removeItem(CURRENT_KEY);
}

export function forgetPass(code: string) {
  const all = readPasses();
  delete all[code];
  localStorage.setItem(PASSES_KEY, JSON.stringify(all));
  if (localStorage.getItem(CURRENT_KEY) === code) localStorage.removeItem(CURRENT_KEY);
}

async function call<T>(path: string, init: RequestInit = {}, pass?: TripPass | null): Promise<T> {
  const headers = new Headers(init.headers);
  if (pass) headers.set('x-ski-member', pass.token);
  if (init.body && typeof init.body === 'string') headers.set('content-type', 'application/json');
  const res = await fetch(BASE + path, { ...init, headers });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const msg = (data as { error?: string } | null)?.error || `Crew Log request failed (${res.status})`;
    throw new LogApiError(msg, res.status);
  }
  return data as T;
}

interface JoinResult {
  trip: TripInfo;
  member: Member;
  token: string;
}

function toPass({ trip, member, token }: JoinResult): TripPass {
  return {
    code: trip.code,
    token,
    tripName: trip.name,
    resortId: trip.resortId,
    memberId: member.id,
    memberName: member.name,
    color: member.color,
    isOwner: Boolean(member.isOwner),
  };
}

export async function createTrip(body: { name: string; resortId: string; date: string; displayName: string }) {
  const pass = toPass(await call<JoinResult>('/trips', { method: 'POST', body: JSON.stringify(body) }));
  savePass(pass);
  return pass;
}

export function previewTrip(code: string) {
  return call<{ code: string; name: string; resortId: string; startDate: string; riders: number }>(
    `/trips/${encodeURIComponent(code)}/preview`
  );
}

export async function joinTrip(code: string, displayName: string) {
  const pass = toPass(
    await call<JoinResult>(`/trips/${encodeURIComponent(code)}/join`, {
      method: 'POST',
      body: JSON.stringify({ displayName }),
    })
  );
  savePass(pass);
  return pass;
}

export function getTrip(pass: TripPass) {
  return call<{ trip: TripInfo; me: Member; members: Member[] }>(`/trips/${pass.code}`, {}, pass);
}

export function uploadPoints(pass: TripPass, points: unknown[], keepalive = false) {
  return call<{ received: number; kept: number; inserted: number }>(
    `/trips/${pass.code}/points`,
    { method: 'POST', body: JSON.stringify({ points }), keepalive },
    pass
  );
}

export function snapRuns(pass: TripPass, lat: number, lng: number) {
  return call<{ demId: string | null; candidates: SnapCandidate[]; note?: string }>(
    `/trips/${pass.code}/snap?lat=${lat}&lng=${lng}`,
    {},
    pass
  );
}

export function checkIn(pass: TripPass, body: { lat: number; lng: number; ts: number; runId: string }) {
  return call<{ id: number; run: { id: string; name: string | null; difficulty: string } }>(
    `/trips/${pass.code}/checkins`,
    { method: 'POST', body: JSON.stringify(body) },
    pass
  );
}

export function getDay(pass: TripPass, date?: string) {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  return call<TripDay>(`/trips/${pass.code}/day${q}`, {}, pass);
}

export async function importTrack(pass: TripPass, file: File) {
  const text = await file.text();
  const type = /\.tcx$/i.test(file.name) ? 'application/vnd.garmin.tcx+xml' : 'application/gpx+xml';
  const res = await fetch(`${BASE}/trips/${pass.code}/import`, {
    method: 'POST',
    headers: { 'x-ski-member': pass.token, 'content-type': type },
    body: text,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new LogApiError(data?.error || `Import failed (${res.status})`, res.status);
  return data as { parsed: number; kept: number; skippedAsDuplicate: number; inserted: number; days: string[] };
}

export async function uploadPhoto(pass: TripPass, form: FormData) {
  const res = await fetch(`${BASE}/trips/${pass.code}/photos`, {
    method: 'POST',
    headers: { 'x-ski-member': pass.token },
    body: form,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new LogApiError(data?.error || `Photo upload failed (${res.status})`, res.status);
  return data as { id: string; ts: number; lat: number | null; lng: number | null; placeSource: string | null; runName: string | null };
}

/** Hands the day's KML to Google Earth: the iOS share sheet when it takes files, else a download. */
export async function exportKml(pass: TripPass, date: string): Promise<'shared' | 'downloaded'> {
  const res = await fetch(`${BASE}/trips/${pass.code}/day.kml?date=${encodeURIComponent(date)}`, {
    headers: { 'x-ski-member': pass.token },
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new LogApiError(data?.error || `KML export failed (${res.status})`, res.status);
  }
  const blob = await res.blob();
  const name = `${pass.code}-${date}.kml`;
  const file = new File([blob], name, { type: 'application/vnd.google-earth.kml+xml' });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: `${pass.tripName} — ${date}` });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'shared';
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return 'downloaded';
}

export function deletePhoto(pass: TripPass, id: string) {
  return call<{ ok: boolean }>(`/trips/${pass.code}/photos/${id}`, { method: 'DELETE' }, pass);
}

export function photoUrl(code: string, id: string, thumb = false) {
  return `${BASE}/trips/${encodeURIComponent(code)}/photos/${id}.jpg${thumb ? '?v=thumb' : ''}`;
}

export function shareUrl(code: string) {
  return `${window.location.origin}/ski/log?trip=${encodeURIComponent(code)}`;
}
