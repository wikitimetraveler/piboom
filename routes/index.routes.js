import { Router } from 'express';
import buildAudioRoutes from './audio.routes.js';
import voiceRoutes from './voice.routes.js';
import musicResearchRoutes from './music-research.routes.js';

export default function buildRoutes(io) {
  const api = Router();
  api.use('/audio', buildAudioRoutes(io));
  api.use('/voice', voiceRoutes);
  api.use('/music-research', musicResearchRoutes);
  return api;
}