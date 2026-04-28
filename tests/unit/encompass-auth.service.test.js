import { normalizeEncompassOAuthUrl } from '../../services/encompass-auth.service.js';

describe('encompass-auth normalizeEncompassOAuthUrl', () => {
  test('fixes spurious /v1 before /oauth2', () => {
    expect(
      normalizeEncompassOAuthUrl(
        'https://concept.api.elliemae.com/v1/oauth2/v1/token',
      ),
    ).toBe('https://concept.api.elliemae.com/oauth2/v1/token');
  });

  test('fixes rest path pasted into oauth url', () => {
    expect(
      normalizeEncompassOAuthUrl(
        'https://concept.api.elliemae.com/encompass/v1/oauth2/v1/token',
      ),
    ).toBe('https://concept.api.elliemae.com/oauth2/v1/token');
  });

  test('preserves canonical url', () => {
    expect(
      normalizeEncompassOAuthUrl(
        'https://concept.api.elliemae.com/oauth2/v1/token',
      ),
    ).toBe('https://concept.api.elliemae.com/oauth2/v1/token');
  });
});
