import crypto from 'crypto';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { run } from '../lib/exec.js';
import { config } from '../config/index.js';

class AudioFingerprintService {
  constructor() {
    this.acrHost = config.acrcloudHost || 'identify-us-west-2.acrcloud.com';
    this.accessKey = config.acrcloudAccessKey;
    this.accessSecret = config.acrcloudAccessSecret;
    this.isEnabled = !!(this.accessKey && this.accessSecret);
  }

  /**
   * Record audio from microphone for song identification
   * @param {number} duration - Duration in seconds (default 10)
   * @returns {Promise<string>} - Path to recorded audio file
   */
  async recordAudioSample(duration = 10) {
    const tempFile = path.join('/tmp', `sample_${Date.now()}.wav`);
    
    try {
      // Record audio using arecord (ALSA)
      // 16-bit, 44.1kHz, mono - optimal for ACRCloud
      const args = [
        '-D', 'plughw:1,0',  // Default microphone
        '-f', 'S16_LE',      // 16-bit signed little-endian
        '-c', '1',           // Mono
        '-r', '44100',       // 44.1kHz sample rate
        '-d', duration.toString(),
        tempFile
      ];
      
      console.log(`Recording ${duration} seconds of audio for song identification...`);
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
   * Generate ACRCloud signature for authentication
   * @param {string} method - HTTP method
   * @param {string} uri - Request URI
   * @param {Buffer} dataBuffer - Audio data buffer
   * @returns {Object} - Headers for ACRCloud request
   */
  generateSignature(method, uri, dataBuffer) {
    const timestamp = Math.floor(Date.now() / 1000);
    const stringToSign = [method, uri, this.accessKey, 'audio', '1', timestamp].join('\n');
    
    const signature = crypto
      .createHmac('sha1', this.accessSecret)
      .update(Buffer.from(stringToSign, 'utf-8'))
      .digest()
      .toString('base64');

    return {
      access_key: this.accessKey,
      sample_bytes: dataBuffer.length,
      timestamp: timestamp,
      signature: signature,
      data_type: 'audio',
      signature_version: '1'
    };
  }

  /**
   * Identify song using ACRCloud API
   * @param {string} audioFilePath - Path to audio file
   * @returns {Promise<Object>} - Song identification results
   */
  async identifySong(audioFilePath) {
    if (!this.isEnabled) {
      throw new Error('ACRCloud API not configured. Please add ACRCLOUD_ACCESS_KEY and ACRCLOUD_ACCESS_SECRET to .env file');
    }

    try {
      // Read audio file
      const audioBuffer = fs.readFileSync(audioFilePath);
      
      // Generate signature
      const method = 'POST';
      const uri = '/v1/identify';
      const signatureData = this.generateSignature(method, uri, audioBuffer);

      // Prepare form data
      const FormData = (await import('form-data')).default;
      const form = new FormData();
      form.append('sample', audioBuffer, {
        filename: 'sample.wav',
        contentType: 'audio/wav'
      });
      form.append('access_key', signatureData.access_key);
      form.append('sample_bytes', signatureData.sample_bytes);
      form.append('timestamp', signatureData.timestamp);
      form.append('signature', signatureData.signature);
      form.append('data_type', signatureData.data_type);
      form.append('signature_version', signatureData.signature_version);

      // Make request to ACRCloud
      const url = `https://${this.acrHost}${uri}`;
      console.log('Sending audio to ACRCloud for identification...');
      
      const response = await axios.post(url, form, {
        headers: form.getHeaders(),
        timeout: 30000 // 30 second timeout
      });

      // Clean up temp file
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }

      return this.parseACRCloudResponse(response.data);
    } catch (error) {
      // Clean up temp file on error
      if (fs.existsSync(audioFilePath)) {
        fs.unlinkSync(audioFilePath);
      }
      
      console.error('ACRCloud identification error:', error.message);
      throw error;
    }
  }

  /**
   * Parse ACRCloud API response into a clean format
   * @param {Object} data - Raw ACRCloud response
   * @returns {Object} - Parsed song information
   */
  parseACRCloudResponse(data) {
    if (data.status.code !== 0) {
      return {
        success: false,
        message: data.status.msg || 'No music detected',
        code: data.status.code
      };
    }

    const metadata = data.metadata;
    
    if (!metadata || !metadata.music || metadata.music.length === 0) {
      return {
        success: false,
        message: 'No match found',
        code: 1001
      };
    }

    // Get the best match (first result)
    const music = metadata.music[0];
    
    return {
      success: true,
      song: {
        title: music.title,
        artist: music.artists?.map(a => a.name).join(', ') || 'Unknown Artist',
        album: music.album?.name || null,
        releaseDate: music.release_date || null,
        duration: music.duration_ms ? Math.floor(music.duration_ms / 1000) : null,
        label: music.label || null,
        genres: music.genres?.map(g => g.name) || [],
        score: music.score || 0,
        
        // External IDs
        spotify: music.external_metadata?.spotify?.track?.id || null,
        youtube: music.external_metadata?.youtube?.vid || null,
        deezer: music.external_metadata?.deezer?.track?.id || null,
        isrc: music.external_ids?.isrc || null,
        
        // Album art
        albumArt: music.album?.name ? 
          `https://e-cdns-images.dzcdn.net/images/cover/${music.external_metadata?.deezer?.album?.id || ''}/500x500-000000-80-0-0.jpg` :
          null,
        
        // Confidence score (0-100)
        confidence: music.score || 0
      },
      
      // Include all matches if there are multiple possibilities
      alternativeMatches: metadata.music.slice(1, 4).map(m => ({
        title: m.title,
        artist: m.artists?.map(a => a.name).join(', ') || 'Unknown',
        score: m.score || 0
      }))
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
      throw new Error('ACRCloud API not configured');
    }

    // Save buffer to temp file
    const tempFile = path.join('/tmp', `upload_${Date.now()}.wav`);
    fs.writeFileSync(tempFile, audioBuffer);
    
    // Identify the song
    const result = await this.identifySong(tempFile);
    
    return result;
  }
}

export default AudioFingerprintService;

