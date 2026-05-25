/**
 * Development work by David Lane
 */
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { run } from '../lib/exec.js';
import { config } from '../config/index.js';

class AudioFingerprintService {
  constructor() {
    // Shazam API (via RapidAPI) - 500/month FREE forever!
    this.shazamApiKey = config.shazamApiKey;
    this.isEnabled = !!this.shazamApiKey;
    
    console.log('🎵 Audio Fingerprint Service initialized:');
    console.log(`   Shazam API: ${this.isEnabled ? '✅ Enabled (500/month FREE)' : '❌ Disabled'}`);
  }

  /**
   * Record audio from microphone for song identification (Pi only)
   * @param {number} duration - Duration in seconds (default 10)
   * @returns {Promise<string>} - Path to recorded audio file
   */
  async recordAudioSample(duration = 10) {
    // Only works on Pi/Linux - Windows uses browser recording
    if (process.platform === 'win32') {
      throw new Error('Server-side recording not supported on Windows. Use browser recording instead.');
    }
    
    // Use OS temp directory (works on all platforms)
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `sample_${Date.now()}.wav`);
    
    try {
      // Record audio using arecord (ALSA) on Pi
      const args = [
        '-D', 'plughw:1,0',  // Default microphone
        '-f', 'S16_LE',      // 16-bit signed little-endian
        '-c', '1',           // Mono
        '-r', '44100',       // 44.1kHz sample rate
        '-d', duration.toString(),
        tempFile
      ];
      
      console.log(`📡 Recording ${duration} seconds of audio for song identification (Pi mode)...`);
      await run('arecord', args);
      
      if (fs.existsSync(tempFile)) {
        return tempFile;
      } else {
        throw new Error('Audio recording failed');
      }
    } catch (error) {
      console.error('Audio recording error:', error);
      throw error;
    }
  }

  /**
   * Identify song using Shazam API (RapidAPI)
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<Object>} - Song identification results
   */
  async identifyWithShazam(audioFilePath) {
    try {
      // Read audio file and convert to base64
      const audioBuffer = fs.readFileSync(audioFilePath);
      const base64Audio = audioBuffer.toString('base64');

      console.log('🎵 Sending audio to Shazam API for identification...');
      
      const response = await axios.post(
        'https://shazam.p.rapidapi.com/songs/v2/detect',
        base64Audio,
        {
          headers: {
            'content-type': 'text/plain',
            'X-RapidAPI-Key': this.shazamApiKey,
            'X-RapidAPI-Host': 'shazam.p.rapidapi.com'
          },
          timeout: 30000
        }
      );

      // Clean up temp file
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }

      return this.parseShazamResponse(response.data);
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }
      
      console.error('Shazam identification error:', error.message);
      throw error;
    }
  }

  /**
   * Identify song using Shazam API
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<Object>} - Song identification results
   */
  async identifySong(audioFilePath) {
    if (!this.isEnabled) {
      throw new Error('Shazam API not configured. Please add SHAZAM_API_KEY to .env file');
    }

    return await this.identifyWithShazam(audioFilePath);
  }

  /**
   * Parse Shazam API response into a clean format
   * @param {Object} data - Raw Shazam response
   * @returns {Object} - Parsed song information
   */
  parseShazamResponse(data) {
    if (!data || !data.track) {
      return {
        success: false,
        message: 'No music detected',
        code: 1001
      };
    }

    const track = data.track;
    
    return {
      success: true,
      song: {
        title: track.title || 'Unknown',
        artist: track.subtitle || 'Unknown Artist',
        album: track.sections?.[0]?.metadata?.find(m => m.title === 'Album')?.text || null,
        releaseDate: track.sections?.[0]?.metadata?.find(m => m.title === 'Released')?.text || null,
        duration: track.sections?.[0]?.metadata?.find(m => m.title === 'Duration')?.text || null,
        label: track.sections?.[0]?.metadata?.find(m => m.title === 'Label')?.text || null,
        genres: track.genres?.primary ? [track.genres.primary] : [],
        score: 95, // Shazam doesn't provide score, assume high confidence
        
        // External IDs
        spotify: track.hub?.providers?.find(p => p.type === 'SPOTIFY')?.actions?.[0]?.uri?.split(':').pop() || null,
        youtube: track.hub?.providers?.find(p => p.type === 'YOUTUBE')?.actions?.[0]?.uri || null,
        shazamId: track.key || null,
        isrc: track.isrc || null,
        
        // Album art - use high quality image
        albumArt: track.images?.coverarthq || track.images?.coverart || track.share?.image || null,
        
        // Confidence score (Shazam is very accurate when it finds a match)
        confidence: 95
      },
      
      // Shazam typically gives one confident result
      alternativeMatches: [],
      
      // Additional Shazam data
      shazamUrl: track.url || null,
      appleMusicUrl: track.hub?.options?.find(o => o.caption === 'OPEN IN')?.actions?.[0]?.uri || null
    };
  }


  /**
   * Full identification process: record audio and identify
   * @param {number} duration - Recording duration in seconds
   * @returns {Promise<Object>} - Song identification results
   */
  async identifyCurrentlyPlaying(duration = 10) {
    console.log('🎵 Starting song identification...');
    
    // Record audio sample
    const audioFile = await this.recordAudioSample(duration);
    
    // Identify the song
    const result = await this.identifySong(audioFile);
    
    return result;
  }

  /**
   * Identify song from uploaded audio buffer
   * @param {Buffer} audioBuffer - Audio data buffer
   * @returns {Promise<Object>} - Song identification results
   */
  async identifyFromBuffer(audioBuffer) {
    if (!this.isEnabled) {
      throw new Error('Shazam API not configured');
    }

    // Save buffer to temp file (cross-platform)
    const tempDir = os.tmpdir();
    const tempFile = path.join(tempDir, `upload_${Date.now()}.wav`);
    fs.writeFileSync(tempFile, audioBuffer);
    
    // Identify the song
    const result = await this.identifySong(tempFile);
    
    return result;
  }
}

export default AudioFingerprintService;

