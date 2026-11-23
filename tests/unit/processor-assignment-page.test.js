/**
 * Development work by David Lane
 */
import { readFileSync } from 'fs';
import { join } from 'path';

function read(rel) {
  return readFileSync(join(process.cwd(), rel), 'utf8');
}

describe('processor assignment page stays mock-only', () => {
  const mockHtml = read('public/finance/processor-assignment-mock.html');
  const redirectHtml = read('public/finance/processor-assignment.html');
  const liveHtml = read('public/finance/processor-assignment-live.html');
  const retiredJs = read('public/finance/js/processor-assignment.js');
  const mockJs = read('public/finance/js/processor-assignment-mock.js');
  const clientRun = read('public/finance/js/processor-assignment-client-run.js');

  test('mock page loads synthetic data and does not call users, auth, or hub APIs', () => {
    expect(mockHtml).toContain('js/processor-assignment-mock-data.js');
    expect(mockHtml).toContain('js/processor-assignment-client-run.js');
    expect(mockHtml).toContain('js/processor-assignment-mock.js');
    expect(mockHtml).not.toContain('processor-assignment.js');
    expect(mockHtml).not.toContain('encompass-api.js');
    expect(mockHtml).not.toContain('finance-auth-guard.js');
    expect(mockHtml).not.toContain('user-login.js');
    expect(mockHtml).not.toContain('/api/');
    expect(mockJs).not.toMatch(/fetch\s*\(/);
    expect(mockJs).not.toMatch(/['"`]\/api\//);
    expect(clientRun).not.toMatch(/fetch\s*\(/);
    expect(clientRun).not.toMatch(/['"`]\/api\//);
  });

  test('canonical and live URLs redirect and do not load the Encompass client', () => {
    for (const html of [redirectHtml, liveHtml]) {
      expect(html).toContain('/finance/processor-assignment-mock.html');
      expect(html).not.toContain('encompass-api.js');
      expect(html).not.toContain('js/processor-assignment.js');
      expect(html).not.toContain('/api/encompass-hub');
    }
    expect(retiredJs).not.toMatch(/fetch\s*\(/);
    expect(retiredJs).not.toContain('/api/encompass-hub');
  });
});
