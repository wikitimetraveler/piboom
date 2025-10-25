import { Router } from 'express';
import buildAudioRoutes from './audio.routes.js';
import voiceRoutes from './voice.routes.js';
import musicResearchRoutes from './music-research.routes.js';
import chatRoutes from './chat.routes.js';
import albumDiscoveryRoutes from './album-discovery.routes.js';
import treeDiscoveryRoutes from './tree-discovery.routes.js';
import treeCollectionRoutes from './tree-collection.routes.js';
import blacklightRoutes from './blacklight.routes.js';
import ouijaBoardRoutes from './ouija-board.routes.js';
import spotifyRoutes from './spotify.routes.js';
import collectionRoutes from './collection.routes.js';
import musicHistoryRoutes from './music-history.routes.js';
import posterGeneratorRoutes from './poster-generator.routes.js';
import voiceDjRoutes from './voice-dj.routes.js';
import genealogyRoutes from './genealogy.routes.js';
import audioFingerprintRoutes from './audio-fingerprint.routes.js';
import sampleDetectionRoutes from './sample-detection.routes.js';
import encompassAssistantRoutes from './encompass-assistant.routes.js';
import kmlRoutes from './kml.routes.js';

export default function buildRoutes(io) {
  const api = Router();
  api.use('/audio', buildAudioRoutes(io));
  api.use('/voice', voiceRoutes);
  api.use('/music-research', musicResearchRoutes);
  api.use('/chat', chatRoutes);
  api.use('/album-discovery', albumDiscoveryRoutes);
  api.use('/tree-discovery', treeDiscoveryRoutes);
  api.use('/tree-collection', treeCollectionRoutes);
  api.use('/blacklight', blacklightRoutes);
  api.use('/ouija-board', ouijaBoardRoutes);
  api.use('/spotify', spotifyRoutes);
  api.use('/collection', collectionRoutes);
  api.use('/genealogy', genealogyRoutes);
  api.use('/poster-generator', posterGeneratorRoutes);
  api.use('/voice-dj', voiceDjRoutes);
  api.use('/audio-fingerprint', audioFingerprintRoutes);
  api.use('/sample-detection', sampleDetectionRoutes);
  api.use('/encompass', encompassAssistantRoutes);
  api.use('/kml', kmlRoutes);
  api.use('/', musicHistoryRoutes); // Music history and concert finder
  return api;
}