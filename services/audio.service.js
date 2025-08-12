import fs from 'fs';
import path from 'path';
import { config } from '../config/index.js';
import PlayerLib from 'play-sound';
import { run } from '../lib/exec.js';

let Player = null;
let currentProc = null;

if (config.mode === 'pi') {
  Player = PlayerLib({ players: ['mpg123'] });
}

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

  if (config.mode === 'cloud') {
    // Let the browser stream; server doesn't play audio in cloud mode.
    return { playing: true, file: safe, mode: 'cloud' };
  }

  // Pi mode: use mpg123 via play-sound
  stop();
  currentProc = Player.play(full, err => {
    currentProc = null;
    if (onEnd) onEnd(err);
  });
  return { playing: true, file: safe, mode: 'pi' };
}

export function stop() {
  if (config.mode === 'cloud') return { playing: false, mode: 'cloud' };
  if (currentProc) {
    try { currentProc.kill('SIGKILL'); } catch {}
    currentProc = null;
  }
  return { playing: false, mode: 'pi' };
}

export async function setVolume(percent) {
  const level = Math.max(0, Math.min(100, Number(percent) || 0));
  if (config.mode === 'cloud') return { level, mode: 'cloud' };
  
  // Check if we're on Windows
  const isWindows = process.platform === 'win32';
  
  try {
    if (isWindows) {
      // On Windows, we can't easily control system volume from Node.js
      // The browser handles volume control in cloud mode anyway
      console.log('System volume control not available on Windows (using browser volume)');
    } else {
      // Linux/Unix systems can use amixer
      await run('amixer', ['sset', 'Master', `${level}%`]);
    }
  } catch (error) {
    console.log('Volume control not available:', error.message);
  }
  
  return { level, mode: config.mode };
}