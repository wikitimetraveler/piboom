/**
 * Development work by David Lane
 */
/**
 * Unified Disasters dashboard — grid, map, ingest, AI, and selection cascade.
 * Loaded by public/finance/disasters-unified.html.
 */
import { jest } from '@jest/globals';
import { requireDisasterRefreshAccess, getBearerToken, isLocalDisasterRefreshRequest } from '../../lib/disaster-refresh-auth.js';

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('disaster-refresh-auth', () => {
  const originalToken = process.env.DISASTER_REFRESH_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.DISASTER_REFRESH_TOKEN;
    else process.env.DISASTER_REFRESH_TOKEN = originalToken;
  });

  describe('getBearerToken', () => {
    test('extracts bearer token from Authorization header', () => {
      expect(getBearerToken({ headers: { authorization: 'Bearer secret-token' } })).toBe('secret-token');
    });

    test('returns empty string when header missing or not bearer', () => {
      expect(getBearerToken({ headers: {} })).toBe('');
      expect(getBearerToken({ headers: { authorization: 'Basic abc' } })).toBe('');
    });
  });

  describe('requireDisasterRefreshAccess without configured token', () => {
    beforeEach(() => {
      delete process.env.DISASTER_REFRESH_TOKEN;
    });

    test('allows localhost', () => {
      const next = jest.fn();
      const req = { headers: {}, ip: '127.0.0.1' };
      const res = createRes();

      requireDisasterRefreshAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('allows localhost via x-forwarded-for', () => {
      const next = jest.fn();
      const req = { headers: { 'x-forwarded-for': '127.0.0.1, 10.0.0.1' }, ip: '10.0.0.0' };
      const res = createRes();

      requireDisasterRefreshAccess(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('returns 403 for non-localhost (Render production)', () => {
      const next = jest.fn();
      const req = { headers: { 'x-forwarded-for': '203.0.113.10' }, ip: '10.0.0.0' };
      const res = createRes();

      requireDisasterRefreshAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Refresh endpoints require localhost access or DISASTER_REFRESH_TOKEN',
      });
    });
  });

  describe('requireDisasterRefreshAccess with configured token', () => {
    beforeEach(() => {
      process.env.DISASTER_REFRESH_TOKEN = 'render-secret';
    });

    test('allows matching x-disaster-refresh-token from remote IP', () => {
      const next = jest.fn();
      const req = {
        headers: { 'x-disaster-refresh-token': 'render-secret', 'x-forwarded-for': '203.0.113.10' },
        ip: '10.0.0.0',
      };
      const res = createRes();

      requireDisasterRefreshAccess(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('allows matching Authorization Bearer from remote IP', () => {
      const next = jest.fn();
      const req = {
        headers: { authorization: 'Bearer render-secret', 'x-forwarded-for': '203.0.113.10' },
        ip: '10.0.0.0',
      };
      const res = createRes();

      requireDisasterRefreshAccess(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('returns 401 when token missing or wrong', () => {
      const next = jest.fn();
      const req = { headers: { 'x-forwarded-for': '203.0.113.10' }, ip: '10.0.0.0' };
      const res = createRes();

      requireDisasterRefreshAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized refresh token' });
    });

    test('returns 403 when x-user-role is not admin or ops', () => {
      const next = jest.fn();
      const req = {
        headers: {
          'x-disaster-refresh-token': 'render-secret',
          'x-user-role': 'viewer',
          'x-forwarded-for': '203.0.113.10',
        },
        ip: '10.0.0.0',
      };
      const res = createRes();

      requireDisasterRefreshAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient role for disaster refresh',
      });
    });
  });

  describe('isLocalDisasterRefreshRequest', () => {
    test('detects loopback addresses', () => {
      expect(isLocalDisasterRefreshRequest({ headers: {}, ip: '127.0.0.1' })).toBe(true);
      expect(isLocalDisasterRefreshRequest({ headers: {}, ip: '::1' })).toBe(true);
      expect(isLocalDisasterRefreshRequest({ headers: { 'x-forwarded-for': '203.0.113.1' }, ip: '10.0.0.1' })).toBe(false);
    });
  });
});
