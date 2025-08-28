import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import PlayerLib from 'play-sound';
import { run } from '../lib/exec.js';

let Player = null;
let currentProc = null;

// Pi mode only - use mpg123 for audio playback
Player = PlayerLib({ players: ['mpg123'] });

export function listFiles(musicDir) {
  if (!fs.existsSync(musicDir)) return [];
  return fs.readdirSync(musicDir)
    .filter(f => /\.(mp3|wav|flac)$/i.test(f))
    .sort();
}

export function playFile(musicDir, filename, onEnd) {
  const safe = path.basename(filename);
  const full = path.join(musicDir, safe);
  if (!fs.existsSync(full)) throw new Error('FILE_NOT_FOUND');

  // Pi mode: use mpg123 via play-sound
  stop();
  currentProc = Player.play(full, err => {
    currentProc = null;
    if (onEnd) onEnd(err);
  });
  return { playing: true, file: safe, mode: 'pi' };
}

export function stop() {
  if (currentProc) {
    try { currentProc.kill('SIGKILL'); } catch {}
    currentProc = null;
  }
  return { playing: false, mode: 'pi' };
}

export async function setVolume(percent) {
  const level = Math.max(0, Math.min(100, Number(percent) || 0));
  
  try {
    // Use amixer for volume control on Pi
    await run('amixer', ['sset', 'Master', `${level}%`]);
    console.log(`Volume set to ${level}%`);
  } catch (error) {
    console.log('Volume control not available:', error.message);
    // Fallback: try using pactl if amixer fails
    try {
      await run('pactl', ['set-sink-volume', '@DEFAULT_SINK@', `${level}%`]);
      console.log(`Volume set to ${level}% using pactl`);
    } catch (pactlError) {
      console.log('Pactl volume control also failed:', pactlError.message);
    }
  }
  
  return { level, mode: 'pi' };
}