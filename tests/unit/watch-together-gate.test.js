/**
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';

const gatePath = path.join(process.cwd(), 'public/watch-together/js/gate.js');

describe('watch-together gate', () => {
  test('theater pages do not load global Worksheets user-login', () => {
    for (const file of ['index.html', 'theater.html']) {
      const html = fs.readFileSync(
        path.join(process.cwd(), 'public/watch-together', file),
        'utf8'
      );
      expect(html).not.toContain('user-login.js');
      expect(html).not.toContain('demo-users.js');
    }
  });

  test('gate copy states name-only entry, not Worksheets login', () => {
    const src = fs.readFileSync(gatePath, 'utf8');
    expect(src).toMatch(/No password/i);
    expect(src).toMatch(/not Worksheets or Encompass login/i);
    expect(src).not.toMatch(/verify-user-password/);
  });
});
