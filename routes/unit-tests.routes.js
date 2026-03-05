import { Router } from 'express';
import multer from 'multer';
import {
  saveTestExecution,
  getTestExecutions,
  getAllTestExecutions,
  deleteTestExecution,
  uploadUnitTestFile,
  listUnitTestFilesHandler,
  getUnitTestFileHandler,
  searchUnitTestsByFieldId,
  deleteUnitTestFileHandler,
} from '../controllers/unit-tests.controller.js';
import unitTestsAIController from '../controllers/unit-tests-ai.controller.js';

const router = Router();

const unitTestFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.mimetype === 'application/octet-stream' ||
      /\.(xlsx|xls)$/i.test(file.originalname || '');
    cb(null, !!ok);
  },
});

/**
 * Unit Tests Routes
 * All routes prefixed with /api/unit-tests
 */

// Unit test file library (multer saves to req.file, controller persists server-side)
router.post('/files', (req, res, next) => {
  unitTestFileUpload.single('file')(req, res, (err) => {
    if (err) {
      return res.status(400).json({ error: err.message || 'Invalid file (use .xlsx or .xls)' });
    }
    next();
  });
}, uploadUnitTestFile);
router.get('/files', listUnitTestFilesHandler);
router.get('/files/:id', getUnitTestFileHandler);
router.delete('/files/:id', deleteUnitTestFileHandler);
router.get('/search', searchUnitTestsByFieldId);

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
