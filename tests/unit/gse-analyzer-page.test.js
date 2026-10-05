/**
 * Development work by David Lane
 */
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const html = readFileSync(join(__dirname, '../../public/gse-analyzer.html'), 'utf8');

const indexOf = (needle) => {
  const idx = html.indexOf(needle);
  if (idx === -1) throw new Error(`Missing in gse-analyzer.html: ${needle}`);
  return idx;
};

describe('gse-analyzer.html layout', () => {
  test('Product fit grid sits directly under Program intelligence', () => {
    const exhibit = indexOf('id="gseExhibitSection"');
    const productFit = indexOf('id="gseProductsGrid"');
    const pooling = indexOf('id="gsePoolingSection"');
    expect(productFit).toBeGreaterThan(exhibit);
    expect(productFit).toBeLessThan(pooling);
  });

  test('Suggestions sit directly under the Product fit grid', () => {
    const productFit = indexOf('id="gseProductsGrid"');
    const suggestions = indexOf('id="gseSuggestionsGrid"');
    const pooling = indexOf('id="gsePoolingSection"');
    expect(suggestions).toBeGreaterThan(productFit);
    expect(suggestions).toBeLessThan(pooling);
  });

  test('Appraisal section is at the bottom, after the knowledge bank', () => {
    const knowledge = indexOf('id="gseKnowledgeBank"');
    const appraisal = indexOf('id="gseAppraisalSection"');
    expect(appraisal).toBeGreaterThan(knowledge);
    expect(html).toMatch(/UCDP/);
    expect(html).toMatch(/UAD 3\.6/);
  });

  test('calc engine scripts load before the page script', () => {
    const lib = indexOf('src="/shared/calcEngineLibrary.js"');
    const engine = indexOf('src="/shared/calculationEngine.js"');
    const page = indexOf('src="/js/gse-analyzer.js"');
    expect(lib).toBeLessThan(engine);
    expect(engine).toBeLessThan(page);
  });

  test('LTV, CLTV, and AMI % are read-only engine outputs with their source inputs present', () => {
    for (const id of ['ltv', 'cltv', 'amiPercent']) {
      expect(html).toMatch(new RegExp(`id="${id}"[^>]*readonly`));
    }
    for (const id of ['subordinateFinancing', 'areaMedianIncome', 'gseLimitAmount', 'gseLiveRisk', 'gseLiveConforming']) {
      expect(html).toContain(`id="${id}"`);
    }
  });
});
