#!/usr/bin/env node
/**
 * Generate and optionally play/save today's US disaster briefing MP3 via Google TTS.
 *
 * Usage:
 *   node scripts/speak-disaster-briefing.mjs
 *   node scripts/speak-disaster-briefing.mjs --out data/disaster-briefing.mp3
 *   node scripts/speak-disaster-briefing.mjs --play
 *
 * Requires GOOGLE_APPLICATION_CREDENTIALS for Google Cloud TTS.
 */
import 'dotenv/config';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { buildDailyBriefing } from '../services/disaster-daily-briefing.service.js';
import VoiceService from '../services/voice.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function hasFlag(flag) {
  return process.argv.includes(flag);
}

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

function defaultOutPath(generatedAt) {
  const day = new Date(generatedAt).toISOString().slice(0, 10);
  return path.join(ROOT, 'data', `disaster-briefing-${day}.mp3`);
}

async function playMp3(filePath) {
  if (process.platform === 'win32') {
    spawn('powershell', ['-Command', `(New-Object Media.SoundPlayer "${filePath.replace(/'/g, "''")}").PlaySync()`], {
      stdio: 'inherit',
    });
    return;
  }
  spawn('mpg123', [filePath], { stdio: 'inherit' });
}

async function main() {
  const briefing = await buildDailyBriefing();
  process.stdout.write(`${briefing.spokenTitle}\n\n`);
  process.stdout.write(`${briefing.spokenScript}\n\n`);

  const voice = new VoiceService();
  await voice.init();
  const audioBase64 = await voice.speakWithGoogle(briefing.spokenScript, 'en-US-Standard-D');
  if (!audioBase64) {
    console.error('Google TTS unavailable. Set GOOGLE_APPLICATION_CREDENTIALS and retry.');
    process.exit(1);
  }

  const outPath = path.resolve(ROOT, argValue('--out') || defaultOutPath(briefing.generatedAt));
  await mkdir(path.dirname(outPath), { recursive: true });
  await writeFile(outPath, Buffer.from(audioBase64, 'base64'));
  process.stdout.write(`Saved MP3: ${outPath}\n`);

  if (hasFlag('--play')) {
    await playMp3(outPath);
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
