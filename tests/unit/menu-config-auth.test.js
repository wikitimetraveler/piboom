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

  test('pathRequiresAuth treats disasters as public and Encompass hub as gated', () => {
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
});
