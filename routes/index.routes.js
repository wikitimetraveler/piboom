import { Router } from 'express';
import buildAudioRoutes from './audio.routes.js';
import voiceRoutes from './voice.routes.js';
import musicResearchRoutes from './music-research.routes.js';
import chatRoutes from './chat.routes.js';
import albumDiscoveryRoutes from './album-discovery.routes.js';

export default function buildRoutes(io) {
  const api = Router();
  api.use('/audio', buildAudioRoutes(io));
  api.use('/voice', voiceRoutes);
  api.use('/music-research', musicResearchRoutes);
  api.use('/chat', chatRoutes);
  api.use('/album-discovery', albumDiscoveryRoutes);
  return api;
}