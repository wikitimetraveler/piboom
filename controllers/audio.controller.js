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
      const state = playFile(config.musicDir, req.params.file, () => {
        io.emit('audio:status', { playing: false, file: null });
      });
      io.emit('audio:status', state);
      res.json({ ok: true, ...state });
    } catch (e) {
      res.status(e.message === 'FILE_NOT_FOUND' ? 404 : 500).json({ ok:false, error:e.message });
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