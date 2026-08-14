/**
 * Development work by David Lane
 */
import {
  verifyWatchTogetherCode,
  verifyWatchTogetherAccess,
  getConfiguredCode,
  ENV_KEY,
  DEFAULT_CODE,
} from '../../lib/watch-together-auth.js';

describe('watch-together-auth', () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  test('defaults to couch when env unset', () => {
    delete process.env[ENV_KEY];
    expect(getConfiguredCode()).toBe(DEFAULT_CODE);
    expect(DEFAULT_CODE).toBe('couch');
  });

  test('env overrides the default code', () => {
    process.env[ENV_KEY] = 'karti';
    expect(getConfiguredCode()).toBe('karti');
  });

  test('verifyWatchTogetherCode accepts default couch when env missing', () => {
    delete process.env[ENV_KEY];
    expect(verifyWatchTogetherCode('couch')).toEqual({
      valid: true,
      reason: 'ok',
    });
  });

  test('verifyWatchTogetherCode rejects wrong code', () => {
    delete process.env[ENV_KEY];
    expect(verifyWatchTogetherCode('wrong')).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });

  test('verifyWatchTogetherAccess lets anyone enter without a code', () => {
    process.env[ENV_KEY] = 'karti';
    expect(verifyWatchTogetherAccess('')).toEqual({ valid: true, reason: 'open' });
    expect(verifyWatchTogetherAccess('couch')).toEqual({ valid: true, reason: 'open' });
    expect(verifyWatchTogetherAccess('karti')).toEqual({ valid: true, reason: 'open' });
  });
});
