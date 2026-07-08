#!/usr/bin/env node
/**
 * Local Newport Pier HyperFrame reel — narration (Google TTS) + hyperframes render + publish.
 * No HeyGen API. Requires ffmpeg for HyperFrames render.
 *
 * Usage:
 *   node scripts/tools/render-newport-pier-reel-local.mjs
 *   node scripts/tools/render-newport-pier-reel-local.mjs --skip-narration
 */
import 'dotenv/config';
import { runReelRenderPipeline } from '../../services/newport-pier-reel.service.js';

const skipNarration = process.argv.includes('--skip-narration');

try {
  const result = await runReelRenderPipeline({
    skipNarration,
    onProgress: ({ phase, message }) => {
      if (message) console.log(`[${phase}] ${message}`);
    }
  });
  console.log(`\nDone → ${result.videoUrl}`);
  if (result.narrationSkipped) {
    console.log('(Narration was skipped — reel uses existing assets/narration MP3s if present.)');
  }
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
