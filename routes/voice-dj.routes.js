/**
 * Development work by David Lane
 */
import express from 'express';
import { processVoiceCommand } from '../controllers/voice-dj.controller.js';

const router = express.Router();

// Process voice DJ command
router.post('/process', processVoiceCommand);

export default router;

