/**
 * Crouton Feeding & Treat Service
 *
 * Tracks Crouton's daily meals (~8:00 AM & ~5:00 PM, 1 cup each) and treat notes
 * across David, Tina, and Hieu to prevent accidental double-feeding.
 * Uses PostgreSQL (`corgi_feed_logs`) when available, with automatic fallback to
 * `data/corgi-feed-log.json`.
 */

import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { getPool } from './database.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FALLBACK_FILE = path.join(__dirname, '..', 'data', 'corgi-feed-log.json');

/** Household day / meal windows always use Pacific, even if the Node host is UTC. */
export const CROUTON_TIME_ZONE = 'America/Los_Angeles';

export const CROUTON_PROFILE = {
  name: 'Crouton',
  breed: 'Brown Cardigan Welsh Corgi × Australian Shepherd Mix ("Cardi-Auggie")',
  feeders: ['David', 'Tina', 'Hieu'],
  timeZone: CROUTON_TIME_ZONE,
  dailySchedule: {
    morning: {
      id: 'morning',
      label: 'Morning Meal (Breakfast)',
      targetTimeLabel: '8:00 AM',
      targetHour: 8,
      defaultCups: 1,
    },
    evening: {
      id: 'evening',
      label: 'Evening Meal (Dinner)',
      targetTimeLabel: '5:00 PM',
      targetHour: 17,
      defaultCups: 1,
    },
    dailyGoalCups: 2,
  },
};

/**
 * Calendar / clock parts in the household timezone (Pacific).
 * @param {Date|string|number} input
 * @param {string} [timeZone]
 * @returns {{ year: string, month: string, day: string, hour: number, minute: number, dayKey: string }}
 */
export function getZonedParts(input = new Date(), timeZone = CROUTON_TIME_ZONE) {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) {
    return getZonedParts(new Date(), timeZone);
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(d);
  const get = (type) => parts.find((p) => p.type === type)?.value || '00';
  const year = get('year');
  const month = get('month');
  const day = get('day');
  return {
    year,
    month,
    day,
    hour: Number(get('hour')),
    minute: Number(get('minute')),
    dayKey: `${year}-${month}-${day}`,
  };
}

let tableInitialized = false;
let memoryLogsCache = null;

