/**
 * Bake pier walk + avatar PiP into one MP4 for a stop.
 *
 * Usage:
 *   node scripts/tools/composite-newport-pier-stop.mjs --stop first-bench
 *   node scripts/tools/composite-newport-pier-stop.mjs --stop first-bench --clip https://…/clip.webm
 *   node scripts/tools/composite-newport-pier-stop.mjs --stop first-bench --avatar-image https://…/preview.jpg
 */
import { compositeStopVideo } from '../../lib/newport-pier-composite.js';

function arg(flag, fallback = null) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return fallback;
  return process.argv[i + 1] ?? fallback;
}

const stopId = arg('--stop');
if (!stopId) {
  console.error(
    'Usage: node scripts/tools/composite-newport-pier-stop.mjs --stop <id> [--clip url] [--avatar-image url] [--duration 12]'
  );
  process.exit(1);
}

try {
  const result = await compositeStopVideo({
    stopId,
    clipUrl: arg('--clip'),
    avatarImageUrl: arg('--avatar-image'),
    durationSec: Number(arg('--duration', '12'))
  });
  console.log(`Wrote ${result.outputPath}`);
  console.log(`URL: ${result.videoUrl}`);
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
