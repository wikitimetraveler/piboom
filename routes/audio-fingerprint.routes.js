/**
 * Development work by David Lane
 */
import express from 'express';
import {
  identifyCurrentSong,
  identifyFromUpload,
  getServiceStatus,
  testRecording
} from '../controllers/audio-fingerprint.controller.js';

const router = express.Router();

// Get service status
router.get('/status', getServiceStatus);

// Identify currently playing song from microphone
router.post('/identify', identifyCurrentSong);

// Identify song from uploaded audio file
router.post('/identify/upload', identifyFromUpload);

// Test audio recording
router.post('/test/record', testRecording);

export default router;

