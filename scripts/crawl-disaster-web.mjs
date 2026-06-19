#!/usr/bin/env node
/**
 * Run the allowlisted disaster web crawler and print JSON summary.
 *
 * Usage:
 *   npm run crawl:disasters
 *   node scripts/crawl-disaster-web.mjs --maxAgeHours 48
 *   node scripts/crawl-disaster-web.mjs --feed nws-active-atom,usgs-quakes-day-atom
 */
import { crawlDisasterWeb } from '../services/disaster-web-crawler.service.js';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

const maxAgeHours = Number.parseInt(argValue('--maxAgeHours') || '72', 10);
const feedArg = argValue('--feed');
const includeGdelt = process.argv.includes('--no-gdelt') ? false : true;
const feedIds = feedArg ? feedArg.split(',').map((s) => s.trim()).filter(Boolean) : undefined;

const data = await crawlDisasterWeb({
  maxAgeHours: Number.isFinite(maxAgeHours) ? maxAgeHours : 72,
  feedIds,
  includeGdelt,
});

process.stdout.write(
  JSON.stringify(
    {
      generatedAt: data.generatedAt,
      summary: data.summary,
      items: data.items.slice(0, 20),
    },
    null,
    2,
  ),
);
process.stdout.write('\n');
