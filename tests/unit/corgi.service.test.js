/**
 * Unit tests for Crouton Corgi feeding & treat service
 */

import {
  CROUTON_PROFILE,
  CROUTON_TIME_ZONE,
  getLocalDayKey,
  getZonedParts,
  inferMealSlot,
  computeFeedingStatus,
  addFeedEntry,
  deleteFeedEntry,
  __resetCorgiMemoryCacheForTests,
} from '../../services/corgi.service.js';

/** Explicit Pacific wall-clock timestamps so tests pass on UTC CI hosts. */
function pacificIso(year, month, day, hour, minute = 0) {
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  const hh = String(hour).padStart(2, '0');
  const mi = String(minute).padStart(2, '0');
  // Fixed -08:00 offset is fine for these Nov test dates (PST).
  return new Date(`${year}-${mm}-${dd}T${hh}:${mi}:00-08:00`);
}

describe('corgi.service — Crouton Cardigan Welsh Corgi × Aussie Tracker', () => {
  beforeEach(() => {
    __resetCorgiMemoryCacheForTests();
  });

  test('exposes Crouton profile with David, Tina, and Hieu and 2-cup daily schedule', () => {
    expect(CROUTON_PROFILE.name).toBe('Crouton');
    expect(CROUTON_PROFILE.breed).toMatch(/Cardigan Welsh Corgi/i);
    expect(CROUTON_PROFILE.breed).toMatch(/Australian Shepherd/i);
    expect(CROUTON_PROFILE.feeders).toEqual(['David', 'Tina', 'Hieu']);
    expect(CROUTON_PROFILE.timeZone).toBe(CROUTON_TIME_ZONE);
    expect(CROUTON_PROFILE.dailySchedule.dailyGoalCups).toBe(2);
    expect(CROUTON_PROFILE.dailySchedule.morning.defaultCups).toBe(1);
    expect(CROUTON_PROFILE.dailySchedule.evening.defaultCups).toBe(1);
  });

  test('getLocalDayKey / inferMealSlot use America/Los_Angeles even for UTC hosts', () => {
    // Saturday Nov 7, 2026 5:10 PM Pacific = Sunday Nov 8, 01:10 UTC
    const saturdayEveningPacific = new Date('2026-11-08T01:10:00.000Z');
    expect(getLocalDayKey(saturdayEveningPacific)).toBe('2026-11-07');
    expect(inferMealSlot(saturdayEveningPacific)).toBe('evening');

    // Sunday Nov 8, 2026 6:09 AM Pacific = Sunday Nov 8, 14:09 UTC
    const sundayMorningPacific = new Date('2026-11-08T14:09:00.000Z');
    expect(getLocalDayKey(sundayMorningPacific)).toBe('2026-11-08');
    expect(inferMealSlot(sundayMorningPacific)).toBe('morning');
    expect(getZonedParts(sundayMorningPacific).hour).toBe(6);
  });

  test('inferMealSlot maps ~8 AM window to morning and ~5 PM window to evening', () => {
    const eightAm = pacificIso(2026, 11, 7, 8, 15);
    const fivePm = pacificIso(2026, 11, 7, 17, 5);

    expect(inferMealSlot(eightAm)).toBe('morning');
    expect(inferMealSlot(fivePm)).toBe('evening');
  });

  test('yesterday evening meal does NOT count toward today after Pacific midnight', () => {
    const saturdayEveningMeal = {
      id: 'm-sat',
      entryType: 'meal',
      mealSlot: 'evening',
      fedBy: 'Tina',
      cups: 1,
      note: 'Evening 5 PM scoop',
      fedAt: pacificIso(2026, 11, 7, 17, 10).toISOString(),
    };
    const saturdayMorningMeal = {
      id: 'm-sat-am',
      entryType: 'meal',
      mealSlot: 'morning',
      fedBy: 'David',
      cups: 1,
      note: 'Morning 8 AM scoop',
      fedAt: pacificIso(2026, 11, 7, 8, 5).toISOString(),
    };

    const sundayMorning = pacificIso(2026, 11, 8, 6, 9);
    const status = computeFeedingStatus(
      [saturdayEveningMeal, saturdayMorningMeal],
      sundayMorning
    );

    expect(status.todayKey).toBe('2026-11-08');
    expect(status.statusCode).toBe('READY_FOR_MEAL');
    expect(status.canFeedCurrentSlotSafely).toBe(true);
    expect(status.today.totalCups).toBe(0);
    expect(status.today.morningFed).toBe(false);
    expect(status.today.eveningFed).toBe(false);
    // Last meal history still shows yesterday's scoop, but today's meter is empty
    expect(status.lastMeal.fedBy).toBe('Tina');
  });

  test('computeFeedingStatus detects READY_FOR_MEAL, SLOT_ALREADY_FED, and ALL_DONE_TODAY', () => {
    const morningRef = pacificIso(2026, 11, 7, 8, 30);

    // 1) Empty today -> ready for morning meal
    const statusEmpty = computeFeedingStatus([], morningRef);
    expect(statusEmpty.statusCode).toBe('READY_FOR_MEAL');
    expect(statusEmpty.canFeedCurrentSlotSafely).toBe(true);
    expect(statusEmpty.today.totalCups).toBe(0);

    // 2) David feeds 1 cup at 8:05 AM -> morning slot is marked fed
    const logsAfterMorning = [
      {
        id: 'm1',
        entryType: 'meal',
        mealSlot: 'morning',
        fedBy: 'David',
        cups: 1,
        note: 'Morning 8 AM scoop',
        fedAt: pacificIso(2026, 11, 7, 8, 5).toISOString(),
      },
    ];
    const statusAfterMorning = computeFeedingStatus(logsAfterMorning, morningRef);
    expect(statusAfterMorning.statusCode).toBe('SLOT_ALREADY_FED');
    expect(statusAfterMorning.canFeedCurrentSlotSafely).toBe(false);
    expect(statusAfterMorning.today.morningFed).toBe(true);
    expect(statusAfterMorning.today.eveningFed).toBe(false);
    expect(statusAfterMorning.today.totalCups).toBe(1);
    expect(statusAfterMorning.lastMeal.fedBy).toBe('David');

    // 3) At 5:15 PM before evening scoop -> ready for evening meal
    const eveningRef = pacificIso(2026, 11, 7, 17, 15);
    const statusBeforeDinner = computeFeedingStatus(logsAfterMorning, eveningRef);
    expect(statusBeforeDinner.statusCode).toBe('READY_FOR_MEAL');
    expect(statusBeforeDinner.canFeedCurrentSlotSafely).toBe(true);

    // 4) Tina feeds 1 cup at 5:10 PM -> 2 / 2 cups complete (ALL_DONE_TODAY)
    const logsAfterBoth = [
      {
        id: 'm2',
        entryType: 'meal',
        mealSlot: 'evening',
        fedBy: 'Tina',
        cups: 1,
        note: 'Evening 5 PM scoop',
        fedAt: pacificIso(2026, 11, 7, 17, 10).toISOString(),
      },
      ...logsAfterMorning,
    ];
    const statusAllDone = computeFeedingStatus(logsAfterBoth, eveningRef);
    expect(statusAllDone.statusCode).toBe('ALL_DONE_TODAY');
    expect(statusAllDone.canFeedCurrentSlotSafely).toBe(false);
    expect(statusAllDone.today.totalCups).toBe(2);
    expect(statusAllDone.today.remainingCups).toBe(0);
  });

  test('addFeedEntry blocks accidental double-feeding unless force=true, and logs treat notes cleanly', async () => {
    const morningTime = pacificIso(2026, 11, 7, 8, 0).toISOString();

    const first = await addFeedEntry({
      fedBy: 'David',
      entryType: 'meal',
      mealSlot: 'morning',
      cups: 1,
      fedAt: morningTime,
    });
    expect(first.entry.fedBy).toBe('David');
    expect(first.status.today.morningFed).toBe(true);

    // Hieu scans bucket 20 minutes later and tries to log morning meal again
    await expect(
      addFeedEntry({
        fedBy: 'Hieu',
        entryType: 'meal',
        mealSlot: 'morning',
        cups: 1,
        fedAt: pacificIso(2026, 11, 7, 8, 20).toISOString(),
      })
    ).rejects.toMatchObject({
      statusCode: 409,
      code: 'OVERFEED_WARNING',
    });

    // Logging a treat note does NOT trigger meal overfeed error and increments treatsCount
    const treatRes = await addFeedEntry({
      fedBy: 'Hieu',
      entryType: 'treat',
      note: 'Dental chew stick',
      fedAt: pacificIso(2026, 11, 7, 12, 0).toISOString(),
    });
    expect(treatRes.entry.entryType).toBe('treat');
    expect(treatRes.entry.note).toBe('Dental chew stick');
    expect(treatRes.status.today.treatsCount).toBe(1);
    expect(treatRes.status.today.totalCups).toBe(1);

    // Undo / delete works
    const afterDelete = await deleteFeedEntry(first.entry.id);
    expect(afterDelete.today.morningFed).toBe(false);
  });
});
