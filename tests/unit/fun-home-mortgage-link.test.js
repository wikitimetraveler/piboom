/**
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';

const root = process.cwd();
const htmlFiles = ['public/index.html', 'public/stack.html'];
const css = fs.readFileSync(path.join(root, 'public/shared/css/fun-home.css'), 'utf8');
const js = fs.readFileSync(path.join(root, 'public/shared/js/fun-home.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');

const EXPECTED_PROJECTS = [
  'studio',
  'music',
  'family',
  'watch',
  'nature',
  'valley',
  'glazed',
  'middle-east',
  'heygen',
  'planetarium',
  'entertainment',
];

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

describe('fun-home public project cards', () => {
  function cardSlice(projectId) {
    const re = new RegExp(
      `<article\\s+class="fun-card[^"]*"\\s+data-project="${projectId}"[\\s\\S]*?</article>`,
      'i'
    );
    const match = indexHtml.match(re);
    expect(match).toBeTruthy();
    return match[0];
  }

  test('every public project card has features and verified stack chips', () => {
    for (const id of EXPECTED_PROJECTS) {
      const card = cardSlice(id);
      expect(card).toMatch(/<ul class="fun-card__features">/);
      expect(card).toMatch(/<ul class="fun-card__stack" aria-label="Technology stack">/);
      expect(card).toMatch(/<span class="fun-chip">/);
      expect(card).toMatch(/fun-card__link--primary/);
      expect(card).not.toMatch(/<span class="fun-chip">React<\/span>/);
    }
  });

  test('public projects grid does not promote Encompass or finance tools', () => {
    const projectsSection = indexHtml.match(
      /<section class="fun-projects"[\s\S]*?<\/section>/
    );
    expect(projectsSection).toBeTruthy();
    const body = projectsSection[0];
    expect(body).not.toMatch(/data-project="encompass"/i);
    expect(body).not.toMatch(/data-project="unit-tests"/i);
    expect(body).not.toMatch(/data-project="worksheets"/i);
    expect(body).not.toMatch(/data-project="disasters"/i);
    expect(body).not.toMatch(/href="\/finance\//);
    expect(body).not.toMatch(/>Encompass</);
    expect(body).not.toMatch(/>Unit Tests</);
  });

  test('CSS defines feature list and chip styles', () => {
    expect(css).toMatch(/\.fun-card__features\b/);
    expect(css).toMatch(/\.fun-card__stack\b/);
    expect(css).toMatch(/\.fun-chip\b/);
  });
});
