/**
 * Development work by David Lane
 *
 * Access gate for POST /api/encompass-assistant/scrape.
 */
import { jest } from '@jest/globals';
import {
  requireEncompassDocsScrapeAccess,
  getBearerToken,
  isLocalEncompassDocsRefreshRequest,
} from '../../lib/encompass-docs-refresh-auth.js';

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('encompass-docs-refresh-auth', () => {
  const originalToken = process.env.ENCOMPASS_DOCS_SCRAPE_TOKEN;

  afterEach(() => {
    if (originalToken === undefined) delete process.env.ENCOMPASS_DOCS_SCRAPE_TOKEN;
    else process.env.ENCOMPASS_DOCS_SCRAPE_TOKEN = originalToken;
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

  describe('without configured token', () => {
    beforeEach(() => {
      delete process.env.ENCOMPASS_DOCS_SCRAPE_TOKEN;
    });

    test('allows localhost', () => {
      const next = jest.fn();
      const req = { headers: {}, ip: '127.0.0.1' };
      const res = createRes();

      requireEncompassDocsScrapeAccess(req, res, next);

      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });

    test('returns 403 for non-localhost (hosted)', () => {
      const next = jest.fn();
      const req = { headers: { 'x-forwarded-for': '203.0.113.10' }, ip: '10.0.0.0' };
      const res = createRes();

      requireEncompassDocsScrapeAccess(req, res, next);

      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Scrape endpoint requires localhost access or ENCOMPASS_DOCS_SCRAPE_TOKEN',
      });
    });
  });

  describe('with configured token', () => {
    beforeEach(() => {
      process.env.ENCOMPASS_DOCS_SCRAPE_TOKEN = 'render-secret';
    });

    test('allows matching x-encompass-docs-scrape-token from remote IP', () => {
      const next = jest.fn();
      const req = {
        headers: { 'x-encompass-docs-scrape-token': 'render-secret', 'x-forwarded-for': '203.0.113.10' },
        ip: '10.0.0.0',
      };
      const res = createRes();

      requireEncompassDocsScrapeAccess(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('allows matching Authorization Bearer from remote IP', () => {
      const next = jest.fn();
      const req = {
        headers: { authorization: 'Bearer render-secret', 'x-forwarded-for': '203.0.113.10' },
        ip: '10.0.0.0',
      };
      const res = createRes();

      requireEncompassDocsScrapeAccess(req, res, next);

      expect(next).toHaveBeenCalled();
    });

    test('returns 401 when token missing or wrong', () => {
      const next = jest.fn();
      const req = { headers: { 'x-forwarded-for': '203.0.113.10' }, ip: '10.0.0.0' };
      const res = createRes();

      requireEncompassDocsScrapeAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Unauthorized scrape token' });
    });

    test('returns 403 when x-user-role is not admin or ops', () => {
      const next = jest.fn();
      const req = {
        headers: {
          'x-encompass-docs-scrape-token': 'render-secret',
          'x-user-role': 'viewer',
          'x-forwarded-for': '203.0.113.10',
        },
        ip: '10.0.0.0',
      };
      const res = createRes();

      requireEncompassDocsScrapeAccess(req, res, next);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: 'Insufficient role for docs scrape',
      });
    });
  });

  describe('isLocalEncompassDocsRefreshRequest', () => {
    test('detects loopback addresses', () => {
      expect(isLocalEncompassDocsRefreshRequest({ headers: {}, ip: '127.0.0.1' })).toBe(true);
      expect(isLocalEncompassDocsRefreshRequest({ headers: {}, ip: '::1' })).toBe(true);
      expect(isLocalEncompassDocsRefreshRequest({ headers: { 'x-forwarded-for': '203.0.113.1' }, ip: '10.0.0.1' })).toBe(false);
    });
  });
});
