/**
 * Schedule a callback once per day at a fixed local wall-clock time (DST-aware).
 */

function pacificOffsetMs(utcDate, timeZone) {
  const utc = Date.UTC(
    utcDate.getUTCFullYear(),
    utcDate.getUTCMonth(),
    utcDate.getUTCDate(),
    utcDate.getUTCHours(),
    utcDate.getUTCMinutes(),
    utcDate.getUTCSeconds(),
  );
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(utcDate);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  const localAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return localAsUtc - utc;
}

function localTimeToUtcMs({ timeZone, year, month, day, hour, minute }) {
  let guess = Date.UTC(year, month - 1, day, hour, minute, 0);
  for (let i = 0; i < 3; i++) {
    const offset = pacificOffsetMs(new Date(guess), timeZone);
    guess = Date.UTC(year, month - 1, day, hour, minute, 0) - offset;
  }
  return guess;
}

function localParts(date, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parseInt(parts.find((p) => p.type === type)?.value || '0', 10);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
  };
}

export function msUntilNextLocalTime({ timeZone, hour, minute = 0 }) {
  const now = Date.now();
  let { year, month, day, hour: h, minute: m, second: s } = localParts(new Date(now), timeZone);

  const pastTarget =
    h > hour || (h === hour && m > minute) || (h === hour && m === minute && s > 0);

  if (pastTarget) {
    const tomorrow = localParts(new Date(now + 86_400_000), timeZone);
    year = tomorrow.year;
    month = tomorrow.month;
    day = tomorrow.day;
  }

  const targetMs = localTimeToUtcMs({ timeZone, year, month, day, hour, minute });
  return Math.max(1000, targetMs - now);
}

/**
 * @param {{ timeZone: string, hour: number, minute?: number, label: string, run: () => Promise<void>|void }} opts
 */
export function scheduleDailyAt({ timeZone, hour, minute = 0, label, run }) {
  function arm() {
    const delay = msUntilNextLocalTime({ timeZone, hour, minute });
    const nextAt = new Date(Date.now() + delay).toISOString();
    console.log(`📅 ${label}: next run at ${nextAt} (${Math.round(delay / 60_000)} min)`);

    setTimeout(async () => {
      try {
        await run();
      } catch (err) {
        console.warn(`⚠️ ${label} failed (non-fatal)`, { error: err.message });
      }
      arm();
    }, delay);
  }

  arm();
}
