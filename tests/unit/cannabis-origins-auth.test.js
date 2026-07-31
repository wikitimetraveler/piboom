/**
 * Development work by David Lane
 */
import {
  verifyCannabisOriginsPassword,
  getConfiguredPassword,
  isCannabisOriginsConfigured,
  ENV_KEY,
  FALLBACK_ENV_KEY,
} from '../../lib/cannabis-origins-auth.js';

describe('cannabis-origins-auth', () => {
  const originalPrimary = process.env[ENV_KEY];
  const originalFallback = process.env[FALLBACK_ENV_KEY];

  afterEach(() => {
    if (originalPrimary === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = originalPrimary;
    }
    if (originalFallback === undefined) {
      delete process.env[FALLBACK_ENV_KEY];
    } else {
      process.env[FALLBACK_ENV_KEY] = originalFallback;
    }
  });

  test('isCannabisOriginsConfigured is false when both env unset', () => {
    delete process.env[ENV_KEY];
    delete process.env[FALLBACK_ENV_KEY];
    expect(isCannabisOriginsConfigured()).toBe(false);
    expect(getConfiguredPassword()).toBeNull();
  });

  test('falls back to COFFEE_DREAMS_PASSWORD when primary unset', () => {
    delete process.env[ENV_KEY];
    process.env[FALLBACK_ENV_KEY] = 'regular-pass';
    expect(isCannabisOriginsConfigured()).toBe(true);
    expect(getConfiguredPassword()).toBe('regular-pass');
    expect(verifyCannabisOriginsPassword('regular-pass')).toEqual({
      valid: true,
      reason: 'ok',
    });
  });

  test('prefers CANNABIS_ORIGINS_PASSWORD over coffee dreams password', () => {
    process.env[ENV_KEY] = 'dedicated-pass';
    process.env[FALLBACK_ENV_KEY] = 'regular-pass';
    expect(getConfiguredPassword()).toBe('dedicated-pass');
    expect(verifyCannabisOriginsPassword('dedicated-pass')).toEqual({
      valid: true,
      reason: 'ok',
    });
    expect(verifyCannabisOriginsPassword('regular-pass')).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });

  test('verifyCannabisOriginsPassword returns unconfigured when env missing', () => {
    delete process.env[ENV_KEY];
    delete process.env[FALLBACK_ENV_KEY];
    expect(verifyCannabisOriginsPassword('anything')).toEqual({
      valid: false,
      reason: 'unconfigured',
    });
  });

  test('verifyCannabisOriginsPassword accepts correct password', () => {
    process.env[ENV_KEY] = 'landrace-map';
    expect(verifyCannabisOriginsPassword('landrace-map')).toEqual({
      valid: true,
      reason: 'ok',
    });
  });

  test('verifyCannabisOriginsPassword rejects wrong password', () => {
    process.env[ENV_KEY] = 'landrace-map';
    expect(verifyCannabisOriginsPassword('wrong')).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });

  test('verifyCannabisOriginsPassword rejects wrong length without throwing', () => {
    process.env[ENV_KEY] = 'short';
    expect(verifyCannabisOriginsPassword('much-longer-password')).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });
});
