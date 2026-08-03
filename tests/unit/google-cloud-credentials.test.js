/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';
import fs from 'fs';
import os from 'os';
import path from 'path';

describe('resolveGoogleClientOptions', () => {
  const originalEnv = { ...process.env };
  let tempKey;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    delete process.env.GOOGLE_CREDENTIALS_JSON;
    delete process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
    delete process.env.GOOGLE_CLOUD_CREDENTIALS_JSON;
    delete process.env.GOOGLE_APPLICATION_CREDENTIALS;
    delete process.env.GOOGLE_CLOUD_PROJECT;
    delete process.env.GOOGLE_CLOUD_PROJECT_ID;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    if (tempKey && fs.existsSync(tempKey)) {
      fs.unlinkSync(tempKey);
      tempKey = null;
    }
  });

  test('uses inline GOOGLE_CREDENTIALS_JSON and clears a bad file path', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/google-credentials.json';
    process.env.GOOGLE_CREDENTIALS_JSON = JSON.stringify({
      type: 'service_account',
      project_id: 'demo-proj',
      client_email: 'demo@demo.iam.gserviceaccount.com',
      private_key: 'fake'
    });

    const { resolveGoogleClientOptions } = await import('../../lib/google-cloud-credentials.js');
    const opts = resolveGoogleClientOptions();

    expect(opts.credentials?.project_id).toBe('demo-proj');
    expect(opts.projectId).toBe('demo-proj');
    expect(opts.keyFilename).toBeUndefined();
    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
  });

  test('uses an existing key file and rewrites GOOGLE_APPLICATION_CREDENTIALS', async () => {
    tempKey = path.join(os.tmpdir(), `gcloud-test-${Date.now()}.json`);
    fs.writeFileSync(tempKey, JSON.stringify({ type: 'service_account' }), 'utf8');
    process.env.GOOGLE_APPLICATION_CREDENTIALS = tempKey;

    const { resolveGoogleClientOptions } = await import('../../lib/google-cloud-credentials.js');
    const opts = resolveGoogleClientOptions();

    expect(opts.keyFilename).toBe(path.resolve(tempKey));
    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe(path.resolve(tempKey));
    expect(opts.credentials).toBeUndefined();
  });

  test('accepts JSON pasted into GOOGLE_APPLICATION_CREDENTIALS', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = JSON.stringify({
      type: 'service_account',
      project_id: 'from-path-var',
      private_key: 'line1\\nline2',
      client_email: 'a@b.com'
    });

    const { resolveGoogleClientOptions } = await import('../../lib/google-cloud-credentials.js');
    const opts = resolveGoogleClientOptions();

    expect(opts.credentials?.project_id).toBe('from-path-var');
    expect(opts.credentials.private_key).toBe('line1\nline2');
    expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
  });

  test('falls back to ./google-credentials.json when absolute path is missing', async () => {
    process.env.GOOGLE_APPLICATION_CREDENTIALS = '/google-credentials.json';
    const localKey = path.resolve(process.cwd(), 'google-credentials.json');

    const { resolveGoogleClientOptions } = await import('../../lib/google-cloud-credentials.js');
    const opts = resolveGoogleClientOptions();

    if (fs.existsSync(localKey)) {
      // Local / CI with a key file: keep working (do not break existing apps).
      expect(opts.keyFilename).toBe(localKey);
      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBe(localKey);
    } else {
      // Render-style: no file on disk — clear the bad path.
      expect(opts).toEqual({});
      expect(process.env.GOOGLE_APPLICATION_CREDENTIALS).toBeUndefined();
    }
  });
});
