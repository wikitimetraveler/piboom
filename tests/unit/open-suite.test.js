/**
 * Development work by David Lane
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const html = readFileSync(join(process.cwd(), 'public/open/index.html'), 'utf8');
const bar = readFileSync(join(process.cwd(), 'public/shared/js/open-suite-bar.js'), 'utf8');

describe('open suite', () => {
  test('LinkedIn page links the Open Lender Suite apps', () => {
    expect(html).toContain('href="/finance/disasters-unified.html?showcase=1"');
    expect(html).toContain('href="/finance/encompass-assistant.html"');
    expect(html).toContain('href="/gse-analyzer.html"');
    expect(html).toContain('href="/finance/calc-engine-webgpu.html"');
    expect(html).toContain('href="/finance/loan-flight-sim.html"');
    expect(html).toContain('https://devconnectlabs.com/open/');
    expect(html).toContain('David Lane');
    expect(html).toContain('href="/stack.html"');
    expect(html).not.toMatch(/OAuth|webhook|field reader|Developer Connect|\/api\//i);
  });

  test('Open Lender Suite defaults to stack-aligned dark mode', () => {
    expect(html).toMatch(/class="[^"]*open-suite-page[^"]*dark-mode/);
    expect(html).toContain('/shared/dark-mode.js');
    expect(html).toContain('Fraunces');
    expect(html).toContain('Outfit');
  });

  test('Open Lender Suite mounts the WebGPU worldwide hazard globe', () => {
    expect(html).toContain('id="openSuiteGlobe"');
    expect(html).toContain('/shared/js/webgpu-globe.js');
    expect(html).toContain('/open/open-suite-globe.js');
    expect(html).toContain('Worldwide hazard pulse');
  });

  test('suite bar switches among the public apps', () => {
    expect(bar).toContain('/finance/disasters-unified.html');
    expect(bar).toContain('/finance/encompass-assistant.html');
    expect(bar).toContain('/gse-analyzer.html');
    expect(bar).toContain('/finance/calc-engine-webgpu.html');
    expect(bar).toContain('/finance/loan-flight-sim.html');
    expect(bar).toContain('/open/');
  });

  test('suite pages mount the switcher; Encompass apps main menu grid stays off', () => {
    const assistantHtml = readFileSync(join(process.cwd(), 'public/finance/encompass-assistant.html'), 'utf8');
    const disastersHtml = readFileSync(join(process.cwd(), 'public/finance/disasters-unified.html'), 'utf8');
    const calcHtml = readFileSync(join(process.cwd(), 'public/finance/calc-engine-webgpu.html'), 'utf8');
    const flightHtml = readFileSync(join(process.cwd(), 'public/finance/loan-flight-sim.html'), 'utf8');
    expect(assistantHtml).not.toContain('encompassAppsSection');
    expect(assistantHtml).not.toContain('Every mortgage app in this session');
    expect(assistantHtml).toContain('open-suite-bar.js');
    expect(flightHtml).toContain('open-suite-bar.js');
    expect(disastersHtml).not.toContain('href="/finance/index.html"');
    expect(calcHtml).not.toContain('href="/finance/index.html"');
  });
});
