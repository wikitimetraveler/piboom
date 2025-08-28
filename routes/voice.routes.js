import express from 'express';
import {
  initVoice,
  startVoice,
  stopVoice,
  getVoiceStatus,
  toggleVoiceFeedback,
  speakText,
  getVoiceCommands,
  getLastVoiceCommand,
  processFrontendVoiceCommand
} from '../controllers/voice.controller.js';

const router = express.Router();

// Initialize voice service
router.post('/init', initVoice);

// Start voice recognition
router.post('/start', startVoice);

// Stop voice recognition
router.post('/stop', stopVoice);

// Get voice service status
router.get('/status', getVoiceStatus);

// Toggle voice feedback on/off
router.post('/feedback/toggle', toggleVoiceFeedback);

// Speak text
router.post('/speak', speakText);

// Get available voice commands
router.get('/commands', getVoiceCommands);

// Fallback: Get last voice command
router.get('/last-command', getLastVoiceCommand);

// Handle frontend voice commands (for Windows compatibility)
router.post('/frontend-command', processFrontendVoiceCommand);

export default router;
