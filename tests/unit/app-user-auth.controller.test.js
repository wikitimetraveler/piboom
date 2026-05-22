import { jest } from '@jest/globals';

jest.unstable_mockModule('../../services/app-user-auth.service.js', () => ({
  verifyAppUserPassword: jest.fn(),
}));

const { verifyAppUserPassword } = await import('../../services/app-user-auth.service.js');
const { postLogout, postVerifyUserPassword } = await import(
  '../../controllers/app-user-auth.controller.js'
);

function mockRes() {
  const res = {
    statusCode: 200,
    body: null,
    headers: {},
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
    setHeader(name, value) {
      this.headers[name] = value;
    },
  };
  return res;
}

describe('app-user-auth.controller', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('postVerifyUserPassword sets finance session cookie when valid', async () => {
    verifyAppUserPassword.mockResolvedValue({ valid: true });
    const req = { body: { userId: 'easy-levi', password: 'x' } };
    const res = mockRes();
    await postVerifyUserPassword(req, res);
    expect(res.body).toEqual({ valid: true });
    expect(res.headers['Set-Cookie']).toMatch(/dc_finance_session=1/);
  });

  test('postVerifyUserPassword returns 503 when database unavailable', async () => {
    verifyAppUserPassword.mockResolvedValue({ valid: false, reason: 'unavailable' });
    const req = { body: { userId: 'easy-levi', password: 'x' } };
    const res = mockRes();
    await postVerifyUserPassword(req, res);
    expect(res.statusCode).toBe(503);
    expect(res.headers['Set-Cookie']).toBeUndefined();
  });

  test('postLogout clears finance session cookie', async () => {
    const res = mockRes();
    postLogout({}, res);
    expect(res.body).toEqual({ ok: true });
    expect(res.headers['Set-Cookie']).toMatch(/Max-Age=0/);
  });
});
