/**
 * File transfer API — upload / list / download / delete docs & spreadsheets.
 * Development work by David Lane
 */
import {
  saveTransferFile,
  listTransferFiles,
  getTransferFile,
  deleteTransferFile,
  MAX_FILE_BYTES,
  ALLOWED_EXTENSIONS,
} from '../services/file-transfer.service.js';

function errorStatus(code) {
  if (code === 'FILE_REQUIRED' || code === 'FILE_TYPE_NOT_ALLOWED') return 400;
  if (code === 'FILE_TOO_LARGE') return 413;
  return 500;
}

function errorMessage(code) {
  switch (code) {
    case 'FILE_REQUIRED':
      return 'Choose a file to upload.';
    case 'FILE_TOO_LARGE':
      return `File exceeds ${Math.round(MAX_FILE_BYTES / (1024 * 1024))} MB limit.`;
    case 'FILE_TYPE_NOT_ALLOWED':
      return `Allowed types: ${[...ALLOWED_EXTENSIONS].join(', ')}`;
    default:
      return 'File transfer failed.';
  }
}

export async function uploadTransferFile(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Choose a file to upload.' });
    }
    const note = req.body?.note || '';
    const record = await saveTransferFile({
      buffer: req.file.buffer,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      note,
    });
    return res.status(201).json({ success: true, file: record });
  } catch (err) {
    const code = err?.code || 'UPLOAD_FAILED';
    return res.status(errorStatus(code)).json({
      success: false,
      error: errorMessage(code),
      code,
    });
  }
}

export async function listTransferFilesHandler(req, res) {
  try {
    const files = await listTransferFiles();
    return res.json({ success: true, files, count: files.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'List failed' });
  }
}

export async function downloadTransferFileHandler(req, res) {
  try {
    const result = await getTransferFile(req.params.id);
    if (!result) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    const { meta, buffer } = result;
    res.setHeader('Content-Type', meta.mimeType || 'application/octet-stream');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename*=UTF-8''${encodeURIComponent(meta.originalName)}`
    );
    res.setHeader('Content-Length', buffer.length);
    return res.send(buffer);
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Download failed' });
  }
}

export async function deleteTransferFileHandler(req, res) {
  try {
    const ok = await deleteTransferFile(req.params.id);
    if (!ok) {
      return res.status(404).json({ success: false, error: 'File not found' });
    }
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Delete failed' });
  }
}

export async function transferMetaHandler(req, res) {
  return res.json({
    success: true,
    maxFileBytes: MAX_FILE_BYTES,
    allowedExtensions: [...ALLOWED_EXTENSIONS],
  });
}
