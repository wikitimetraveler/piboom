import axios from 'axios';

const DEFAULT_OAUTH_URL = 'https://api.elliemae.com/oauth2/v1/token';
const TOKEN_SKEW_MS = 60 * 1000; // refresh 1 min before actual expiry

let cachedToken = null;
let tokenExpiresAt = 0;
let inflightRequest = null;

const ENV_KEYS = {
  username: ['ENCOMPASS_USERNAME', 'username'],
  password: ['ENCOMPASS_PASSWORD', 'password'],
  clientId: ['ENCOMPASS_CLIENT_ID', 'clientId'],
  clientSecret: ['ENCOMPASS_CLIENT_SECRET', 'clientSecret'],
};

function readEnv(keys = []) {
  for (const key of keys) {
    const value = process.env[key];
    if (value) return value;
  }
  return undefined;
}

function collectEnvConfig() {
  return {
    username: readEnv(ENV_KEYS.username),
    password: readEnv(ENV_KEYS.password),
    clientId: readEnv(ENV_KEYS.clientId),
    clientSecret: readEnv(ENV_KEYS.clientSecret),
    oauthUrl: process.env.ENCOMPASS_OAUTH_URL || DEFAULT_OAUTH_URL,
  };
}

function validateConfig(config = collectEnvConfig()) {
  const missing = Object.entries(config)
    .filter(([key, value]) => !value && key !== 'oauthUrl')
    .map(([key]) => key);

  return {
    ok: missing.length === 0,
    missing,
    config,
  };
}

async function requestToken() {
  const { config, missing } = (() => {
    const result = validateConfig();
    if (!result.ok) {
      return { missing: result.missing };
    }
    return { config: result.config };
  })();

  if (missing && missing.length) {
    throw new Error(
      `Missing Encompass credentials: ${missing
        .map((key) => `process.env.${ENV_KEYS[key]?.[0] || key}`)
        .join(', ')}`,
    );
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

  cachedToken = response.data?.access_token || null;
  const expiresInSeconds = Number(response.data?.expires_in ?? 3600);
  tokenExpiresAt = Date.now() + expiresInSeconds * 1000;
  inflightRequest = null;
  return cachedToken;
}

export async function ensureEncompassToken() {
  const now = Date.now();
  if (cachedToken && now < tokenExpiresAt - TOKEN_SKEW_MS) {
    return cachedToken;
  }

  if (!inflightRequest) {
    inflightRequest = requestToken().catch((error) => {
      cachedToken = null;
      tokenExpiresAt = 0;
      inflightRequest = null;
      throw error;
    });
  }

  return inflightRequest;
}

export function getEncompassTokenStatus() {
  if (!cachedToken) {
    return {
      connected: false,
      expiresAt: null,
      secondsRemaining: 0,
    };
  }

  const secondsRemaining = Math.max(0, Math.floor((tokenExpiresAt - Date.now()) / 1000));
  return {
    connected: true,
    expiresAt: new Date(tokenExpiresAt).toISOString(),
    secondsRemaining,
  };
}

export function clearEncompassTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
  inflightRequest = null;
}

export function getEncompassEnvStatus() {
  return validateConfig();
}

