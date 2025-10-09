import fs from 'fs';
import path from 'path';
import { listFiles, playFile, stop, setVolume } from '../services/audio.service.js';
import { config } from '../config/index.js';

export const AudioController = {
  list: (_req, res) => {
    try { res.json(listFiles(config.musicDir)); }
    catch { res.json([]); }
  },

  play: (io) => (req, res) => {
    try {
      const state = playFile(config.musicDir, req.params.file, (err) => {
        if (err) {
          console.error('Audio playback ended with error:', err);
          io.emit('audio:status', { playing: false, file: null, error: err.message });
        } else {
          // Audio playback ended normally
          io.emit('audio:status', { playing: false, file: null });
        }
      });
      io.emit('audio:status', state);
      res.json({ ok: true, ...state });
    } catch (e) {
      console.error('Audio play error:', e);
      const statusCode = e.message === 'FILE_NOT_FOUND' ? 404 : 
                        e.message === 'AUDIO_PLAYBACK_FAILED' ? 500 : 500;
      res.status(statusCode).json({ ok: false, error: e.message });
    }
  },

  stop: (io) => (req, res) => {
    const state = stop();
    io.emit('audio:status', state);
    res.json({ ok: true, ...state });
  },

  volume: (io) => async (req, res) => {
    const state = await setVolume(req.params.level);
    io.emit('audio:volume', state);
    res.json({ ok: true, ...state });
  },

  stream: (req, res) => {
    const safe = path.basename(req.params.file);
    const full = path.join(config.musicDir, safe);
    if (!fs.existsSync(full)) return res.sendStatus(404);
    res.setHeader('Content-Type', 'audio/mpeg');
    fs.createReadStream(full).pipe(res);
  }
};