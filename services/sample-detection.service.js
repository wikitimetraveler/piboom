/**
 * Development work by David Lane
 */
import { mbGet } from './musicbrainz.service.js';

class SampleDetectionService {
  /**
   * Search for a recording by name and artist
   * @param {string} songName - Song/track name
   * @param {string} artistName - Artist name
   * @returns {Promise<Object>} - Recording ID and info
   */
  async searchRecording(songName, artistName) {
    try {
      const query = `recording:"${songName}" AND artist:"${artistName}"`;

      const response = await mbGet('/recording', {
        query,
        limit: 5
      });

      if (response.data.recordings && response.data.recordings.length > 0) {
        const recording = response.data.recordings[0];
        return {
          id: recording.id,
          title: recording.title,
          artist: recording['artist-credit']?.[0]?.name || artistName,
          length: recording.length,
          score: recording.score
        };
      }

      return null;
    } catch (error) {
      console.error('Error searching recording:', error.message);
      throw error;
    }
  }

  /**
   * Get all relationships for a recording (samples, covers, etc.)
   * @param {string} recordingId - MusicBrainz recording ID
   * @returns {Promise<Object>} - Relationship data
   */
  async getRecordingRelationships(recordingId) {
    try {
      const response = await mbGet(`/recording/${recordingId}`, {
        inc: 'artist-credits+releases+recording-rels+work-rels'
      });

      return response.data;
    } catch (error) {
      console.error('Error getting recording relationships:', error.message);
      throw error;
    }
  }

  /**
   * Find covers of a song
   * @param {string} songName - Song name
   * @param {string} artistName - Original artist name
   * @returns {Promise<Array>} - Array of cover versions
   */
  async findCovers(songName, artistName) {
    try {
      console.log(`🔍 Searching for covers of "${songName}" by ${artistName}...`);
      
      // First, find the original recording
      const originalRecording = await this.searchRecording(songName, artistName);
      
      if (!originalRecording) {
        return {
          success: false,
          message: 'Original recording not found',
          covers: []
        };
      }

      // Search for cover versions
      const query = `recording:"${songName}" NOT artist:"${artistName}"`;

      const response = await mbGet('/recording', {
        query,
        limit: 50
      });

      const covers = response.data.recordings?.map(rec => ({
        title: rec.title,
        artist: rec['artist-credit']?.[0]?.name || 'Unknown Artist',
        length: rec.length ? this.formatDuration(rec.length) : null,
        year: rec['first-release-date']?.substring(0, 4) || null,
        id: rec.id,
        score: rec.score
      })) || [];

      return {
        success: true,
        original: {
          title: originalRecording.title,
          artist: originalRecording.artist,
          id: originalRecording.id
        },
        covers: covers.filter(c => c.artist !== artistName).slice(0, 30),
        count: covers.length
      };
    } catch (error) {
      console.error('Error finding covers:', error.message);
      return {
        success: false,
        message: error.message,
        covers: []
      };
    }
  }

  /**
   * Find samples of a song (who sampled it)
   * @param {string} songName - Song name
   * @param {string} artistName - Artist name
   * @returns {Promise<Object>} - Sample information
   */
  async findSamples(songName, artistName) {
    try {
      console.log(`🔍 Searching for samples of "${songName}" by ${artistName}...`);
      
      // Find the recording
      const recording = await this.searchRecording(songName, artistName);
      
      if (!recording) {
        return {
          success: false,
          message: 'Recording not found',
          sampledBy: [],
          samples: []
        };
      }

      // Get detailed relationship data
      const details = await this.getRecordingRelationships(recording.id);
      
      const sampledBy = [];
      const samples = [];

      // Parse relationships
      if (details.relations) {
        for (const relation of details.relations) {
          if (relation.type === 'samples material' && relation.direction === 'backward') {
            // This song was sampled by another
            sampledBy.push({
              type: 'sampled-by',
              targetTitle: relation.recording?.title || 'Unknown',
              targetArtist: relation.recording?.['artist-credit']?.[0]?.name || 'Unknown',
              targetId: relation.recording?.id || null
            });
          } else if (relation.type === 'samples material' && relation.direction === 'forward') {
            // This song samples another
            samples.push({
              type: 'samples',
              targetTitle: relation.recording?.title || 'Unknown',
              targetArtist: relation.recording?.['artist-credit']?.[0]?.name || 'Unknown',
              targetId: relation.recording?.id || null
            });
          }
        }
      }

      return {
        success: true,
        original: {
          title: recording.title,
          artist: recording.artist,
          id: recording.id
        },
        sampledBy: sampledBy,
        samples: samples,
        message: sampledBy.length === 0 && samples.length === 0 ? 
          'No sample relationships found in MusicBrainz database' : null
      };
    } catch (error) {
      console.error('Error finding samples:', error.message);
      return {
        success: false,
        message: error.message,
        sampledBy: [],
        samples: []
      };
    }
  }

  /**
   * Get comprehensive sample/cover network for a song
   * @param {string} songName - Song name
   * @param {string} artistName - Artist name
   * @returns {Promise<Object>} - Complete network data
   */
  async getCompleteSampleNetwork(songName, artistName) {
    try {
      console.log(`🕸️ Building complete sample/cover network for "${songName}"...`);
      
      // Run both searches in parallel
      const [coversResult, samplesResult] = await Promise.all([
        this.findCovers(songName, artistName),
        this.findSamples(songName, artistName)
      ]);

      return {
        success: true,
        original: {
          title: songName,
          artist: artistName
        },
        covers: coversResult.covers || [],
        coverCount: coversResult.covers?.length || 0,
        sampledBy: samplesResult.sampledBy || [],
        samples: samplesResult.samples || [],
        sampleCount: (samplesResult.sampledBy?.length || 0) + (samplesResult.samples?.length || 0),
        totalConnections: (coversResult.covers?.length || 0) + 
                         (samplesResult.sampledBy?.length || 0) + 
                         (samplesResult.samples?.length || 0)
      };
    } catch (error) {
      console.error('Error getting complete network:', error.message);
      return {
        success: false,
        message: error.message,
        covers: [],
        sampledBy: [],
        samples: []
      };
    }
  }

  /**
   * Format duration from milliseconds to mm:ss
   */
  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

}

export default SampleDetectionService;

