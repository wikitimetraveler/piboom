import { Router } from 'express';
import {
  saveTestExecution,
  getTestExecutions,
  getAllTestExecutions,
  deleteTestExecution,
} from '../controllers/unit-tests.controller.js';
import unitTestsAIController from '../controllers/unit-tests-ai.controller.js';

const router = Router();

/**
 * Unit Tests Routes
 * All routes prefixed with /api/unit-tests
 */

// Save or update test execution
router.post('/executions', saveTestExecution);

// Get test executions for a specific file
router.get('/executions', getTestExecutions);

// Get all test executions (for admin/reporting)
router.get('/executions/all', getAllTestExecutions);

// Delete test execution
router.delete('/executions/:id', deleteTestExecution);

// AI Assistant routes
router.use('/ai', unitTestsAIController);

export default router;
