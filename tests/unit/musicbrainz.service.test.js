import { describe, test, expect } from '@jest/globals';
import { MUSICBRAINZ_USER_AGENT, mbGet } from '../../services/musicbrainz.service.js';

describe('musicbrainz.service', () => {
  test('exports policy-compliant User-Agent', () => {
    expect(MUSICBRAINZ_USER_AGENT).toContain('DevConnectLabs');
    expect(MUSICBRAINZ_USER_AGENT).toContain('github.com');
    expect(MUSICBRAINZ_USER_AGENT.length).toBeGreaterThan(20);
  });

  test('exports mbGet', () => {
    expect(typeof mbGet).toBe('function');
  });
});
