/**
 * FHA EAD 3.6 appraisal routes — /api/ead
 * Development work by David Lane
 */
import { Router } from 'express';
import multer from 'multer';
import {
  parseEadZip,
  getEadAsset,
  eadMeta,
  listEadSamplesHandler,
  parseEadSampleHandler,
} from '../controllers/ead.controller.js';
import { MAX_ZIP_BYTES } from '../services/ead-appraisal.service.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_ZIP_BYTES, files: 1 },
  fileFilter: (req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    if (name.endsWith('.zip')) {
      cb(null, true);
      return;
    }
    cb(new Error('ZIP_REQUIRED'));
  },
});

router.get('/meta', eadMeta);
router.get('/samples', listEadSamplesHandler);
router.post('/samples/:id/parse', parseEadSampleHandler);
router.get('/assets/:sessionId/:name', getEadAsset);
router.post('/parse', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const tooLarge = err.code === 'LIMIT_FILE_SIZE';
      const status = tooLarge ? 413 : 400;
      const message = tooLarge
        ? `ZIP exceeds ${Math.round(MAX_ZIP_BYTES / (1024 * 1024))} MB limit.`
        : err.message === 'ZIP_REQUIRED'
          ? 'Upload a single .zip appraisal package.'
          : err.message || 'Upload failed';
      return res.status(status).json({
        success: false,
        error: message,
        code: tooLarge ? 'ZIP_TOO_LARGE' : 'ZIP_REQUIRED',
      });
    }
    next();
  });
}, parseEadZip);

export default router;
