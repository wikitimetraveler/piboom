/**
 * Development work by David Lane
 */
import { AsyncLocalStorage } from 'async_hooks';
import axios from 'axios';

const DEFAULT_OAUTH_URL = 'https://concept.api.elliemae.com/oauth2/v1/token';
const TOKEN_SKEW_MS = 60 * 1000; // refresh 1 min before actual expiry

/**
 * ICE OAuth token URL is always `{host}/oauth2/v1/token`.
 * Common .env mistakes append REST path segments, e.g.
 * `.../encompass/v1/oauth2/v1/token` or `.../v1/oauth2/v1/token`.
 */
export function normalizeEncompassOAuthUrl(url) {
  if (!url || typeof url !== 'string') return url;
  const trimmed = url.trim();
  try {
    const u = new URL(trimmed);
    const p = u.pathname.replace(/\/+$/, '') || '';
    let fixed = trimmed;
    // Wrong: .../v1/oauth2/v1/token
    if (p === '/v1/oauth2/v1/token' || /\/v1\/oauth2\/v1\/token$/i.test(p)) {
      u.pathname = '/oauth2/v1/token';
      fixed = u.toString();
    } else if (/^\/encompass\/v\d+/i.test(p) && /oauth2/i.test(p)) {
      // Wrong: .../encompass/v1/.../oauth2/...
      u.pathname = '/oauth2/v1/token';
      fixed = u.toString();
    }
    return fixed;
  } catch {
    return trimmed;
  }
}

/** Request-scoped Encompass env (correspondent | retail). Set by routes middleware. */
export const encompassEnvStorage = new AsyncLocalStorage();

const ENV_KEYS_CORRESPONDENT = {
  username: ['ENCOMPASS_USERNAME'],
  password: ['ENCOMPASS_PASSWORD'],
  clientId: ['ENCOMPASS_CLIENT_ID'],
  clientSecret: ['ENCOMPASS_CLIENT_SECRET'],
};

const ENV_KEYS_RETAIL = {
  username: ['ENCOMPASS_RETAIL_USERNAME'],
  password: ['ENCOMPASS_RETAIL_PASSWORD'],
  clientId: ['ENCOMPASS_RETAIL_CLIENT_ID'],
  clientSecret: ['ENCOMPASS_RETAIL_CLIENT_SECRET'],
};

const TOKEN_CACHES = {
  correspondent: { token: null, expiresAt: 0, inflight: null },
  retail: { token: null, expiresAt: 0, inflight: null },
};

function readEnv(keys = []) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

function getEnvKeys(env) {
  return env === 'retail' ? ENV_KEYS_RETAIL : ENV_KEYS_CORRESPONDENT;
}

function collectEnvConfig(env = 'correspondent') {
  const keys = getEnvKeys(env);
  return {
    username: readEnv(keys.username),
    password: readEnv(keys.password),
    clientId: readEnv(keys.clientId),
    clientSecret: readEnv(keys.clientSecret),
    oauthUrl: normalizeEncompassOAuthUrl(
      process.env.ENCOMPASS_AUTH_URL ||
        process.env.ENCOMPASS_OAUTH_URL ||
        DEFAULT_OAUTH_URL,
    ),
  };
}

function validateConfig(config) {
  const missing = Object.entries(config)
    .filter(([key, value]) => !value && key !== 'oauthUrl')
    .map(([key]) => key);

  return {
    ok: missing.length === 0,
    missing,
    config,
  };
}

async function requestToken(env) {
  const config = collectEnvConfig(env);
  const { ok, missing } = validateConfig(config);
  if (!ok) {
    const keyNames = missing.map((k) => getEnvKeys(env)[k]?.[0] || k).join(', ');
    throw new Error(`Missing Encompass credentials (${env}): ${keyNames}`);
  }

  const params = new URLSearchParams({
    grant_type: 'password',
    username: config.username,
    password: config.password,
    client_id: config.clientId,
    client_secret: config.clientSecret,
  });

  let response;
  try {
    response = await axios.post(config.oauthUrl, params.toString(), {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response) {
      const status = err.response.status;
      const data = err.response.data;
      let detail = '';
      if (typeof data === 'string' && data.trim()) {
        detail = ` — ${data.trim().slice(0, 300)}`;
      } else if (data && typeof data === 'object') {
        const line =
          data.error_description ||
          data.error ||
          data.message ||
          (Object.keys(data).length ? JSON.stringify(data) : '');
        if (line) detail = ` — ${String(line).slice(0, 300)}`;
      }
      const msg = `OAuth token request failed (HTTP ${status})${detail}`;
      /** @type {Error & { upstreamStatus?: number }} */
      const error = new Error(msg);
      error.upstreamStatus = status;
      throw error;
    }
    throw err;
  }

  const token = response.data?.access_token || null;
  const expiresInSeconds = Number(response.data?.expires_in ?? 3600);
  const cache = TOKEN_CACHES[env] || TOKEN_CACHES.correspondent;
  cache.token = token;
  cache.expiresAt = Date.now() + expiresInSeconds * 1000;
  cache.inflight = null;
  return token;
}

function getCache(env) {
  const key = env === 'retail' ? 'retail' : 'correspondent';
  return TOKEN_CACHES[key];
}

export async function ensureEncompassToken(envOverride) {
  const env = envOverride ?? encompassEnvStorage.getStore()?.env ?? 'correspondent';
  const cache = getCache(env);

  const now = Date.now();
  if (cache.token && now < cache.expiresAt - TOKEN_SKEW_MS) {
    return cache.token;
  }

  if (!cache.inflight) {
    cache.inflight = requestToken(env).catch((error) => {
      cache.token = null;
      cache.expiresAt = 0;
      cache.inflight = null;
      throw error;
    });
  }

  return cache.inflight;
}

export function getEncompassTokenStatus(envOverride) {
  const env = envOverride ?? encompassEnvStorage.getStore()?.env ?? 'correspondent';
  const cache = getCache(env);

  if (!cache.token) {
    return {
      connected: false,
      expiresAt: null,
      secondsRemaining: 0,
    };
  }

  const secondsRemaining = Math.max(0, Math.floor((cache.expiresAt - Date.now()) / 1000));
  return {
    connected: true,
    expiresAt: new Date(cache.expiresAt).toISOString(),
    secondsRemaining,
  };
}

export function clearEncompassTokenCache(envOverride) {
  if (envOverride) {
    const cache = getCache(envOverride);
    cache.token = null;
    cache.expiresAt = 0;
    cache.inflight = null;
  } else {
    Object.values(TOKEN_CACHES).forEach((c) => {
      c.token = null;
      c.expiresAt = 0;
      c.inflight = null;
    });
  }
}

/** Validate config for default (correspondent) env. Used by getEncompassEnvStatus. */
export function getEncompassEnvStatus(envOverride) {
  const env = envOverride ?? encompassEnvStorage.getStore()?.env ?? 'correspondent';
  const config = collectEnvConfig(env);
  return validateConfig(config);
}
