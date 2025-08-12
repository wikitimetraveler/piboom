import { Router } from 'express';
import buildAudioRoutes from './audio.routes.js';

export default function buildRoutes(io) {
  const api = Router();
  api.use('/audio', buildAudioRoutes(io));
  return api;
}