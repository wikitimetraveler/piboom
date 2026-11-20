/**
 * Disaster Policy Desk — /api/disaster-policy
 * Development work by David Lane
 */
import { Router } from 'express';
import * as ctrl from '../controllers/disaster-policy.controller.js';

const router = Router();

router.get('/events', ctrl.listEvents);
router.post('/events', ctrl.createEvent);
router.get('/fema/:disasterNumber/counties', ctrl.femaCounties);
router.get('/events/:id', ctrl.getEvent);
router.post('/events/:id/areas', ctrl.appendAreas);
router.patch('/events/:id/status', ctrl.patchStatus);
router.get('/events/:id/impacted-loans', ctrl.impactedLoans);

export default router;
