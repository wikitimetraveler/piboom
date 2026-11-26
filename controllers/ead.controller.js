/**
 * FHA EAD 3.6 appraisal ZIP parse API.
 * Development work by David Lane
 */
import {
  parseEadAppraisalZip,
  getEadSessionAsset,
  listEadSamples,
  parseEadSample,
  MAX_ZIP_BYTES,
  UAD_IMAGE_CATEGORIES,
} from '../services/ead-appraisal.service.js';
import {
  chatEadExpert,
  EXPERT_TITLE,
  APPRAISAL_SKILLS,
  UNDERWRITING_SKILLS,
} from '../services/ead-assistant.service.js';

export async function parseEadZip(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Choose a UAD 3.6 appraisal .zip file to upload.',
        code: 'ZIP_REQUIRED',
      });
    }
    const result = await parseEadAppraisalZip(req.file.buffer, {
      originalName: req.file.originalname,
    });
    return res.json({
      success: true,
      maxBytes: MAX_ZIP_BYTES,
      ...result,
    });
  } catch (err) {
    const code = err?.code || 'PARSE_FAILED';
    const status = code === 'ZIP_TOO_LARGE' ? 413 : code === 'ZIP_REQUIRED' ? 400 : 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to parse appraisal ZIP',
      code,
    });
  }
}

export async function getEadAsset(req, res) {
  try {
    const { sessionId, name } = req.params;
    const asset = await getEadSessionAsset(sessionId, decodeURIComponent(name || ''));
    if (!asset) {
      return res.status(404).json({ success: false, error: 'Asset not found or session expired.' });
    }
    res.setHeader('Content-Type', asset.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${asset.fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    return res.send(asset.buffer);
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to read asset',
    });
  }
}

export function eadMeta(_req, res) {
  return res.json({
    success: true,
    maxBytes: MAX_ZIP_BYTES,
    maxMb: Math.round(MAX_ZIP_BYTES / (1024 * 1024)),
    accept: ['.zip'],
    documentTypes: ['AppraisalReport', 'ValuationUpdate', 'ValuationCompletion'],
    imageCategories: UAD_IMAGE_CATEGORIES,
    expertTitle: EXPERT_TITLE,
    appraisalSkills: APPRAISAL_SKILLS,
    underwritingSkills: UNDERWRITING_SKILLS,
  });
}

export async function listEadSamplesHandler(_req, res) {
  try {
    const catalog = await listEadSamples();
    return res.json({
      success: true,
      available: catalog.available,
      samples: catalog.samples,
      source:
        'GSE Appendix D-1 — place nested *_Appraisal.zip files in fixtures/ead/appendix-d-1/ (see docs/EAD.md)',
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      error: err.message || 'Failed to list samples',
    });
  }
}

export async function chatEadExpertHandler(req, res) {
  try {
    const message = req.body?.message;
    if (!message || !String(message).trim()) {
      return res.status(400).json({ success: false, error: 'Message is required' });
    }
    const result = await chatEadExpert({
      message,
      history: Array.isArray(req.body?.history) ? req.body.history : [],
      package: req.body?.package || null,
      userId: req.body?.userId || req.headers['x-user-id'] || 'ead-guest',
      sessionId: req.body?.sessionId || 'ead-desk',
    });
    return res.json({
      success: true,
      reply: result.reply,
      title: result.title || EXPERT_TITLE,
    });
  } catch (err) {
    const status = err?.code === 'OPENAI_NOT_CONFIGURED' ? 503 : 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Expert chat failed',
      code: err.code || 'CHAT_FAILED',
    });
  }
}

export async function parseEadSampleHandler(req, res) {
  try {
    const id = req.params.id || req.body?.id;
    const result = await parseEadSample(id);
    return res.json({
      success: true,
      maxBytes: MAX_ZIP_BYTES,
      ...result,
    });
  } catch (err) {
    const code = err?.code || 'PARSE_FAILED';
    const status =
      code === 'SAMPLE_NOT_FOUND' || code === 'SAMPLE_REQUIRED'
        ? 404
        : code === 'ZIP_TOO_LARGE'
          ? 413
          : 500;
    return res.status(status).json({
      success: false,
      error: err.message || 'Failed to parse sample',
      code,
    });
  }
}
