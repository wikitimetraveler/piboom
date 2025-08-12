import { Router } from 'express';
import { AudioController } from '../controllers/audio.controller.js';

export default function buildAudioRoutes(io) {
  const r = Router();
  r.get('/files', AudioController.list);
  r.post('/play/:file', AudioController.play(io));
  r.post('/stop', AudioController.stop(io));
  r.post('/volume/:level', AudioController.volume(io));
  r.get('/stream/:file', AudioController.stream);
  return r;
}