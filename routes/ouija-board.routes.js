import express from 'express';
import { 
  askHoudini, 
  getHoudiniKnowledge, 
  getMysticalWisdom, 
  getOuijaBoardStatus 
} from '../controllers/ouija-board.controller.js';

const router = express.Router();

// Main Ouija Board communication endpoint
router.post('/', askHoudini);

// Get Houdini's knowledge base
router.get('/knowledge', getHoudiniKnowledge);

// Get random mystical wisdom
router.get('/wisdom', getMysticalWisdom);

// Get Ouija Board status
router.get('/status', getOuijaBoardStatus);

export default router;
