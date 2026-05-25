/**
 * Development work by David Lane
 */
import SampleDetectionService from '../services/sample-detection.service.js';

const sampleService = new SampleDetectionService();

/**
 * Find covers of a song
 */
export async function findCovers(req, res) {
  try {
    const { song, artist } = req.body;
    
    if (!song || !artist) {
      return res.status(400).json({
        success: false,
        message: 'Song and artist are required'
      });
    }
    
    const result = await sampleService.findCovers(song, artist);
    res.json(result);
    
  } catch (error) {
    console.error('Error finding covers:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Find samples of a song
 */
export async function findSamples(req, res) {
  try {
    const { song, artist } = req.body;
    
    if (!song || !artist) {
      return res.status(400).json({
        success: false,
        message: 'Song and artist are required'
      });
    }
    
    const result = await sampleService.findSamples(song, artist);
    res.json(result);
    
  } catch (error) {
    console.error('Error finding samples:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

/**
 * Get complete sample/cover network
 */
export async function getSampleNetwork(req, res) {
  try {
    const { song, artist } = req.body;
    
    if (!song || !artist) {
      return res.status(400).json({
        success: false,
        message: 'Song and artist are required'
      });
    }
    
    console.log(`🕸️ Getting complete network for: ${song} by ${artist}`);
    const result = await sampleService.getCompleteSampleNetwork(song, artist);
    
    res.json(result);
    
  } catch (error) {
    console.error('Error getting sample network:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
}

