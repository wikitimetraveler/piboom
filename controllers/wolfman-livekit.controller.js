/**
 * Development work by David Lane
 */
import { mintWolfmanLivekitToken, getWolfmanStatus } from '../services/wolfman-livekit.service.js';

export async function getWolfmanHealth(_req, res) {
  res.json(getWolfmanStatus());
}

export async function postWolfmanLivekitToken(req, res) {
  try {
    const minted = await mintWolfmanLivekitToken({
      identity: req.body?.identity,
      name: req.body?.name,
    });
    res.json({ ok: true, livekitConfigured: true, ...minted });
  } catch (error) {
    const status = error.code === 'LIVEKIT_NOT_CONFIGURED' ? 503 : 500;
    res.status(status).json({
      ok: false,
      error: error.code || error.message,
      livekitConfigured: false,
    });
  }
}

export default { getWolfmanHealth, postWolfmanLivekitToken };
