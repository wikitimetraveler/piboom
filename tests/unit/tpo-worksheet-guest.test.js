/**
 * TPO worksheet guest launch shell — input[emid] fields per the shared
 * binding class (public/shared/bindings.js).
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';

const guest = fs.readFileSync(
  path.join(process.cwd(), 'public', 'finance', 'tpo-worksheet-guest.html'),
  'utf8'
);
const host = fs.readFileSync(
  path.join(process.cwd(), 'public', 'finance', 'tpo-worksheet-host-test.html'),
  'utf8'
);

describe('tpo worksheet guest shell', () => {
  test('embeds the SSF polyfill guest library and the shared binding class', () => {
    expect(guest).toContain('elli.ssf.guest-with-polyfill.js');
    expect(guest).toContain('bindings.js');
    expect(guest).toContain('ScreenBindings');
  });

  test('uses input fields with emid field IDs (binding-class pattern)', () => {
    ['4000', '4002', '1109', '356'].forEach((id) => {
      expect(guest).toContain(`<input`);
      expect(guest).toContain(`emid="${id}"`);
    });
    expect(guest).toContain('input[emid]');
    expect(guest).not.toContain('calcMath');
    expect(guest).not.toContain('data-encompass-field');
  });

  test('runs standalone with demo fallback', () => {
    expect(guest).toContain("params.has('demo')");
    expect(guest).toContain('CL-DEMO-001');
  });

  test('host harness launches the guest in an iframe', () => {
    expect(host).toContain('<iframe');
    expect(host).toContain('tpo-worksheet-guest.html');
  });
});
