/**
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const htmlFiles = ['public/index.html', 'public/stack.html'];
const css = fs.readFileSync(path.join(root, 'public/shared/css/fun-home.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/shared/js/fun-home.js'), 'utf8');

describe('fun-home Mortgage Work login gate', () => {
  test.each(htmlFiles)('%s hides Mortgage Work until login', (file) => {
    const html = fs.readFileSync(path.join(root, file), 'utf8');
    expect(html).toMatch(/id="secretMortgageLink"[^>]*\bhidden\b/);
    expect(html).toMatch(/id="secretMortgageLink"[^>]*aria-hidden="true"/);
    expect(html).toContain('Mortgage Work');
  });

  test('CSS keeps the link hidden unless body.fun-logged-in', () => {
    expect(css).toMatch(/\.fun-secret-link[\s\S]*display:\s*none\s*!important/);
    expect(css).toMatch(/body\.fun-logged-in\s+\.fun-secret-link/);
    expect(js).toContain("classList.toggle('fun-logged-in'");
  });

  test('JS does not reveal Mortgage Work from sparkle or leftover localStorage', () => {
    expect(js).not.toContain("localStorage.setItem('mortgageLinkRevealed'");
    expect(js).toContain("localStorage.removeItem('mortgageLinkRevealed')");
    expect(js).not.toMatch(/Secret mortgage work link revealed/);
  });
});
