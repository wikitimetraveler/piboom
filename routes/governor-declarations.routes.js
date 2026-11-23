/**
 * Governor / federal disaster declarations — /api/governor-declarations
 * Development work by David Lane
 */
import { Router } from 'express';
import * as ctrl from '../controllers/governor-declarations.controller.js';

const router = Router();

router.get('/', ctrl.listDeclarations);
router.post('/', ctrl.createDeclaration);
router.post('/sync', ctrl.syncFromOpenFema);
router.get('/:id', ctrl.getDeclaration);
router.patch('/:id', ctrl.updateDeclaration);
router.delete('/:id', ctrl.deleteDeclaration);

export default router;
