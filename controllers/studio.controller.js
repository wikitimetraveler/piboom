/**
 * Browser Studio HTTP API
 * Development work by David Lane
 */
import fs from 'node:fs';
import {
  getStudioStatus,
  createSession,
  getSession,
  mintLivekitToken,
  addRelease,
  listReleases,
  getRelease,
  resolveReleaseFile,
  sanitizeDisplayName,
  normalizeReelCode,
  startStudioAudioEgress,
  stopStudioAudioEgress,
} from '../services/studio.service.js';
import { getRoomSnapshot } from '../services/studio-socket.service.js';
import { verifyStudioListenPassword } from '../lib/studio-auth.js';
import studioAssistantService from '../services/studio-assistant.service.js';

function listenUnlocked(req) {
  return req.headers['x-studio-listen'] === '1' || req.body?.listenUnlocked === true;
}

export async function getHealth(_req, res) {
  res.json(getStudioStatus());
}

export async function postSession(req, res) {
  try {
    const session = await createSession({ title: req.body?.title });
    res.json({ ok: true, session });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function getSessionByCode(req, res) {
  try {
    const session = await getSession(req.params.code);
    if (!session) return res.status(404).json({ ok: false, error: 'REEL_NOT_FOUND' });
    const presence = getRoomSnapshot(session.code);
    res.json({ ok: true, session, presence });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function postLivekitToken(req, res) {
  try {
    const reelCode = normalizeReelCode(req.body?.reelCode || req.body?.code);
    const name = sanitizeDisplayName(req.body?.name);
    const canPublish = req.body?.canPublish !== false;
    const minted = await mintLivekitToken({
      reelCode,
      identity: req.body?.identity,
      name,
      canPublish,
      inviteVoice: req.body?.inviteVoice === true,
    });
    res.json({ ok: true, ...minted });
  } catch (error) {
    const status = error.code === 'LIVEKIT_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({
      ok: false,
      error: error.code || error.message,
      livekitConfigured: false,
    });
  }
}

export async function postStudioAudioEgress(req, res) {
  try {
    const reelCode = normalizeReelCode(req.body?.reelCode || req.body?.code);
    const started = await startStudioAudioEgress(reelCode);
    res.json({ ok: true, ...started });
  } catch (error) {
    const status = error.code === 'LIVEKIT_NOT_CONFIGURED'
      ? 503
      : error.code === 'LIVEKIT_EGRESS_DEST_REQUIRED'
        ? 400
        : 500;
    res.status(status).json({ ok: false, error: error.code || error.message });
  }
}

export async function postStudioAudioEgressStop(req, res) {
  try {
    const stopped = await stopStudioAudioEgress(req.body?.egressId);
    res.json({ ok: true, ...stopped });
  } catch (error) {
    const status = error.code === 'LIVEKIT_NOT_CONFIGURED' ? 503 : 400;
    res.status(status).json({ ok: false, error: error.code || error.message });
  }
}

export async function postListenUnlock(req, res) {
  const result = verifyStudioListenPassword(req.body?.password);
  if (!result.valid) {
    return res.status(401).json({ ok: false, valid: false });
  }
  res.json({ ok: true, valid: true });
}

export async function postRelease(req, res) {
  try {
    const file = req.file;
    if (!file?.buffer) {
      return res.status(400).json({ ok: false, error: 'AUDIO_REQUIRED' });
    }
    const release = await addRelease({
      title: req.body?.title,
      artist: req.body?.artist,
      reelCode: req.body?.reelCode,
      originalName: file.originalname,
      buffer: file.buffer,
      mimeType: file.mimetype,
    });
    res.json({ ok: true, release });
  } catch (error) {
    const status = error.code === 'AUDIO_REQUIRED' ? 400 : 500;
    res.status(status).json({ ok: false, error: error.message });
  }
}

export async function getReleases(req, res) {
  if (!listenUnlocked(req)) {
    return res.status(401).json({ ok: false, error: 'LISTEN_LOCKED' });
  }
  try {
    const releases = await listReleases();
    res.json({
      ok: true,
      releases: releases.map((item) => ({
        id: item.id,
        title: item.title,
        artist: item.artist,
        reelCode: item.reelCode,
        bytes: item.bytes,
        createdAt: item.createdAt,
        audioUrl: `/api/studio/releases/${item.id}/audio`,
      })),
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function getReleaseAudio(req, res) {
  if (!listenUnlocked(req)) {
    return res.status(401).json({ ok: false, error: 'LISTEN_LOCKED' });
  }
  try {
    const release = await getRelease(req.params.id);
    if (!release) return res.status(404).json({ ok: false, error: 'NOT_FOUND' });
    const filePath = await resolveReleaseFile(release);
    if (!filePath) return res.status(404).json({ ok: false, error: 'FILE_MISSING' });
    res.setHeader('Content-Type', release.mimeType || 'audio/wav');
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
}

export async function postEngineerChat(req, res) {
  try {
    const message = String(req.body?.message || '').trim();
    if (!message) return res.status(400).json({ error: 'Message is required' });
    const context = Array.isArray(req.body?.context) ? req.body.context : [];
    const history = context.map((turn) => ({
      role: turn.role || (turn.isUser ? 'user' : 'assistant'),
      content: turn.content || turn.text || '',
    }));
    const result = await studioAssistantService.chatWithReed({
      message,
      history,
      userId: String(req.body?.userId || req.headers['x-user-id'] || 'studio-anon').slice(0, 100),
      sessionId: String(req.body?.sessionId || 'studio-reed').slice(0, 255),
    });
    res.json({
      success: true,
      response: result.reply,
      reply: result.reply,
      guideName: result.guideName,
      source: result.source,
    });
  } catch (error) {
    res.status(500).json({ error: error.message || 'Chat failed' });
  }
}

export default {
  getHealth,
  postSession,
  getSessionByCode,
  postLivekitToken,
  postListenUnlock,
  postRelease,
  getReleases,
  getReleaseAudio,
  postEngineerChat,
  postStudioAudioEgress,
  postStudioAudioEgressStop,
};
