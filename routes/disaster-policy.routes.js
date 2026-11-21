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
router.patch('/events/:id', ctrl.updateEvent);
router.delete('/events/:id', ctrl.deleteEvent);
router.post('/events/:id/areas', ctrl.appendAreas);
router.delete('/events/:id/areas/:areaId', ctrl.deleteArea);
router.patch('/events/:id/status', ctrl.patchStatus);
router.get('/events/:id/impacted-loans', ctrl.impactedLoans);

export default router;
