import { Router } from 'express';
import buildAudioRoutes from './audio.routes.js';
import voiceRoutes from './voice.routes.js';

export default function buildRoutes(io) {
  const api = Router();
  api.use('/audio', buildAudioRoutes(io));
  api.use('/voice', voiceRoutes);
  return api;
}