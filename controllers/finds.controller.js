import {
  listFinds,
  getFind,
  createFind,
  updateFind,
  deleteFind,
  appendVoiceNote,
  computeTreasureScore,
  ServiceUnavailableError,
  NotFoundError,
  ValidationError,
} from '../services/finds.service.js';
import { analyzeFindImages } from '../services/finds-ai.service.js';
import { buildFindSummaryText } from '../services/finds-voice.service.js';
import { getGoogleBrowserApiKey } from '../lib/google-api-key.js';

function getUserId(req) {
  return (req.query.userId || req.body.userId || '').toString().trim() || null;
}

function handleError(res, error) {
  if (error instanceof ServiceUnavailableError) {
    return res.status(503).json({ success: false, error: error.message });
  }
  if (error instanceof NotFoundError) {
    return res.status(404).json({ success: false, error: error.message });
  }
  if (error instanceof ValidationError) {
    return res.status(400).json({ success: false, error: error.message });
  }
  const code = error.statusCode || 500;
  console.error('Finds error:', error);
  return res.status(code).json({
    success: false,
    error: error.message || 'Request failed',
  });
}

/** Browser key for Maps / Places on the New Find page only. */
export async function getFindsGoogleMapsKeyHandler(req, res) {
  try {
    const apiKey = getGoogleBrowserApiKey();
    res.json({ success: true, apiKey: apiKey || null });
  } catch (error) {
    handleError(res, error);
  }
}

export async function listFindsHandler(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    const finds = await listFinds(userId, { limit: req.query.limit });
    res.json({ success: true, finds });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getFindHandler(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    const find = await getFind(userId, req.params.id);
    if (!find) {
      return res.status(404).json({ success: false, error: 'Find not found' });
    }
    res.json({ success: true, find });
  } catch (error) {
    handleError(res, error);
  }
}

export async function createFindHandler(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    const find = await createFind(userId, req.body);
    res.status(201).json({ success: true, find });
  } catch (error) {
    handleError(res, error);
  }
}

export async function updateFindHandler(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    const find = await updateFind(userId, req.params.id, { ...req.body, userId });
    res.json({ success: true, find });
  } catch (error) {
    handleError(res, error);
  }
}

export async function deleteFindHandler(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    const result = await deleteFind(userId, req.params.id);
    res.json({ success: true, ...result });
  } catch (error) {
    handleError(res, error);
  }
}

export async function analyzeFindHandler(req, res) {
  try {
    const { images, notes } = req.body;
    const { analysis } = await analyzeFindImages({ images, notes });
    res.json({ success: true, analysis });
  } catch (error) {
    handleError(res, error);
  }
}

/** Preview treasure score from a partial payload (no DB). */
export async function scorePreviewHandler(req, res) {
  try {
    const { score, scoreLabel } = computeTreasureScore(req.body.payload || {});
    res.json({ success: true, score, scoreLabel });
  } catch (error) {
    handleError(res, error);
  }
}

export async function appendVoiceNoteHandler(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    const { transcript, type, audioUrl } = req.body;
    if (!transcript || typeof transcript !== 'string') {
      return res.status(400).json({ success: false, error: 'transcript is required' });
    }
    const find = await appendVoiceNote(userId, req.params.id, { transcript, type, audioUrl });
    res.json({ success: true, find });
  } catch (error) {
    handleError(res, error);
  }
}

export async function getSummaryTextHandler(req, res) {
  try {
    const userId = getUserId(req);
    if (!userId) {
      return res.status(400).json({ success: false, error: 'userId is required' });
    }
    const find = await getFind(userId, req.params.id);
    if (!find) {
      return res.status(404).json({ success: false, error: 'Find not found' });
    }
    const text = buildFindSummaryText(find);
    res.json({ success: true, text });
  } catch (error) {
    handleError(res, error);
  }
}
