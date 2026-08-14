/**
 * Development work by David Lane
 */
import {
  verifyStudioListenPassword,
  getConfiguredPassword,
  ENV_KEY,
  DEFAULT_PASSWORD,
} from '../../lib/studio-auth.js';

describe('studio-auth', () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = original;
  });

  test('defaults to reel1 when env unset', () => {
    delete process.env[ENV_KEY];
    expect(getConfiguredPassword()).toBe(DEFAULT_PASSWORD);
    expect(DEFAULT_PASSWORD).toBe('reel1');
    expect(verifyStudioListenPassword('reel1')).toEqual({ valid: true, reason: 'ok' });
  });

  test('env overrides the default password', () => {
    process.env[ENV_KEY] = 'master-bus';
    expect(verifyStudioListenPassword('master-bus')).toEqual({ valid: true, reason: 'ok' });
    expect(verifyStudioListenPassword('reel1')).toEqual({ valid: false, reason: 'invalid' });
  });

  test('rejects empty password without throwing', () => {
    delete process.env[ENV_KEY];
    expect(verifyStudioListenPassword('')).toEqual({ valid: false, reason: 'invalid' });
  });
});
