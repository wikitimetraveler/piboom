/**
 * Crew Log HTTP — trips, GPS points, check-ins, and the Today payload.
 * Development work by David Lane
 */
import express, { Router } from 'express';
import multer from 'multer';
import skiTopoService from '../services/ski-topo.service.js';
import { MAX_PHOTO_BYTES } from '../services/ski-log-media.service.js';
import store, { SkiLogError } from '../services/ski-log-store.service.js';
import {
  buildDayKml,
  cleanPoints,
  createRateLimiter,
  demIdForPoint,
  getAreaIndex,
  isIsoDate,
  localDay,
  normalizeTripCode,
  sanitizeDisplayName,
  sanitizeTripName,
  snapCandidates,
} from '../services/ski-log.service.js';

const router = Router();
const allowJoin = createRateLimiter({ windowMs: 10 * 60 * 1000, max: 30 });
const MAX_POINTS_PER_POST = 5000;
const trackText = express.text({
  type: ['application/gpx+xml', 'application/vnd.garmin.tcx+xml', 'application/xml', 'text/xml', 'text/plain', 'application/octet-stream'],
  limit: '25mb',
});
const photoUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1 } });
const PHOTO_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fail(res, error) {
  const status = error instanceof SkiLogError || error?.status ? error.status : 500;
  res.status(status).json({ error: error.message || 'Crew Log error' });
}

function limited(req, res) {
  if (allowJoin(req.ip)) return false;
  res.status(429).json({ error: 'Too many tries — wait a few minutes.' });
  return true;
}

async function withMember(req, res, next) {
  try {
    const code = normalizeTripCode(req.params.code);
    const token = req.get('x-ski-member') || String(req.query.t || '');
    if (!code || !token) return res.status(401).json({ error: 'Join the trip first.' });
    const auth = await store.authMember(code, token);
    if (!auth) return res.status(401).json({ error: 'That trip pass is not valid any more — join again.' });
    req.skiTrip = auth.trip;
    req.skiMember = auth.member;
    next();
  } catch (error) {
    fail(res, error);
  }
}

const finite = (v) => (v === undefined || v === null || v === '' ? NaN : Number(v));

router.post('/trips', async (req, res) => {
  if (limited(req, res)) return;
  try {
    const displayName = sanitizeDisplayName(req.body?.displayName);
    const name = sanitizeTripName(req.body?.name);
    const resortId = String(req.body?.resortId || '');
    const startDate = isIsoDate(req.body?.date) ? req.body.date : localDay(Date.now());
    if (!displayName) return res.status(400).json({ error: 'Add your name.' });
    if (!name) return res.status(400).json({ error: 'Name the trip.' });
    const catalog = await skiTopoService.loadDestinations();
    if (!(catalog.destinations || []).some((d) => d.id === resortId)) {
      return res.status(400).json({ error: 'Pick a resort from the list.' });
    }
    res.status(201).json(await store.createTrip({ name, resortId, startDate, displayName }));
  } catch (error) {
    fail(res, error);
  }
});

router.get('/trips/:code/preview', async (req, res) => {
  if (limited(req, res)) return;
  try {
    const code = normalizeTripCode(req.params.code);
    if (!code) return res.status(400).json({ error: 'Trip codes look like POW-4K7.' });
    const trip = await store.getTripByCode(code);
    if (!trip) return res.status(404).json({ error: 'No trip with that code.' });
    const members = await store.listMembers(trip.id);
    res.json({ code: trip.code, name: trip.name, resortId: trip.resortId, startDate: trip.startDate, riders: members.length });
  } catch (error) {
    fail(res, error);
  }
});

router.post('/trips/:code/join', async (req, res) => {
  if (limited(req, res)) return;
  try {
    const code = normalizeTripCode(req.params.code);
    const displayName = sanitizeDisplayName(req.body?.displayName);
    if (!code) return res.status(400).json({ error: 'Trip codes look like POW-4K7.' });
    if (!displayName) return res.status(400).json({ error: 'Add your name.' });
    res.status(201).json(await store.joinTrip(code, displayName));
  } catch (error) {
    fail(res, error);
  }
});

router.get('/trips/:code', withMember, async (req, res) => {
  try {
    res.json({ trip: req.skiTrip, me: req.skiMember, members: await store.listMembers(req.skiTrip.id) });
  } catch (error) {
    fail(res, error);
  }
});

router.post('/trips/:code/points', withMember, async (req, res) => {
  try {
    const raw = Array.isArray(req.body?.points) ? req.body.points : [];
    if (raw.length > MAX_POINTS_PER_POST) {
      return res.status(413).json({ error: `Send at most ${MAX_POINTS_PER_POST} points per upload.` });
    }
    const points = cleanPoints(raw);
    const inserted = await store.insertPoints(req.skiMember.id, points, 'live');
    res.json({ received: raw.length, kept: points.length, inserted });
  } catch (error) {
    fail(res, error);
  }
});

