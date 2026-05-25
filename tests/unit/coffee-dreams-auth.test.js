/**
 * Development work by David Lane
 */
import {
  verifyCoffeeDreamsPassword,
  getConfiguredPassword,
  isCoffeeDreamsConfigured,
  ENV_KEY,
} from '../../lib/coffee-dreams-auth.js';

describe('coffee-dreams-auth', () => {
  const original = process.env[ENV_KEY];

  afterEach(() => {
    if (original === undefined) {
      delete process.env[ENV_KEY];
    } else {
      process.env[ENV_KEY] = original;
    }
  });

  test('isCoffeeDreamsConfigured is false when env unset', () => {
    delete process.env[ENV_KEY];
    expect(isCoffeeDreamsConfigured()).toBe(false);
    expect(getConfiguredPassword()).toBeNull();
  });

  test('isCoffeeDreamsConfigured is true when env set', () => {
    process.env[ENV_KEY] = 'saigon-night';
    expect(isCoffeeDreamsConfigured()).toBe(true);
    expect(getConfiguredPassword()).toBe('saigon-night');
  });

  test('verifyCoffeeDreamsPassword returns unconfigured when env missing', () => {
    delete process.env[ENV_KEY];
    expect(verifyCoffeeDreamsPassword('anything')).toEqual({
      valid: false,
      reason: 'unconfigured',
    });
  });

  test('verifyCoffeeDreamsPassword accepts correct password', () => {
    process.env[ENV_KEY] = 'condensed-milk';
    expect(verifyCoffeeDreamsPassword('condensed-milk')).toEqual({
      valid: true,
      reason: 'ok',
    });
  });

  test('verifyCoffeeDreamsPassword rejects wrong password', () => {
    process.env[ENV_KEY] = 'condensed-milk';
    expect(verifyCoffeeDreamsPassword('wrong')).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });

  test('verifyCoffeeDreamsPassword rejects wrong length without throwing', () => {
    process.env[ENV_KEY] = 'short';
    expect(verifyCoffeeDreamsPassword('much-longer-password')).toEqual({
      valid: false,
      reason: 'invalid',
    });
  });
});