async function ensureTable() {
  const pool = getPool();
  if (!pool) return false;
  if (tableInitialized) return true;
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS corgi_feed_logs (
        id VARCHAR(64) PRIMARY KEY,
        entry_type VARCHAR(24) NOT NULL DEFAULT 'meal',
        meal_slot VARCHAR(24) NOT NULL DEFAULT 'morning',
        fed_by VARCHAR(64) NOT NULL,
        cups NUMERIC(4, 2) NOT NULL DEFAULT 1.0,
        note TEXT DEFAULT '',
        fed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_corgi_feed_logs_fed_at
      ON corgi_feed_logs (fed_at DESC)
    `);
    tableInitialized = true;
    return true;
  } catch (err) {
    console.warn('⚠️ Failed to ensure corgi_feed_logs table, using file fallback:', err.message);
    return false;
  }
}

async function readFallbackLogs() {
  if (Array.isArray(memoryLogsCache)) {
    return memoryLogsCache;
  }
  try {
    const raw = await fs.readFile(FALLBACK_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    memoryLogsCache = Array.isArray(parsed) ? parsed : [];
  } catch {
    memoryLogsCache = [];
  }
  return memoryLogsCache;
}

async function writeFallbackLogs(logs) {
  memoryLogsCache = logs;
  try {
    await fs.mkdir(path.dirname(FALLBACK_FILE), { recursive: true });
    await fs.writeFile(FALLBACK_FILE, JSON.stringify(logs, null, 2), 'utf8');
  } catch (err) {
    console.warn('⚠️ Could not write corgi fallback file:', err.message);
  }
}

/**
 * Determine which meal slot ('morning' or 'evening') applies at a given timestamp.
 * Morning window: 3:00 AM – 1:59 PM Pacific (target ~8:00 AM)
 * Evening window: 2:00 PM – 2:59 AM Pacific (target ~5:00 PM)
 * @param {Date} [now]
 * @returns {'morning' | 'evening'}
 */
export function inferMealSlot(now = new Date()) {
  const hour = getZonedParts(now).hour;
  return hour >= 3 && hour < 14 ? 'morning' : 'evening';
}

/**
 * Return Pacific YYYY-MM-DD key so the daily 2-cup limit resets at Pacific midnight
 * even when the Node host (or Postgres) is running in UTC.
 * @param {Date|string} input
 * @returns {string}
 */
export function getLocalDayKey(input = new Date()) {
  return getZonedParts(input).dayKey;
}

function normalizeRow(row) {
  const fedAtIso =
    row.fed_at instanceof Date
      ? row.fed_at.toISOString()
      : new Date(row.fed_at || row.fedAt || Date.now()).toISOString();
  const entryType = row.entry_type || row.entryType || 'meal';
  const mealSlot =
    row.meal_slot ||
    row.mealSlot ||
    (entryType === 'treat' ? 'treat' : inferMealSlot(new Date(fedAtIso)));
  const cupsNum = Number(row.cups ?? (entryType === 'treat' ? 0 : 1));
  return {
    id: String(row.id),
    entryType: entryType === 'treat' ? 'treat' : 'meal',
    mealSlot,
    fedBy: String(row.fed_by || row.fedBy || 'David').trim(),
    cups: Number.isFinite(cupsNum) ? Number(cupsNum.toFixed(2)) : 1,
    note: String(row.note || '').trim(),
    fedAt: fedAtIso,
  };
}

/**
 * Fetch recent feeding and treat logs (newest first).
 * @param {number} [limit=50]
 */
export async function listFeedLogs(limit = 50) {
  const safeLimit = Math.max(1, Math.min(200, Number(limit) || 50));
  const dbReady = await ensureTable();
  if (dbReady) {
    try {
      const pool = getPool();
      const { rows } = await pool.query(
        `SELECT id, entry_type, meal_slot, fed_by, cups, note, fed_at
         FROM corgi_feed_logs
         ORDER BY fed_at DESC
         LIMIT $1`,
        [safeLimit]
      );
      return rows.map(normalizeRow);
    } catch (err) {
      console.warn('⚠️ Failed querying corgi_feed_logs, falling back to file:', err.message);
    }
  }

  const logs = await readFallbackLogs();
  return logs
    .map(normalizeRow)
    .sort((a, b) => new Date(b.fedAt).getTime() - new Date(a.fedAt).getTime())
    .slice(0, safeLimit);
}

/**
 * Compute Crouton's status summary from a list of logs at a reference time.
 * @param {Array} logs
 * @param {Date} [now]
 */
export function computeFeedingStatus(logs = [], now = new Date()) {
  const normalized = logs
    .map(normalizeRow)
    .sort((a, b) => new Date(b.fedAt).getTime() - new Date(a.fedAt).getTime());

  const todayKey = getLocalDayKey(now);
  const currentSlot = inferMealSlot(now);

  const todayLogs = normalized.filter((entry) => getLocalDayKey(entry.fedAt) === todayKey);
  const todayMeals = todayLogs.filter((entry) => entry.entryType === 'meal');
  const todayTreats = todayLogs.filter((entry) => entry.entryType === 'treat');

  const morningMeals = todayMeals.filter((entry) => entry.mealSlot === 'morning');
  const eveningMeals = todayMeals.filter((entry) => entry.mealSlot === 'evening');

  const totalCupsToday = Number(
    todayMeals.reduce((sum, entry) => sum + (Number(entry.cups) || 0), 0).toFixed(2)
  );
  const morningCups = Number(
    morningMeals.reduce((sum, entry) => sum + (Number(entry.cups) || 0), 0).toFixed(2)
  );
  const eveningCups = Number(
    eveningMeals.reduce((sum, entry) => sum + (Number(entry.cups) || 0), 0).toFixed(2)
  );

  const lastMeal = normalized.find((entry) => entry.entryType === 'meal') || null;
  const lastTreat = normalized.find((entry) => entry.entryType === 'treat') || null;

  const morningFed = morningCups >= 1;
  const eveningFed = eveningCups >= 1;
  const currentSlotFed = currentSlot === 'morning' ? morningFed : eveningFed;
  const currentSlotEntry =
    (currentSlot === 'morning' ? morningMeals[0] : eveningMeals[0]) || null;

  const dailyGoalCups = CROUTON_PROFILE.dailySchedule.dailyGoalCups;
  const isDailyGoalMet = totalCupsToday >= dailyGoalCups;
  const isOverfedToday = totalCupsToday > dailyGoalCups;

  let statusCode = 'READY_FOR_MEAL';
  let statusHeadline =
    currentSlot === 'morning'
      ? 'Ready for Morning Meal (1 Cup @ ~8:00 AM)'
      : 'Ready for Evening Meal (1 Cup @ ~5:00 PM)';
  let statusSubline = lastMeal
    ? `Last meal was logged by ${lastMeal.fedBy}.`
    : 'No meals logged yet today.';

  if (isOverfedToday) {
    statusCode = 'OVERFED_ALERT';
    statusHeadline = `STOP! Crouton already had ${totalCupsToday} cups today (over his 2-cup limit)!`;
    statusSubline = lastMeal
      ? `Last fed by ${lastMeal.fedBy} (${lastMeal.cups} cup). Close the food bucket lid!`
      : 'Daily limit exceeded.';
  } else if (isDailyGoalMet) {
    statusCode = 'ALL_DONE_TODAY';
    statusHeadline = 'DO NOT FEED MEAL — Crouton had both cups today (2 / 2 cups)!';
    statusSubline = lastMeal
      ? `Last fed by ${lastMeal.fedBy}. Don't trust his sad Corgi eyes!`
      : 'Both morning and evening meals are complete.';
  } else if (currentSlotFed && currentSlotEntry) {
    statusCode = 'SLOT_ALREADY_FED';
    const slotLabel = currentSlot === 'morning' ? 'Morning (8 AM)' : 'Evening (5 PM)';
    statusHeadline = `HOLD ON! ${slotLabel} meal already fed by ${currentSlotEntry.fedBy}!`;
    statusSubline = `${currentSlotEntry.fedBy} gave ${currentSlotEntry.cups} cup. Next meal is ${
      currentSlot === 'morning' ? 'Dinner at ~5:00 PM' : 'Breakfast tomorrow at ~8:00 AM'
    }.`;
  }

  return {
    dog: CROUTON_PROFILE,
    now: now.toISOString(),
    todayKey,
    currentSlot,
    statusCode,
    statusHeadline,
    statusSubline,
    canFeedCurrentSlotSafely: !currentSlotFed && !isDailyGoalMet,
    today: {
      totalCups: totalCupsToday,
      dailyGoalCups,
      remainingCups: Math.max(0, Number((dailyGoalCups - totalCupsToday).toFixed(2))),
      morningFed,
      morningCups,
      morningLastEntry: morningMeals[0] || null,
      eveningFed,
      eveningCups,
      eveningLastEntry: eveningMeals[0] || null,
      treatsCount: todayTreats.length,
      treats: todayTreats,
    },
    lastMeal,
    lastTreat,
    recentLogs: normalized.slice(0, 25),
  };
}

