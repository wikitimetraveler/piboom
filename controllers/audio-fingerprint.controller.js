/**
 * Development work by David Lane
 */
import AudioFingerprintService from '../services/audio-fingerprint.service.js';

const fingerprintService = new AudioFingerprintService();

/**
 * Identify currently playing song from microphone
 */
export async function identifyCurrentSong(req, res) {
  try {
    const { duration = 10 } = req.body;
    
    // Check if service is enabled
    if (!fingerprintService.isEnabled) {
      return res.status(503).json({
        success: false,
        message: 'Shazam API not configured. Please add SHAZAM_API_KEY to .env file.',
        configured: false
      });
    }
    
    // Check platform - server-side recording only works on Pi
    if (process.platform === 'win32') {
      return res.status(400).json({
        success: false,
        message: 'Server-side recording not supported on Windows. Use browser microphone recording instead.',
        useBrowserRecording: true
      });
    }
    
    // Start identification (Pi mode)
    console.log('🎵 Identifying song from microphone (Pi mode)...');
    const result = await fingerprintService.identifyCurrentlyPlaying(duration);
    
    if (result.success) {
      // Emit result via Socket.IO for real-time updates
      if (req.app.locals.io) {
        req.app.locals.io.emit('songIdentified', result);
      }
      
      res.json(result);
    } else {
      res.json({
        success: false,
        message: result.message || 'Could not identify the song',
        code: result.code
      });
    }
  } catch (error) {
    console.error('Song identification error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'IDENTIFICATION_FAILED'
    });
  }
}

/**
 * Identify song from uploaded audio file
 */
export async function identifyFromUpload(req, res) {
  try {
    if (!req.file && !req.body.audio) {
      return res.status(400).json({
        success: false,
        message: 'No audio file provided'
      });
    }
    
    // Check if service is enabled
    if (!fingerprintService.isEnabled) {
      return res.status(503).json({
        success: false,
        message: 'Shazam API not configured',
        configured: false
      });
    }
    
    // Get audio buffer from upload or base64
    let audioBuffer;
    if (req.file) {
      audioBuffer = req.file.buffer;
    } else if (req.body.audio) {
      // Base64 encoded audio
      audioBuffer = Buffer.from(req.body.audio, 'base64');
    }
    
    console.log('🎵 Identifying song from uploaded audio...');
    const result = await fingerprintService.identifyFromBuffer(audioBuffer);
    
    if (result.success) {
      // Emit result via Socket.IO
      if (req.app.locals.io) {
        req.app.locals.io.emit('songIdentified', result);
      }
      
      res.json(result);
    } else {
      res.json({
        success: false,
        message: result.message || 'Could not identify the song',
        code: result.code
      });
    }
  } catch (error) {
    console.error('Upload identification error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'IDENTIFICATION_FAILED'
    });
  }
}

/**
 * Get service status
 */
export function getServiceStatus(req, res) {
  res.json({
    success: true,
    configured: fingerprintService.isEnabled,
    available: fingerprintService.isEnabled,
    provider: 'Shazam API',
    message: fingerprintService.isEnabled ? 
      'Audio fingerprinting service is ready (Shazam - 500/month free)' : 
      'Audio fingerprinting not configured. Add SHAZAM_API_KEY to .env'
  });
}

/**
 * Test endpoint - record audio and return file info
 */
export async function testRecording(req, res) {
  try {
    const { duration = 5 } = req.body;
    
    console.log('🎤 Testing audio recording...');
    const audioFile = await fingerprintService.recordAudioSample(duration);
    
    res.json({
      success: true,
      message: 'Audio recorded successfully',
      file: audioFile,
      duration: duration
    });
  } catch (error) {
    console.error('Recording test error:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: 'RECORDING_FAILED'
    });
  }
}

