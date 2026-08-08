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

  test('pathRequiresAuth treats Worksheets and disasters as public and Encompass as gated', () => {
    expect(MENU_CONFIG.pathRequiresAuth('/finance/index.html')).toBe(false);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/fha-streamline-calculator.html')).toBe(false);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/disasters-unified.html')).toBe(false);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/disasters-webcams.html')).toBe(false);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/encompass-hub.html')).toBe(true);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/unit-tests.html')).toBe(true);
    expect(MENU_CONFIG.pathRequiresAuth('/gse-analyzer.html')).toBe(false);
  });

  test('filterToolsByAuth hides login-required tools when logged out', () => {
    const visible = MENU_CONFIG.filterToolsByAuth(MENU_CONFIG.ENCOMPASS_TOOLS, false);
    const hrefs = visible.map((t) => t.href);
    expect(hrefs).toContain('/finance/disasters-unified.html');
    expect(hrefs).toContain('/finance/index.html');
    expect(hrefs).toContain('/gse-analyzer.html');
    expect(hrefs).not.toContain('/finance/encompass-assistant.html');
    expect(hrefs).not.toContain('/finance/unit-tests.html');
    expect(hrefs).not.toContain('/finance/loan-batch-update.html');
  });

  test('filterToolsByAuth shows all tools when logged in', () => {
    const visible = MENU_CONFIG.filterToolsByAuth(MENU_CONFIG.ENCOMPASS_TOOLS, true);
    expect(visible.length).toBe(MENU_CONFIG.ENCOMPASS_TOOLS.length);
  });

  test('pathRequiresAuth gates processor assignment tools', () => {
    expect(MENU_CONFIG.pathRequiresAuth('/finance/processor-assignment.html')).toBe(true);
    expect(MENU_CONFIG.pathRequiresAuth('/finance/processor-assignment-mock.html')).toBe(true);
  });

  test('getFinanceNavItems expands to every mortgage app when logged in', () => {
    const loggedOut = MENU_CONFIG.getFinanceNavItems(false);
    const loggedIn = MENU_CONFIG.getFinanceNavItems(true);
    expect(loggedOut).toEqual(MENU_CONFIG.NAV_FINANCE);
    const hrefs = loggedIn.filter((t) => t.href).map((t) => t.href);
    expect(hrefs).toEqual(
      expect.arrayContaining([
        '/finance/encompass-hub.html',
        '/finance/encompass-assistant.html',
        '/finance/condition-manager.html',
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

  test('getMortgageTools returns calculators plus full Encompass set when logged in', () => {
    const loggedOut = MENU_CONFIG.getMortgageTools(false);
    const loggedIn = MENU_CONFIG.getMortgageTools(true);
    expect(loggedOut.map((t) => t.href)).not.toContain('/finance/encompass-assistant.html');
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
});
