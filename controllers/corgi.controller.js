/**
 * Crouton Corgi Feeding Controller
 */

import corgiService from '../services/corgi.service.js';

export async function getStatus(req, res) {
  try {
    const status = await corgiService.getFeedingStatus();
    return res.json({
      success: true,
      ...status,
    });
  } catch (err) {
    console.error('Error getting Crouton feeding status:', err);
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to load Crouton feeding status.',
    });
  }
}

export async function recordFeed(req, res) {
  try {
    const result = await corgiService.addFeedEntry(req.body || {});
    return res.status(201).json({
      success: true,
      entry: result.entry,
      ...result.status,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      code: err.code || 'FEED_ERROR',
      error: err.message || 'Could not log feeding.',
      existingEntry: err.existingEntry || null,
      statusSummary: err.statusSummary || null,
    });
  }
}

export async function removeFeed(req, res) {
  try {
    const status = await corgiService.deleteFeedEntry(req.params.id);
    return res.json({
      success: true,
      ...status,
    });
  } catch (err) {
    const statusCode = err.statusCode || 500;
    return res.status(statusCode).json({
      success: false,
      error: err.message || 'Failed to delete entry.',
    });
  }
}

export default {
  getStatus,
  recordFeed,
  removeFeed,
};
