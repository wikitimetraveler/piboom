/**
 * Rose parlor HeyGen / speak demo API (disaster-briefing pattern).
 * Development work by David Lane
 */
import { Router } from 'express';
import {
  getRoseDemoPayload,
  ROSE_GOOGLE_VOICE,
} from '../services/rose-heygen.service.js';
import { heygenConfigured } from '../services/heygen.service.js';

const router = Router();

function resolveLang(req) {
  const candidate = req.query?.lang || req.headers['accept-language'];
  return String(candidate || 'en').toLowerCase().startsWith('vi') ? 'vi' : 'en';
}

/** Meet Rose catalog + spokenScript — same shape idea as disasters daily-briefing. */
router.get('/demo', (req, res) => {
  try {
    const lang = resolveLang(req);
    const data = getRoseDemoPayload({ lang });
    res.json({
      success: true,
      heygenConfigured: heygenConfigured(),
      googleVoice: ROSE_GOOGLE_VOICE[lang] || ROSE_GOOGLE_VOICE.en,
      data,
      ...data,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message || 'Rose demo failed' });
  }
});

/** Lightweight health for speak / streaming readiness. */
router.get('/health', (_req, res) => {
  const data = getRoseDemoPayload();
  res.json({
    ok: true,
    heygenConfigured: heygenConfigured(),
    avatarId: data.heygenAvatarId,
    voiceId: data.heygenVoiceId,
    videoReady: data.videoReady,
  });
});

export default router;
