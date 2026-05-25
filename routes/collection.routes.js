/**
 * Development work by David Lane
 */
import express from 'express';
import {
  addToCollection,
  getCollection,
  getAlbumById,
  updateAlbum,
  deleteAlbum,
  getCollectionStats,
  getNextStorageSlot
} from '../controllers/collection.controller.js';

const router = express.Router();

// Add album to collection
router.post('/add', addToCollection);

// Get all albums in collection
router.get('/', getCollection);

// Get collection statistics
router.get('/stats', getCollectionStats);

// Next physical shelf slot for zone A–G (before /:id)
router.get('/storage/next-slot', getNextStorageSlot);

// Get single album by ID
router.get('/:id', getAlbumById);

// Update album in collection
router.patch('/:id', updateAlbum);

// Delete album from collection
router.delete('/:id', deleteAlbum);

export default router;