router.get('/trips/:code/snap', withMember, (req, res) => {
  const lat = finite(req.query.lat);
  const lng = finite(req.query.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'lat and lng are required.' });
  const demId = demIdForPoint(lat, lng);
  if (!demId) return res.json({ demId: null, candidates: [], note: 'You are not inside a mapped ski area.' });
  res.json({ demId, candidates: snapCandidates(getAreaIndex(demId), lat, lng) });
});

router.post('/trips/:code/checkins', withMember, async (req, res) => {
  try {
    const lat = finite(req.body?.lat);
    const lng = finite(req.body?.lng);
    const ts = Number.isFinite(finite(req.body?.ts)) ? Math.round(finite(req.body.ts)) : Date.now();
    const runId = String(req.body?.runId || '');
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return res.status(400).json({ error: 'lat and lng are required.' });
    const demId = demIdForPoint(lat, lng);
    const run = demId ? getAreaIndex(demId)?.runs.find((r) => r.id === runId) : null;
    if (!run) return res.status(400).json({ error: 'Pick a run on this mountain.' });
    const id = await store.insertCheckin(req.skiMember.id, { ts, lat, lng, demId, runId });
    res.status(201).json({ id, run: { id: run.id, name: run.name, difficulty: run.difficulty } });
  } catch (error) {
    fail(res, error);
  }
});

router.post('/trips/:code/import', withMember, trackText, async (req, res) => {
  try {
    if (typeof req.body !== 'string' || !req.body.trim()) {
      return res.status(400).json({ error: 'Send the GPX or TCX file as the request body.' });
    }
    res.json(await store.importTrack(req.skiMember.id, req.body));
  } catch (error) {
    fail(res, error);
  }
});

router.post('/trips/:code/photos', withMember, (req, res) => {
  photoUpload.single('photo')(req, res, async (uploadErr) => {
    try {
      if (uploadErr) {
        const tooBig = uploadErr.code === 'LIMIT_FILE_SIZE';
        return res.status(tooBig ? 413 : 400).json({ error: tooBig ? 'That photo is too big.' : uploadErr.message });
      }
      if (!req.file) return res.status(400).json({ error: 'Attach a photo.' });
      const b = req.body || {};
      const tsIn = finite(b.ts);
      const ts = Number.isFinite(tsIn) && tsIn > 946_684_800_000 && tsIn < Date.now() + 86_400_000 ? Math.round(tsIn) : Date.now();
      const caption = String(b.caption || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 140) || null;
      const photo = await store.addPhoto(req.skiTrip, req.skiMember, {
        buffer: req.file.buffer,
        ts,
        exifLat: finite(b.exifLat),
        exifLng: finite(b.exifLng),
        deviceLat: finite(b.deviceLat),
        deviceLng: finite(b.deviceLng),
        deviceTs: finite(b.deviceTs),
        runId: String(b.runId || '') || null,
        caption,
      });
      res.status(201).json(photo);
    } catch (error) {
      fail(res, error);
    }
  });
});

router.get('/trips/:code/photos/:file', async (req, res) => {
  try {
    const code = normalizeTripCode(req.params.code);
    const id = String(req.params.file || '').replace(/\.jpg$/i, '');
    if (!code || !PHOTO_ID_RE.test(id)) return res.status(404).end();
    const bytes = await store.getPhotoBytes(code, id, req.query.v === 'thumb' ? 'thumb' : 'full');
    if (!bytes) return res.status(404).end();
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' }).send(bytes);
  } catch (error) {
    fail(res, error);
  }
});

router.delete('/trips/:code/photos/:id', withMember, async (req, res) => {
  try {
    if (!PHOTO_ID_RE.test(req.params.id)) return res.status(404).json({ error: 'No such photo.' });
    const ok = await store.deletePhoto(req.skiTrip.id, req.skiMember.id, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Only the rider who posted a photo can delete it.' });
    res.json({ ok: true });
  } catch (error) {
    fail(res, error);
  }
});

router.get('/trips/:code/day.kml', withMember, async (req, res) => {
  try {
    const date = isIsoDate(req.query.date) ? req.query.date : localDay(Date.now());
    const day = await store.loadTripDay(req.skiTrip, date);
    const origin = `${req.protocol}://${req.get('host')}`;
    const code = encodeURIComponent(req.skiTrip.code);
    const kml = buildDayKml(day, {
      photoUrl: (id, thumb) => `${origin}/api/ski/log/trips/${code}/photos/${id}.jpg${thumb ? '?v=thumb' : ''}`,
    });
    const file = `${req.skiTrip.code}-${date}.kml`;
    res
      .set({
        'Content-Type': 'application/vnd.google-earth.kml+xml; charset=utf-8',
        'Content-Disposition': `attachment; filename="${file}"`,
        'Cache-Control': 'private, no-store',
      })
      .send(kml);
  } catch (error) {
    fail(res, error);
  }
});

router.get('/trips/:code/day', withMember, async (req, res) => {
  try {
    const date = isIsoDate(req.query.date) ? req.query.date : localDay(Date.now());
    res.json({ ...(await store.loadTripDay(req.skiTrip, date)), me: req.skiMember.id });
  } catch (error) {
    fail(res, error);
  }
});

export default router;
