/**
 * Development work by David Lane
 */
import {
  heygenConfigured,
  listAvatars,
  listVoices,
  createAvatarVideo,
  getVideoStatus,
  generateSpeech,
  createHeygenStreamingSession,
  speakHeygenStreamingSession,
  stopHeygenStreamingSession
} from '../services/heygen.service.js';
import {
  getSchemaWalkthrough,
  getSchemaDemoShort,
  getDisasterBriefingPayload
} from '../services/disaster-heygen.service.js';
import {
  getHeygenVideoLibrary,
  registerHeygenApiVideo
} from '../services/heygen-library.service.js';

function handleHeygenError(res, e, fallback) {
  if (e.code === 'HEYGEN_NOT_CONFIGURED') {
    return res.status(503).json({ success: false, error: 'HeyGen is not configured (set HEYGEN_API_KEY)' });
  }
  const status = e.status && e.status >= 400 && e.status < 600 ? e.status : 500;
  res.status(status).json({ success: false, error: e.message || fallback });
}

export function getHeygenHealth(req, res) {
  res.json({ success: true, configured: heygenConfigured() });
}

export async function getHeygenAvatars(req, res) {
  try {
    res.json({ success: true, avatars: await listAvatars() });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to list avatars');
  }
}

export async function getHeygenVoices(req, res) {
  try {
    const language = String(req.query?.language || '').trim() || undefined;
    const maxPages = Math.min(12, Math.max(1, Number(req.query?.maxPages) || 2));
    res.json({ success: true, voices: await listVoices({ language, maxPages }) });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to list voices');
  }
}

/** Starfish TTS — reuse avatar voice_id for audio-only Pip / booth lines */
export async function postHeygenSpeech(req, res) {
  try {
    const { text, voiceId, speed, language } = req.body || {};
    if (!text || !String(text).trim()) {
      return res.status(400).json({ success: false, error: 'text is required' });
    }
    if (!voiceId) {
      return res.status(400).json({ success: false, error: 'voiceId is required' });
    }
    const data = await generateSpeech({ text, voiceId, speed, language });
    res.json({
      success: true,
      audioUrl: data.audio_url,
      duration: data.duration,
      requestId: data.request_id || null
    });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to generate speech');
  }
}

export async function postHeygenVideo(req, res) {
  try {
    const {
      avatarId,
      script,
      voiceId,
      title,
      resolution,
      aspectRatio,
      callbackUrl,
      libraryId,
      libraryDomain,
      outputFormat,
      removeBackground,
      background,
      motionPrompt,
      expressiveness
    } = req.body || {};
    if (!avatarId || !script) {
      return res.status(400).json({ success: false, error: 'avatarId and script are required' });
    }
    const data = await createAvatarVideo({
      avatarId,
      script,
      voiceId,
      title,
      resolution,
      aspectRatio,
      callbackUrl,
      outputFormat,
      removeBackground,
      background,
      motionPrompt,
      expressiveness
    });
    const videoId = data?.video_id;
    const regId =
      libraryId ||
      `disasters-${videoId || Date.now()}-${String(title || 'video')
        .slice(0, 24)
        .replace(/\W+/g, '-')
        .toLowerCase()}`;
    if (videoId) {
      const studioPage =
        req.body?.libraryStudioPage ||
        (libraryDomain === 'nature'
          ? '/nature/newport-pier.html'
          : '/finance/disasters-unified.html#duHeygenStudio');
      await registerHeygenApiVideo({
        id: regId,
        videoId,
        title: title || 'HeyGen video',
        domain: libraryDomain || 'disasters',
        variant: 'generated',
        script: String(script).slice(0, 500),
        sourcePage: libraryDomain === 'nature' ? '/nature/newport-pier.html' : '/heygen-hub.html',
        studioPage
      });
    }
    res.json({ success: true, videoId, libraryId: regId, data });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to create video');
  }
}

export async function getHeygenVideoStatus(req, res) {
  try {
    const data = await getVideoStatus(req.params.videoId);
    res.json({ success: true, status: data?.status, videoUrl: data?.video_url || null, data });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to fetch video status');
  }
}

