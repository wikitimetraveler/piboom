/**
 * Development work by David Lane
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

function loadBrowserScript(relativePath) {
  const code = readFileSync(join(process.cwd(), relativePath), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  sandbox.document = {
    documentElement: { setAttribute() {}, getAttribute() { return null; } },
    body: { setAttribute() {} },
    readyState: 'complete',
    getElementById() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
  };
  sandbox.localStorage = {
    getItem() { return null; },
    setItem() {},
  };
  sandbox.URLSearchParams = URLSearchParams;
  vm.runInNewContext(code, sandbox);
  return sandbox;
}

describe('astrology i18n + Vietnamese copy', () => {
  test('UI dictionary has matching en/vi keys', () => {
    const sandbox = loadBrowserScript('public/entertainment/js/astrology-i18n.js');
    const { AstrologyI18N } = sandbox;
    expect(AstrologyI18N.LANGS).toEqual(['en', 'vi']);
    const enKeys = Object.keys(AstrologyI18N.UI.en).sort();
    const viKeys = Object.keys(AstrologyI18N.UI.vi).sort();
    expect(viKeys).toEqual(enKeys);
    expect(AstrologyI18N.UI.en.dobLabel).toBe('Date of birth');
    expect(AstrologyI18N.UI.vi.dobLabel).toBe('Ngày sinh');
    expect(AstrologyI18N.voiceProfile('vi').voice).toMatch(/^vi-VN/);
  });

  test('Vietnamese copy covers twelve signs and seventy-eight cards', () => {
    const code =
      readFileSync(join(process.cwd(), 'public/entertainment/js/astrology-zodiac.js'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'public/entertainment/js/astrology-arcana.js'), 'utf8') +
      '\n' +
      readFileSync(join(process.cwd(), 'public/entertainment/js/astrology-copy-vi.js'), 'utf8');
    const sandbox = { console };
    sandbox.window = sandbox;
    sandbox.globalThis = sandbox;
    vm.runInNewContext(code, sandbox);
    const { AstrologyZodiac, AstrologyArcana, AstrologyCopyVi } = sandbox;
    expect(Object.keys(AstrologyCopyVi.signs)).toHaveLength(12);
    expect(Object.keys(AstrologyCopyVi.cards)).toHaveLength(78);
    AstrologyZodiac.SIGNS.forEach((sign) => {
      expect(AstrologyCopyVi.signs[sign.id]?.name).toBeTruthy();
      expect(AstrologyCopyVi.signs[sign.id]?.oracle).toMatch(/Rose/);
    });
    AstrologyArcana.DECK.forEach((card) => {
      expect(AstrologyCopyVi.cards[card.id]?.name).toBeTruthy();
      expect(AstrologyCopyVi.cards[card.id]?.oracle).toMatch(/Rose/);
    });
  });

  test('rose heygen demo catalog includes Vietnamese script', () => {
    const demo = JSON.parse(readFileSync(join(process.cwd(), 'data/rose-heygen-demo.json'), 'utf8'));
    expect(demo.heygenScriptShortVi).toMatch(/Rose/);
    expect(demo.titleVi).toMatch(/Rose|Gặp/);
  });
});
