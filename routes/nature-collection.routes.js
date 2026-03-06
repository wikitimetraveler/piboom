import express from 'express';
import * as natureCollectionController from '../controllers/nature-collection.controller.js';

const router = express.Router();

router.post('/share', natureCollectionController.createCollectionShare);
router.get('/share/:id', natureCollectionController.getCollectionShare);

export default router;
