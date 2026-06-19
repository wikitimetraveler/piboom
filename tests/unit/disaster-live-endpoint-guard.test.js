/**
 * Development work by David Lane
 */
import {
  buildDisasterLiveCacheKey,
  checkDisasterLiveRateLimit,
  getDisasterLiveCache,
  resetDisasterLiveEndpointGuard,
  setDisasterLiveCache,
} from '../../lib/disaster-live-endpoint-guard.js';

describe('disaster-live-endpoint-guard', () => {
  beforeEach(() => {
    resetDisasterLiveEndpointGuard();
  });

  test('buildDisasterLiveCacheKey sorts params for stable keys', () => {
    expect(
      buildDisasterLiveCacheKey('daily-briefing', { includeFirms: true, days: 7 })
    ).toBe('daily-briefing?days=7&includeFirms=true');
  });

  test('caches and returns briefing payload until TTL expires', () => {
    const key = buildDisasterLiveCacheKey('daily-briefing', { days: 7 });
    const payload = { spokenTitle: 'Test briefing' };

    expect(getDisasterLiveCache('daily-briefing', key)).toBeNull();
    setDisasterLiveCache('daily-briefing', key, payload);
    expect(getDisasterLiveCache('daily-briefing', key)).toEqual(payload);
  });

  test('rate limit blocks after max requests in window', () => {
    const ip = '127.0.0.1';
    for (let i = 0; i < 8; i += 1) {
      expect(checkDisasterLiveRateLimit(ip, 'web-crawl').ok).toBe(true);
    }
    const blocked = checkDisasterLiveRateLimit(ip, 'web-crawl');
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBeGreaterThan(0);
  });
});
