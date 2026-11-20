/**
 * File transfer routes — /api/file-transfer
 * Development work by David Lane
 */
import { Router } from 'express';
import multer from 'multer';
import {
  uploadTransferFile,
  listTransferFilesHandler,
  downloadTransferFileHandler,
  deleteTransferFileHandler,
  transferMetaHandler,
} from '../controllers/file-transfer.controller.js';
import {
  MAX_FILE_BYTES,
  isAllowedUpload,
} from '../services/file-transfer.service.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_BYTES },
  fileFilter: (req, file, cb) => {
    if (isAllowedUpload(file.originalname, file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('FILE_TYPE_NOT_ALLOWED'));
  },
});

router.get('/meta', transferMetaHandler);
router.get('/files', listTransferFilesHandler);
router.get('/files/:id', downloadTransferFileHandler);
router.delete('/files/:id', deleteTransferFileHandler);
router.post('/files', (req, res, next) => {
  upload.single('file')(req, res, (err) => {
    if (err) {
      const code = err.code === 'LIMIT_FILE_SIZE' ? 'FILE_TOO_LARGE' : err.message;
      const status = code === 'FILE_TOO_LARGE' || err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
      const message =
        code === 'FILE_TOO_LARGE' || err.code === 'LIMIT_FILE_SIZE'
          ? `File exceeds ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB limit.`
          : code === 'FILE_TYPE_NOT_ALLOWED'
            ? 'That file type is not allowed. Use docs, spreadsheets, or zip.'
            : err.message || 'Upload failed';
      return res.status(status).json({ success: false, error: message, code });
    }
    next();
  });
}, uploadTransferFile);

export default router;