/** All HeyGen videos on this site — Lane lines, disaster demos, API registry. */
export async function getHeygenLibrary(req, res) {
  try {
    const domain = req.query.domain ? String(req.query.domain) : undefined;
    const kind = req.query.kind ? String(req.query.kind) : undefined;
    res.json({ success: true, ...(await getHeygenVideoLibrary({ domain, kind })) });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to load HeyGen library');
  }
}

/** Pre-written Unified Disasters schema walkthrough script (see docs/UNIFIED_DISASTERS_DB_SCHEMA_VIDEO_SCRIPT.md). */
export function getHeygenSchemaScript(req, res) {
  res.json({ success: true, ...getSchemaWalkthrough() });
}

/** ~25s shirt / booth popup script for Unified Disasters. */
export function getHeygenDemoScript(req, res) {
  res.json({ success: true, ...getSchemaDemoShort() });
}

/**
 * Preview or render a spoken briefing for a selected disaster row.
 * POST body: { disaster, loanCount?, cameraCount?, radiusMiles?, avatarId?, voiceId?, render?: boolean }
 * When render is true and avatarId is set, starts HeyGen video generation.
 */
export async function postHeygenDisasterBriefing(req, res) {
  try {
    const { disaster, loanCount, cameraCount, radiusMiles, avatarId, voiceId, render, aspectRatio } =
      req.body || {};
    if (!disaster || typeof disaster !== 'object') {
      return res.status(400).json({ success: false, error: 'disaster object is required' });
    }
    const payload = getDisasterBriefingPayload(disaster, { loanCount, cameraCount, radiusMiles });
    if (!render) {
      return res.json({ success: true, preview: true, ...payload });
    }
    if (!avatarId) {
      return res.status(400).json({ success: false, error: 'avatarId is required when render is true' });
    }
    const data = await createAvatarVideo({
      avatarId,
      voiceId,
      script: payload.script,
      title: payload.title,
      aspectRatio: aspectRatio || payload.aspectRatio
    });
    const videoId = data?.video_id;
    const disasterTitle = payload.title || disaster.title || 'Disaster briefing';
    const regId = `disasters-briefing-${videoId || Date.now()}`;
    if (videoId) {
      await registerHeygenApiVideo({
        id: regId,
        videoId,
        title: disasterTitle,
        domain: 'disasters',
        variant: 'briefing',
        script: payload.script,
        sourcePage: '/heygen-hub.html',
        studioPage: '/finance/disasters-unified.html#duHeygenStudio',
        tags: ['briefing']
      });
    }
    res.json({ success: true, preview: false, videoId, libraryId: regId, ...payload, data });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to create disaster briefing video');
  }
}

export async function postHeygenStreamingStart(req, res) {
  try {
    const session = await createHeygenStreamingSession({
      avatarId: req.body?.avatarId,
      voiceId: req.body?.voiceId,
      text: req.body?.text
    });
    res.json({ success: true, ok: true, ...session });
  } catch (e) {
    if (e.code === 'HEYGEN_STREAMING_AVATAR_REQUIRED' || e.code === 'HEYGEN_STREAMING_VOICE_REQUIRED') {
      return res.status(503).json({ success: false, error: e.message, code: e.code });
    }
    handleHeygenError(res, e, 'Failed to start HeyGen streaming avatar');
  }
}

export async function postHeygenStreamingSpeak(req, res) {
  try {
    const sessionId = req.body?.sessionId;
    const text = req.body?.text;
    const result = await speakHeygenStreamingSession(sessionId, text, {
      avatarId: req.body?.avatarId,
      voiceId: req.body?.voiceId
    });
    if (result?.session) {
      return res.json({ success: true, ok: true, recreated: true, ...result.session, data: result.data });
    }
    res.json({ success: true, ok: true, data: result?.data ?? result });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to speak on streaming avatar');
  }
}

export async function postHeygenStreamingStop(req, res) {
  try {
    const data = await stopHeygenStreamingSession(req.body?.sessionId);
    res.json({ success: true, ok: true, data });
  } catch (e) {
    handleHeygenError(res, e, 'Failed to stop streaming avatar');
  }
}
