/**
 * Development work by David Lane
 */
import { readFileSync } from 'fs';
import { join } from 'path';

const html = readFileSync(join(process.cwd(), 'public/open/index.html'), 'utf8');
const bar = readFileSync(join(process.cwd(), 'public/shared/js/open-suite-bar.js'), 'utf8');

describe('open suite', () => {
  test('LinkedIn page links Disasters, the GSE analyzer, and graph calc', () => {
    expect(html).toContain('href="/finance/disasters-unified.html"');
    expect(html).not.toContain('href="/finance/encompass-assistant.html"');
    expect(html).toContain('href="/gse-analyzer.html"');
    expect(html).toContain('href="/finance/calc-engine-webgpu.html"');
    expect(html).toContain('https://devconnectlabs.com/open/');
    expect(html).not.toMatch(/OAuth|webhook|field reader|Developer Connect|\/api\//i);
  });

  test('suite bar switches among the public apps', () => {
    expect(bar).toContain('/finance/disasters-unified.html');
    expect(bar).not.toContain('/finance/encompass-assistant.html');
    expect(bar).toContain('/gse-analyzer.html');
    expect(bar).toContain('/finance/calc-engine-webgpu.html');
    expect(bar).toContain('/open/');
  });

  test('Encompass apps main menu grid is not rendered on suite pages or Encompass Assistant', () => {
    const assistantHtml = readFileSync(join(process.cwd(), 'public/finance/encompass-assistant.html'), 'utf8');
    const disastersHtml = readFileSync(join(process.cwd(), 'public/finance/disasters-unified.html'), 'utf8');
    const calcHtml = readFileSync(join(process.cwd(), 'public/finance/calc-engine-webgpu.html'), 'utf8');
    expect(assistantHtml).not.toContain('encompassAppsSection');
    expect(assistantHtml).not.toContain('Every mortgage app in this session');
    expect(assistantHtml).not.toContain('open-suite-bar.js');
    expect(disastersHtml).not.toContain('href="/finance/encompass-assistant.html"');
    expect(disastersHtml).not.toContain('href="/finance/index.html"');
    expect(calcHtml).not.toContain('href="/finance/index.html"');
  });
});