/**
 * Get current status summary for Crouton.
 */
export async function getFeedingStatus() {
  const logs = await listFeedLogs(60);
  return computeFeedingStatus(logs, new Date());
}

/**
 * Record a meal or treat note for Crouton.
 * Includes overfeed protection unless `force: true` is passed.
 * @param {object} payload
 */
export async function addFeedEntry(payload = {}) {
  const entryType = payload.entryType === 'treat' ? 'treat' : 'meal';
  const rawFeeder = String(payload.fedBy || '').trim();
  if (!rawFeeder) {
    const err = new Error('Please select who is feeding Crouton (David, Tina, or Hieu).');
    err.statusCode = 400;
    throw err;
  }

  const now = payload.fedAt ? new Date(payload.fedAt) : new Date();
  const mealSlot =
    entryType === 'treat'
      ? 'treat'
      : payload.mealSlot === 'morning' || payload.mealSlot === 'evening'
        ? payload.mealSlot
        : inferMealSlot(now);

  const defaultCups = entryType === 'treat' ? 0 : 1;
  const parsedCups =
    payload.cups !== undefined && payload.cups !== null && payload.cups !== ''
      ? Number(payload.cups)
      : defaultCups;

  if (!Number.isFinite(parsedCups) || parsedCups < 0 || parsedCups > 4) {
    const err = new Error('Cups amount must be between 0 and 4.');
    err.statusCode = 400;
    throw err;
  }

  const note = String(payload.note || '').trim().slice(0, 280);
  const force = Boolean(payload.force);

  const existingLogs = await listFeedLogs(60);
  const currentStatus = computeFeedingStatus(existingLogs, now);

  if (entryType === 'meal' && !force) {
    const slotAlreadyFed =
      mealSlot === 'morning'
        ? currentStatus.today.morningFed
        : currentStatus.today.eveningFed;
    const slotLastEntry =
      mealSlot === 'morning'
        ? currentStatus.today.morningLastEntry
        : currentStatus.today.eveningLastEntry;

    if (slotAlreadyFed && slotLastEntry) {
      const slotName = mealSlot === 'morning' ? 'Morning (~8 AM)' : 'Evening (~5 PM)';
      const err = new Error(
        `Hold on! ${slotLastEntry.fedBy} already fed Crouton's ${slotName} meal (${slotLastEntry.cups} cup).`
      );
      err.statusCode = 409;
      err.code = 'OVERFEED_WARNING';
      err.existingEntry = slotLastEntry;
      err.statusSummary = currentStatus;
      throw err;
    }

    if (currentStatus.today.totalCups + parsedCups > CROUTON_PROFILE.dailySchedule.dailyGoalCups) {
      const err = new Error(
        `Warning! Crouton has already had ${currentStatus.today.totalCups} cups today (daily target is 2 cups).`
      );
      err.statusCode = 409;
      err.code = 'OVERFEED_WARNING';
      err.existingEntry = currentStatus.lastMeal;
      err.statusSummary = currentStatus;
      throw err;
    }
  }

  const newEntry = {
    id: `corgi_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    entryType,
    mealSlot,
    fedBy: rawFeeder,
    cups: entryType === 'treat' ? 0 : Number(parsedCups.toFixed(2)),
    note:
      note ||
      (entryType === 'treat'
        ? 'Treat snack'
        : mealSlot === 'morning'
          ? 'Morning 8 AM scoop (1 cup)'
          : 'Evening 5 PM scoop (1 cup)'),
    fedAt: now.toISOString(),
  };

  const dbReady = await ensureTable();
  if (dbReady) {
    try {
      const pool = getPool();
      await pool.query(
        `INSERT INTO corgi_feed_logs (id, entry_type, meal_slot, fed_by, cups, note, fed_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [
          newEntry.id,
          newEntry.entryType,
          newEntry.mealSlot,
          newEntry.fedBy,
          newEntry.cups,
          newEntry.note,
          newEntry.fedAt,
        ]
      );
    } catch (err) {
      console.warn('⚠️ DB insert failed for corgi_feed_logs, saving to fallback file:', err.message);
      const fallback = await readFallbackLogs();
      fallback.unshift(newEntry);
      await writeFallbackLogs(fallback.slice(0, 200));
    }
  } else {
    const fallback = await readFallbackLogs();
    fallback.unshift(newEntry);
    await writeFallbackLogs(fallback.slice(0, 200));
  }

  const updatedLogs = await listFeedLogs(60);
  return {
    entry: newEntry,
    status: computeFeedingStatus(updatedLogs, now),
  };
}

