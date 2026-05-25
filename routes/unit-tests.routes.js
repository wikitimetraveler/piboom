/**
 * Development work by David Lane
 */
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
  uploadBrRuleFileHandler,
  saveBrRuleJsonHandler,
  listBrRuleFilesHandler,
  getBrRuleFileHandler,
  searchBrRulesByFieldIdHandler,
  deleteBrRuleFileHandler,
} from '../controllers/unit-tests.controller.js';
import unitTestsAIController from '../controllers/unit-tests-ai.controller.js';

const router = Router();

const unitTestFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ok =
      file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
      file.mimetype === 'application/octet-stream' ||
      /\.xlsx$/i.test(file.originalname || '');
    cb(null, !!ok);
  },
});

const brRuleFileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 3 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const name = (file.originalname || '').toLowerCase();
    const ok =
      /\.(xml|json|txt)$/i.test(name) ||
      [
        'text/xml',
        'application/xml',
        'application/json',
        'text/plain',
        'application/octet-stream',
      ].includes(file.mimetype || '');
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
      return res.status(400).json({ error: err.message || 'Invalid file (use .xlsx)' });
    }
    next();
  });
}, uploadUnitTestFile);
router.get('/files', listUnitTestFilesHandler);
router.get('/files/:id', getUnitTestFileHandler);
router.delete('/files/:id', deleteUnitTestFileHandler);
router.get('/search', searchUnitTestsByFieldId);

// Business rules / Tool 8 (Alchemist) JSON library (Postgres body_text)
router.get('/br-rules/search', searchBrRulesByFieldIdHandler);
router.get('/br-rules', listBrRuleFilesHandler);
router.post(
  '/br-rules/file',
  (req, res, next) => {
    brRuleFileUpload.single('file')(req, res, (err) => {
      if (err) {
        return res.status(400).json({ error: err.message || 'Invalid file (.xml, .json, .txt)' });
      }
      next();
    });
  },
  uploadBrRuleFileHandler,
);
router.post('/br-rules', saveBrRuleJsonHandler);
router.get('/br-rules/:id', getBrRuleFileHandler);
router.delete('/br-rules/:id', deleteBrRuleFileHandler);

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
