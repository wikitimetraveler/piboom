/**
 * Development work by David Lane
 */
import {
  verifyCoffeeDreamsPassword,
  getConfiguredPassword,
  isCoffeeDreamsConfigured,
  ENV_KEY,
  DEFAULT_PASSWORD,
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

  test('defaults to Wampus when env unset (no Render env required)', () => {
    delete process.env[ENV_KEY];
    expect(isCoffeeDreamsConfigured()).toBe(true);
    expect(getConfiguredPassword()).toBe(DEFAULT_PASSWORD);
    expect(DEFAULT_PASSWORD).toBe('Wampus');
  });

  test('env overrides the default password', () => {
    process.env[ENV_KEY] = 'saigon-night';
    expect(isCoffeeDreamsConfigured()).toBe(true);
    expect(getConfiguredPassword()).toBe('saigon-night');
  });

  test('verifyCoffeeDreamsPassword accepts default Wampus when env missing', () => {
    delete process.env[ENV_KEY];
    expect(verifyCoffeeDreamsPassword('Wampus')).toEqual({
      valid: true,
      reason: 'ok',
    });
  });

  test('verifyCoffeeDreamsPassword accepts correct env password', () => {
    process.env[ENV_KEY] = 'condensed-milk';
    expect(verifyCoffeeDreamsPassword('condensed-milk')).toEqual({
      valid: true,
      reason: 'ok',
    });
  });

  test('verifyCoffeeDreamsPassword rejects wrong password', () => {
    delete process.env[ENV_KEY];
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
