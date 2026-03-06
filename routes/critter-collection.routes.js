import express from 'express';
import * as critterCollectionController from '../controllers/critter-collection.controller.js';

const router = express.Router();

router.post('/add', critterCollectionController.addToCollection);
router.get('/', critterCollectionController.getCollection);
router.get('/stats', critterCollectionController.getStats);
router.put('/:id', critterCollectionController.updateCritter);
router.delete('/:id', critterCollectionController.deleteCritter);

export default router;
