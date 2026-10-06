import { readFileSync } from 'fs';
import { join } from 'path';
import vm from 'vm';

function loadMenuConfig() {
  const file = join(process.cwd(), 'public/shared/menu-config.js');
  const code = readFileSync(file, 'utf8');
  const sandbox = {};
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(code, sandbox);
  return sandbox.MENU_CONFIG;
}

describe('menu-config auth filtering', () => {
  let MENU_CONFIG;

  beforeAll(() => {
    MENU_CONFIG = loadMenuConfig();
  });

  test('pathRequiresAuth gates mortgage pages; disaster suite and GSE stay public', () => {
    expect(MENU_CONFIG.pathRequiresAuth('/finance/index.html')).toBe(true);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/fha-streamline-calculator.html')).toBe(true);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/disasters-unified.html')).toBe(false);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/disasters-webcams.html')).toBe(false);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/disasters-encompass-map.html')).toBe(false);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/encompass-hub.html')).toBe(true);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/unit-tests.html')).toBe(true);
    expect(MENU_CONFIG.pathRequiresAuth('/gse-analyzer.html')).toBe(false);
  });

  test('filterToolsByAuth logged-out visible set is disaster suite + GSE only', () => {
    const visible = MENU_CONFIG.filterToolsByAuth(MENU_CONFIG.ENCOMPASS_TOOLS, false);
    const hrefs = visible.map((t) => t.href);
    expect(hrefs).toContain('/finance/disasters-unified.html');
    expect(hrefs).toContain('/finance/disasters-encompass-map.html');
    expect(hrefs).toContain('/gse-analyzer.html');
    expect(hrefs).not.toContain('/finance/index.html');
    expect(hrefs).not.toContain('/finance/encompass-assistant.html');
    expect(hrefs).not.toContain('/finance/unit-tests.html');
    expect(hrefs).not.toContain('/finance/loan-batch-update.html');
    expect(hrefs).not.toContain('/finance/fha-streamline-calculator.html');
  });

  test('filterToolsByAuth shows all tools when logged in', () => {
    const visible = MENU_CONFIG.filterToolsByAuth(MENU_CONFIG.ENCOMPASS_TOOLS, true);
    expect(visible.length).toBe(MENU_CONFIG.ENCOMPASS_TOOLS.length);
  });

  test('pathRequiresAuth gates processor assignment tools', () => {
    expect(MENU_CONFIG.pathRequiresAuth('/finance/processor-assignment.html')).toBe(true);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/processor-assignment-mock.html')).toBe(true);
  });

  test('getFinanceNavItems scrubs mortgage apps when logged out and expands when logged in', () => {
    const loggedOut = MENU_CONFIG.getFinanceNavItems(false);
    const loggedIn = MENU_CONFIG.getFinanceNavItems(true);
    expect(loggedOut).not.toEqual(MENU_CONFIG.NAV_FINANCE);
    const outHrefs = loggedOut.filter((t) => t.href).map((t) => t.href);
    expect(outHrefs).toContain('/finance/disasters-unified.html');
    expect(outHrefs).not.toContain('/finance/encompass-hub.html');
    expect(outHrefs).not.toContain('/finance/unit-tests.html');
    expect(outHrefs).not.toContain('/finance/index.html');

    const hrefs = loggedIn.filter((t) => t.href).map((t) => t.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/finance/encompass-hub.html',
        '/finance/encompass-assistant.html',
        '/finance/condition-manager.html',
        '/finance/enhanced-conditions.html',
        '/finance/enhanced-conditions-expert.html',
        '/finance/tpo-connect.html',
        '/finance/processor-assignment.html',
        '/finance/unit-tests.html',
        '/finance/fha-streamline-calculator.html',
        '/finance/disasters-unified.html',
      ]),
    );
    expect(hrefs.indexOf('/finance/encompass-hub.html')).toBeLessThan(
      hrefs.indexOf('/finance/fha-streamline-calculator.html'),
    );
  });

  test('getMortgageTools returns disasters only when logged out; full set when logged in', () => {
    const loggedOut = MENU_CONFIG.getMortgageTools(false);
    const loggedIn = MENU_CONFIG.getMortgageTools(true);
    const outHrefs = loggedOut.map((t) => t.href);
    expect(outHrefs).toContain('/finance/disasters-unified.html');
    expect(outHrefs).not.toContain('/finance/encompass-assistant.html');
    expect(outHrefs).not.toContain('/finance/dti-calculator.html');
    expect(loggedIn.map((t) => t.href)).toEqual(
      expect.arrayContaining([
        '/finance/encompass-hub.html',
        '/finance/encompass-assistant.html',
        '/finance/unit-tests.html',
        '/finance/dti-calculator.html',
      ]),
    );
    expect(loggedIn.length).toBeGreaterThan(loggedOut.length);
  });

  test('Nature tools include Ski Drive and Ski Areas', () => {
    const drive = MENU_CONFIG.NATURE_TOOLS.find((t) => t.label === 'Ski Drive');
    const areas = MENU_CONFIG.NATURE_TOOLS.find((t) => t.label === 'Ski Areas');
    expect(drive).toMatchObject({ href: '/ski/', icon: 'bi-signpost-2' });
    expect(areas).toMatchObject({ href: '/ski/areas', icon: 'bi-snow2' });
  });

  test('Entertainment menu includes Mountain High with a mountain icon', () => {
    const navItem = MENU_CONFIG.NAV_ENTERTAINMENT.find((t) => t.label === 'Mountain High');
    const hubItem = MENU_CONFIG.ENTERTAINMENT_TOOLS.find((t) => t.label === 'Mountain High');
    expect(navItem).toMatchObject({ href: '/mountain-high/', icon: 'bi-mountain' });
    expect(hubItem).toMatchObject({ href: '/mountain-high/', icon: 'bi-mountain' });
  });

  test('getDomainTiles hides Worksheets tile when logged out', () => {
    const loggedOut = MENU_CONFIG.getDomainTiles(false, false);
    const loggedIn = MENU_CONFIG.getDomainTiles(false, true);
    expect(loggedOut.map((t) => t.href)).not.toContain('/finance/index.html');
    expect(loggedOut.map((t) => t.href)).toContain('/finance/disasters-unified.html');
    expect(loggedIn.map((t) => t.href)).toContain('/finance/index.html');
  });
});
