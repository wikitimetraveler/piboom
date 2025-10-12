import express from 'express';
import { identifyTreeFromImage, getTreeInfo } from '../controllers/tree-discovery.controller.js';

const router = express.Router();

// Identify tree from uploaded image
router.post('/identify-image', identifyTreeFromImage);

// Get detailed tree information from Smokey
router.post('/tree-info', getTreeInfo);

export default router;

