/**
 * Crew Log persistence — trips, members, GPS points, check-ins, photos, recaps (Postgres).
 * Development work by David Lane
 */
import { randomUUID } from 'node:crypto';
import { getPool } from './database.service.js';
import { processPhotoBuffer } from './ski-log-media.service.js';
import {
  MAX_MEMBERS,
  MAX_TRIP_PHOTOS,
  SKI_TZ,
  buildTripDay,
  cleanPoints,
  dayBounds,
  daysCovered,
  dropCoveredPoints,
  generateMemberToken,
  generateTripCode,
  hashToken,
  memberColor,
  parseTrackFile,
  photoRun,
  placePhoto,
} from './ski-log.service.js';

const POINT_BATCH = 2000;

export class SkiLogError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function requirePool() {
  const pool = getPool();
  if (!pool) throw new SkiLogError('Crew Log needs the database, and it is not connected right now.', 503);
  return pool;
}

let schemaReady = null;

async function createSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ski_trips (
      id SERIAL PRIMARY KEY,
      code VARCHAR(7) UNIQUE NOT NULL,
      name VARCHAR(60) NOT NULL,
      resort_id VARCHAR(40) NOT NULL,
      start_date DATE NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ski_trip_members (
      id SERIAL PRIMARY KEY,
      trip_id INTEGER NOT NULL REFERENCES ski_trips(id) ON DELETE CASCADE,
      display_name VARCHAR(24) NOT NULL,
      color VARCHAR(9) NOT NULL,
      token_hash CHAR(64) UNIQUE NOT NULL,
      is_owner BOOLEAN NOT NULL DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ski_members_trip ON ski_trip_members(trip_id)');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ski_log_points (
      member_id INTEGER NOT NULL REFERENCES ski_trip_members(id) ON DELETE CASCADE,
      ts BIGINT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      alt_m REAL,
      acc_m REAL,
      speed_mps REAL,
      source VARCHAR(8) NOT NULL DEFAULT 'live',
      PRIMARY KEY (member_id, ts)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ski_log_checkins (
      id SERIAL PRIMARY KEY,
      member_id INTEGER NOT NULL REFERENCES ski_trip_members(id) ON DELETE CASCADE,
      ts BIGINT NOT NULL,
      lat DOUBLE PRECISION NOT NULL,
      lng DOUBLE PRECISION NOT NULL,
      dem_id VARCHAR(20) NOT NULL,
      run_id VARCHAR(40) NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ski_checkins_member_ts ON ski_log_checkins(member_id, ts)');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ski_log_photos (
      id UUID PRIMARY KEY,
      trip_id INTEGER NOT NULL REFERENCES ski_trips(id) ON DELETE CASCADE,
      member_id INTEGER NOT NULL REFERENCES ski_trip_members(id) ON DELETE CASCADE,
      ts BIGINT NOT NULL,
      lat DOUBLE PRECISION,
      lng DOUBLE PRECISION,
      place_source VARCHAR(10),
      dem_id VARCHAR(20),
      run_id VARCHAR(40),
      run_name VARCHAR(120),
      caption VARCHAR(140),
      width INTEGER,
      height INTEGER,
      jpeg BYTEA NOT NULL,
      thumb BYTEA NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query('CREATE INDEX IF NOT EXISTS idx_ski_photos_trip_ts ON ski_log_photos(trip_id, ts)');
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ski_log_recaps (
      trip_id INTEGER NOT NULL REFERENCES ski_trips(id) ON DELETE CASCADE,
      day DATE NOT NULL,
      status VARCHAR(20) NOT NULL,
      heygen_video_id VARCHAR(80),
      video_url TEXT,
      thumbnail_url TEXT,
      script TEXT,
      error TEXT,
      requested_by INTEGER,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (trip_id, day)
    )
  `);
}

export async function initSkiLogSchema() {
  const pool = requirePool();
  if (!schemaReady) {
    schemaReady = createSchema(pool).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  await schemaReady;
  return pool;
}

const isoDate = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : String(v || '').slice(0, 10));

function mapTrip(row) {
  return { id: row.id, code: row.code, name: row.name, resortId: row.resort_id, startDate: isoDate(row.start_date) };
}

function mapMember(row) {
  return { id: row.id, tripId: row.trip_id, name: row.display_name, color: row.color, isOwner: row.is_owner };
}

export async function createTrip({ name, resortId, startDate, displayName }) {
  const pool = await initSkiLogSchema();
  let trip = null;
  for (let attempt = 0; attempt < 6 && !trip; attempt++) {
    const res = await pool.query(
      `INSERT INTO ski_trips (code, name, resort_id, start_date) VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING RETURNING *`,
      [generateTripCode(), name, resortId, startDate]
    );
    trip = res.rows[0] || null;
  }
  if (!trip) throw new SkiLogError('Could not mint a trip code — try again.', 500);
  const token = generateMemberToken();
  const m = await pool.query(
    `INSERT INTO ski_trip_members (trip_id, display_name, color, token_hash, is_owner)
     VALUES ($1, $2, $3, $4, true) RETURNING *`,
    [trip.id, displayName, memberColor(0), hashToken(token)]
  );
  return { trip: mapTrip(trip), member: mapMember(m.rows[0]), token };
}

export async function getTripByCode(code) {
  const pool = await initSkiLogSchema();
  const res = await pool.query('SELECT * FROM ski_trips WHERE code = $1', [code]);
  return res.rows[0] ? mapTrip(res.rows[0]) : null;
}

export async function joinTrip(code, displayName) {
  const pool = await initSkiLogSchema();
  const trip = await getTripByCode(code);
  if (!trip) throw new SkiLogError('No trip with that code.', 404);
  const count = Number((await pool.query('SELECT COUNT(*) FROM ski_trip_members WHERE trip_id = $1', [trip.id])).rows[0].count);
  if (count >= MAX_MEMBERS) throw new SkiLogError(`This trip is full (${MAX_MEMBERS} riders).`, 409);
  const token = generateMemberToken();
  const m = await pool.query(
    `INSERT INTO ski_trip_members (trip_id, display_name, color, token_hash) VALUES ($1, $2, $3, $4) RETURNING *`,
    [trip.id, displayName, memberColor(count), hashToken(token)]
  );
  return { trip, member: mapMember(m.rows[0]), token };
}

export async function authMember(code, token) {
  if (!code || !token) return null;
  const pool = await initSkiLogSchema();
  const res = await pool.query(
    `SELECT t.*, m.id AS member_id, m.display_name, m.color, m.is_owner
     FROM ski_trip_members m JOIN ski_trips t ON t.id = m.trip_id
     WHERE t.code = $1 AND m.token_hash = $2`,
    [code, hashToken(token)]
  );
  const row = res.rows[0];
  if (!row) return null;
  return {
    trip: mapTrip(row),
    member: { id: row.member_id, tripId: row.id, name: row.display_name, color: row.color, isOwner: row.is_owner },
  };
}

export async function listMembers(tripId) {
  const pool = await initSkiLogSchema();
  const res = await pool.query('SELECT * FROM ski_trip_members WHERE trip_id = $1 ORDER BY id', [tripId]);
  return res.rows.map(mapMember);
}

export async function insertPoints(memberId, points, source = 'live') {
  if (!points.length) return 0;
  const pool = await initSkiLogSchema();
  let inserted = 0;
  for (let i = 0; i < points.length; i += POINT_BATCH) {
    const chunk = points.slice(i, i + POINT_BATCH);
    const res = await pool.query(
      `INSERT INTO ski_log_points (member_id, ts, lat, lng, alt_m, acc_m, speed_mps, source)
       SELECT $1::int, u.*, $8::varchar
       FROM unnest($2::bigint[], $3::float8[], $4::float8[], $5::real[], $6::real[], $7::real[]) AS u
       ON CONFLICT (member_id, ts) DO NOTHING`,
      [
        memberId,
        chunk.map((p) => p.ts),
        chunk.map((p) => p.lat),
        chunk.map((p) => p.lng),
        chunk.map((p) => p.alt),
        chunk.map((p) => p.acc),
        chunk.map((p) => p.speed),
        source,
      ]
    );
    inserted += res.rowCount;
  }
  return inserted;
}

const mapPoint = (r) => ({
  memberId: r.member_id,
  ts: Number(r.ts),
  lat: r.lat,
  lng: r.lng,
  alt: r.alt_m,
  acc: r.acc_m,
  speed: r.speed_mps,
});

export async function listDayPoints(tripId, start, end) {
  const pool = await initSkiLogSchema();
  const res = await pool.query(
    `SELECT p.* FROM ski_log_points p JOIN ski_trip_members m ON m.id = p.member_id
     WHERE m.trip_id = $1 AND p.ts >= $2 AND p.ts < $3 ORDER BY p.member_id, p.ts`,
    [tripId, start, end]
  );
  return res.rows.map(mapPoint);
}

export async function listMemberPoints(memberId, start, end) {
  const pool = await initSkiLogSchema();
  const res = await pool.query(
    'SELECT * FROM ski_log_points WHERE member_id = $1 AND ts >= $2 AND ts < $3 ORDER BY ts',
    [memberId, start, end]
  );
  return res.rows.map(mapPoint);
}

/** Resort-local days that have any points, check-ins, or photos — newest first. */
export async function listTripDays(tripId) {
  const pool = await initSkiLogSchema();
  const res = await pool.query(
    `SELECT DISTINCT to_char(to_timestamp(ts / 1000.0) AT TIME ZONE $2, 'YYYY-MM-DD') AS day FROM (
       SELECT p.ts FROM ski_log_points p JOIN ski_trip_members m ON m.id = p.member_id WHERE m.trip_id = $1
       UNION ALL
       SELECT c.ts FROM ski_log_checkins c JOIN ski_trip_members m ON m.id = c.member_id WHERE m.trip_id = $1
       UNION ALL
       SELECT ts FROM ski_log_photos WHERE trip_id = $1
     ) all_ts ORDER BY day DESC`,
    [tripId, SKI_TZ]
  );
  return res.rows.map((r) => r.day);
}

export async function insertCheckin(memberId, { ts, lat, lng, demId, runId }) {
  const pool = await initSkiLogSchema();
  const res = await pool.query(
    `INSERT INTO ski_log_checkins (member_id, ts, lat, lng, dem_id, run_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [memberId, ts, lat, lng, demId, runId]
  );
  return res.rows[0].id;
}

export async function listDayCheckins(tripId, start, end) {
  const pool = await initSkiLogSchema();
  const res = await pool.query(
    `SELECT c.* FROM ski_log_checkins c JOIN ski_trip_members m ON m.id = c.member_id
     WHERE m.trip_id = $1 AND c.ts >= $2 AND c.ts < $3 ORDER BY c.ts`,
    [tripId, start, end]
  );
  return res.rows.map((r) => ({
    id: r.id,
    memberId: r.member_id,
    ts: Number(r.ts),
    lat: r.lat,
    lng: r.lng,
    demId: r.dem_id,
    runId: r.run_id,
  }));
}

export async function countTripPhotos(tripId) {
  const pool = await initSkiLogSchema();
  return Number((await pool.query('SELECT COUNT(*) FROM ski_log_photos WHERE trip_id = $1', [tripId])).rows[0].count);
}

export async function insertPhoto(photo) {
  const pool = await initSkiLogSchema();
  const id = randomUUID();
  await pool.query(
    `INSERT INTO ski_log_photos
       (id, trip_id, member_id, ts, lat, lng, place_source, dem_id, run_id, run_name, caption, width, height, jpeg, thumb)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)`,
    [
      id,
      photo.tripId,
      photo.memberId,
      photo.ts,
      photo.lat,
      photo.lng,
      photo.placeSource,
      photo.demId,
      photo.runId,
      photo.runName,
      photo.caption,
      photo.width,
      photo.height,
      photo.jpeg,
      photo.thumb,
    ]
  );
  return id;
}

function mapPhoto(r) {
  return {
    id: r.id,
    memberId: r.member_id,
    ts: Number(r.ts),
    lat: r.lat,
    lng: r.lng,
    placeSource: r.place_source,
    demId: r.dem_id,
    runId: r.run_id,
    runName: r.run_name,
    caption: r.caption,
    width: r.width,
    height: r.height,
  };
}

export async function listDayPhotos(tripId, start, end) {
  const pool = await initSkiLogSchema();
  const res = await pool.query(
    `SELECT id, member_id, ts, lat, lng, place_source, dem_id, run_id, run_name, caption, width, height
     FROM ski_log_photos WHERE trip_id = $1 AND ts >= $2 AND ts < $3 ORDER BY ts`,
    [tripId, start, end]
  );
  return res.rows.map(mapPhoto);
}

export async function getPhotoBytes(tripCode, id, variant) {
  const pool = await initSkiLogSchema();
  const col = variant === 'thumb' ? 'thumb' : 'jpeg';
  const res = await pool.query(
    `SELECT p.${col} AS bytes FROM ski_log_photos p JOIN ski_trips t ON t.id = p.trip_id WHERE p.id = $1 AND t.code = $2`,
    [id, tripCode]
  );
  return res.rows[0]?.bytes || null;
}

export async function deletePhoto(tripId, memberId, id) {
  const pool = await initSkiLogSchema();
  const res = await pool.query('DELETE FROM ski_log_photos WHERE id = $1 AND trip_id = $2 AND member_id = $3', [
    id,
    tripId,
    memberId,
  ]);
  return res.rowCount > 0;
}

function mapRecap(r) {
  return {
    day: isoDate(r.day),
    status: r.status,
    videoId: r.heygen_video_id,
    videoUrl: r.video_url,
    thumbnailUrl: r.thumbnail_url,
    script: r.script,
    error: r.error,
    updatedAt: r.updated_at,
  };
}

export async function getRecap(tripId, day) {
  const pool = await initSkiLogSchema();
  const res = await pool.query('SELECT * FROM ski_log_recaps WHERE trip_id = $1 AND day = $2', [tripId, day]);
  return res.rows[0] ? mapRecap(res.rows[0]) : null;
}

/** Claim the one render slot for a trip day. Returns null if a render already exists. */
export async function claimRecap(tripId, day, memberId, script) {
  const pool = await initSkiLogSchema();
  const res = await pool.query(
    `INSERT INTO ski_log_recaps (trip_id, day, status, script, requested_by) VALUES ($1, $2, 'starting', $3, $4)
     ON CONFLICT (trip_id, day) DO UPDATE SET status = 'starting', script = EXCLUDED.script,
       requested_by = EXCLUDED.requested_by, error = NULL, updated_at = now()
       WHERE ski_log_recaps.status = 'failed'
     RETURNING *`,
    [tripId, day, script, memberId]
  );
  return res.rows[0] ? mapRecap(res.rows[0]) : null;
}

export async function updateRecap(tripId, day, { status, videoId, videoUrl, thumbnailUrl, error }) {
  const pool = await initSkiLogSchema();
  const res = await pool.query(
    `UPDATE ski_log_recaps SET status = $3,
       heygen_video_id = COALESCE($4, heygen_video_id),
       video_url = COALESCE($5, video_url),
       thumbnail_url = COALESCE($6, thumbnail_url),
       error = $7, updated_at = now()
     WHERE trip_id = $1 AND day = $2 RETURNING *`,
    [tripId, day, status, videoId ?? null, videoUrl ?? null, thumbnailUrl ?? null, error ?? null]
  );
  return res.rows[0] ? mapRecap(res.rows[0]) : null;
}

/** GPX/TCX text → cleaned points for one rider, skipping anything live tracking already logged. */
export async function importTrack(memberId, text) {
  let raw;
  try {
    raw = parseTrackFile(text);
  } catch (err) {
    throw new SkiLogError(err.message, 400);
  }
  const points = cleanPoints(raw, { maxAccuracyM: 100 });
  if (!points.length) throw new SkiLogError('No usable points in that track.', 400);
  const first = points[0].ts;
  const last = points[points.length - 1].ts;
  const existing = await listMemberPoints(memberId, first - 60_000, last + 60_000);
  const fresh = dropCoveredPoints(points, existing.map((p) => p.ts));
  const inserted = await insertPoints(memberId, fresh, 'import');
  return { parsed: raw.length, kept: points.length, skippedAsDuplicate: points.length - fresh.length, inserted, days: daysCovered(points) };
}

/** Re-encode, pin, and store one photo. */
export async function addPhoto(trip, member, { buffer, ts, exifLat, exifLng, deviceLat, deviceLng, deviceTs, runId, caption }) {
  if ((await countTripPhotos(trip.id)) >= MAX_TRIP_PHOTOS) {
    throw new SkiLogError(`This trip already has ${MAX_TRIP_PHOTOS} photos.`, 409);
  }
  const media = await processPhotoBuffer(buffer);
  const around = await listMemberPoints(member.id, ts - 15 * 60_000, ts + 15 * 60_000);
  const pin = placePhoto({ ts, exifLat, exifLng, deviceLat, deviceLng, deviceTs }, around);
  const run = photoRun({ lat: pin.lat, lng: pin.lng, runId });
  const id = await insertPhoto({
    tripId: trip.id,
    memberId: member.id,
    ts,
    lat: run.lat,
    lng: run.lng,
    placeSource: run.placed ? 'run' : pin.source,
    demId: run.demId,
    runId: run.runId,
    runName: run.runName,
    caption,
    width: media.width,
    height: media.height,
    jpeg: media.jpeg,
    thumb: media.thumb,
  });
  return { id, ts, lat: run.lat, lng: run.lng, placeSource: run.placed ? 'run' : pin.source, runId: run.runId, runName: run.runName };
}

/** Members, points, check-ins, and photos for one resort-local day, built into the Today payload. */
export async function loadTripDay(trip, date) {
  const { start, end } = dayBounds(date);
  const [members, points, checkins, photos, days] = await Promise.all([
    listMembers(trip.id),
    listDayPoints(trip.id, start, end),
    listDayCheckins(trip.id, start, end),
    listDayPhotos(trip.id, start, end),
    listTripDays(trip.id),
  ]);
  return { ...buildTripDay({ trip, members, points, checkins, photos, date }), days };
}

export default {
  SkiLogError,
  importTrack,
  addPhoto,
  loadTripDay,
  initSkiLogSchema,
  createTrip,
  getTripByCode,
  joinTrip,
  authMember,
  listMembers,
  insertPoints,
  listDayPoints,
  listMemberPoints,
  listTripDays,
  insertCheckin,
  listDayCheckins,
  countTripPhotos,
  insertPhoto,
  listDayPhotos,
  getPhotoBytes,
  deletePhoto,
  getRecap,
  claimRecap,
  updateRecap,
};
