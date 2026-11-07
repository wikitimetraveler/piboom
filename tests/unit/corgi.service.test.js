/**
 * Unit tests for Crouton Corgi feeding & treat service
 */

import {
  CROUTON_PROFILE,
  inferMealSlot,
  computeFeedingStatus,
  addFeedEntry,
  deleteFeedEntry,
  __resetCorgiMemoryCacheForTests,
} from '../../services/corgi.service.js';

describe('corgi.service — Crouton Cardigan Welsh Corgi × Aussie Tracker', () => {
  beforeEach(() => {
    __resetCorgiMemoryCacheForTests();
  });

  test('exposes Crouton profile with David, Tina, and Hieu and 2-cup daily schedule', () => {
    expect(CROUTON_PROFILE.name).toBe('Crouton');
    expect(CROUTON_PROFILE.breed).toMatch(/Cardigan Welsh Corgi/i);
    expect(CROUTON_PROFILE.breed).toMatch(/Australian Shepherd/i);
    expect(CROUTON_PROFILE.feeders).toEqual(['David', 'Tina', 'Hieu']);
    expect(CROUTON_PROFILE.dailySchedule.dailyGoalCups).toBe(2);
    expect(CROUTON_PROFILE.dailySchedule.morning.defaultCups).toBe(1);
    expect(CROUTON_PROFILE.dailySchedule.evening.defaultCups).toBe(1);
  });

  test('inferMealSlot maps ~8 AM window to morning and ~5 PM window to evening', () => {
    const eightAm = new Date(2026, 10, 7, 8, 15, 0);
    const fivePm = new Date(2026, 10, 7, 17, 5, 0);

    expect(inferMealSlot(eightAm)).toBe('morning');
    expect(inferMealSlot(fivePm)).toBe('evening');
  });

  test('computeFeedingStatus detects READY_FOR_MEAL, SLOT_ALREADY_FED, and ALL_DONE_TODAY', () => {
    const morningRef = new Date(2026, 10, 7, 8, 30, 0);

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
        fedAt: new Date(2026, 10, 7, 8, 5, 0).toISOString(),
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
    const eveningRef = new Date(2026, 10, 7, 17, 15, 0);
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
        fedAt: new Date(2026, 10, 7, 17, 10, 0).toISOString(),
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
    const morningTime = new Date(2026, 10, 7, 8, 0, 0).toISOString();

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
        fedAt: new Date(2026, 10, 7, 8, 20, 0).toISOString(),
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
      fedAt: new Date(2026, 10, 7, 12, 0, 0).toISOString(),
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
