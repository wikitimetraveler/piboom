/**
 * Development work by David Lane
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

function loadBrowserScript(relativePath) {
  const code = readFileSync(join(process.cwd(), relativePath), 'utf8');
  const sandbox = {
    console,
    matchMedia() {
      return { matches: true, addEventListener() {}, addListener() {} };
    },
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = {
    documentElement: { setAttribute() {}, getAttribute() { return null; } },
    body: { setAttribute() {}, appendChild() {} },
    readyState: 'complete',
    getElementById() { return null; },
    querySelectorAll() { return []; },
    querySelector() { return null; },
    addEventListener() {},
    createElement(tag) {
      return {
        tagName: String(tag).toUpperCase(),
        style: {},
        className: '',
        setAttribute() {},
        appendChild() {},
      };
    },
    hidden: false,
  };
  vm.runInNewContext(code, sandbox);
  return sandbox;
}

function mockCard() {
  const classes = new Set(['astro-spread-card--tarot', 'is-pending']);
  return {
    dataset: { phase: 'back' },
    classList: {
      add: (...names) => names.forEach((c) => classes.add(c)),
      remove: (...names) => names.forEach((c) => classes.delete(c)),
      contains: (c) => classes.has(c),
    },
  };
}

describe('astrology tarot ceremony', () => {
  test('buildPileMarkup renders a compact faux deck', () => {
    const sandbox = loadBrowserScript('public/entertainment/js/astrology-tarot-ceremony.js');
    const html = sandbox.AstrologyTarotCeremony.buildPileMarkup();
    expect(html).toContain('astro-deck-sheet');
    expect((html.match(/astro-deck-sheet/g) || []).length).toBe(12);
  });

  test('finishInstant reveals cards and hides the pile under reduced motion', () => {
    const sandbox = loadBrowserScript('public/entertainment/js/astrology-tarot-ceremony.js');
    const cardEls = [mockCard(), mockCard(), mockCard()];
    const pile = { hidden: false };
    const status = { textContent: '' };
    const table = {
      classList: { remove() {}, add() {} },
      querySelector(sel) {
        if (sel === '#astroDeckPile') return pile;
        if (sel === '[data-spread-status]') return status;
        return null;
      },
      querySelectorAll(sel) {
        if (sel === '.astro-spread-card--tarot') return cardEls;
        return [];
      },
    };

    sandbox.AstrologyTarotCeremony.finishInstant(table);
    expect(pile.hidden).toBe(true);
    cardEls.forEach((card) => {
      expect(card.classList.contains('is-revealed')).toBe(true);
      expect(card.classList.contains('is-pending')).toBe(false);
      expect(card.dataset.phase).toBe('art');
    });
    expect(status.textContent).toMatch(/Tap a card/i);
  });
});
