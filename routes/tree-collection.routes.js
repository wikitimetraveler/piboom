/**
 * Development work by David Lane
 */
import express from 'express';
import * as treeCollectionController from '../controllers/tree-collection.controller.js';

const router = express.Router();

// Add tree to collection
router.post('/add', treeCollectionController.addToCollection);

// Get all trees in collection
router.get('/', treeCollectionController.getCollection);

// Get tree statistics
router.get('/stats', treeCollectionController.getStats);

// Update tree
router.put('/:id', treeCollectionController.updateTree);

// Delete tree
router.delete('/:id', treeCollectionController.deleteTree);

export default router;