/**
 * Delete/undo a feed or treat entry by ID.
 * @param {string} id
 */
export async function deleteFeedEntry(id) {
  const cleanId = String(id || '').trim();
  if (!cleanId) {
    const err = new Error('Entry id is required.');
    err.statusCode = 400;
    throw err;
  }

  const dbReady = await ensureTable();
  if (dbReady) {
    try {
      const pool = getPool();
      await pool.query('DELETE FROM corgi_feed_logs WHERE id = $1', [cleanId]);
    } catch (err) {
      console.warn('⚠️ DB delete failed for corgi_feed_logs:', err.message);
    }
  }

  const fallback = await readFallbackLogs();
  const next = fallback.filter((item) => String(item.id) !== cleanId);
  if (next.length !== fallback.length) {
    await writeFallbackLogs(next);
  }

  const updatedLogs = await listFeedLogs(60);
  return computeFeedingStatus(updatedLogs, new Date());
}

export function __resetCorgiMemoryCacheForTests() {
  memoryLogsCache = [];
}

export default {
  CROUTON_PROFILE,
  CROUTON_TIME_ZONE,
  getZonedParts,
  inferMealSlot,
  getLocalDayKey,
  listFeedLogs,
  computeFeedingStatus,
  getFeedingStatus,
  addFeedEntry,
  deleteFeedEntry,
  __resetCorgiMemoryCacheForTests,
};
