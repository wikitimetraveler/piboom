import { AsyncLocalStorage } from 'async_hooks';
import axios from 'axios';

const DEFAULT_OAUTH_URL = 'https://api.elliemae.com/oauth2/v1/token';
const TOKEN_SKEW_MS = 60 * 1000; // refresh 1 min before actual expiry

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
    oauthUrl: process.env.ENCOMPASS_AUTH_URL || process.env.ENCOMPASS_OAUTH_URL || DEFAULT_OAUTH_URL,
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

  const response = await axios.post(config.oauthUrl, params.toString(), {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

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
