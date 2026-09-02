/**
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';

describe('user-login theater isolation', () => {
  test('logout preserves watch-together session keys', () => {
    const src = fs.readFileSync(
      path.join(process.cwd(), 'public/shared/user-login.js'),
      'utf8'
    );
    expect(src).toContain('clearSessionStorageExceptTheater');
    expect(src).not.toMatch(/sessionStorage\.clear\(\)/);
    expect(src).toContain('dc_watch_together_name_v1');
    expect(src).toContain('isWatchTogetherPath');
  });
});
