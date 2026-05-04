import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GSE_DIR = path.join(__dirname, '..', 'data', 'gse');

function readJsonFile(name) {
  const p = path.join(GSE_DIR, name);
  const raw = fs.readFileSync(p, 'utf8');
  return JSON.parse(raw);
}

/**
 * Merged product catalog for UI (stable productId per agency).
 */
const PRODUCT_FILES = [
  ['fannie-products.json', 'fannie'],
  ['freddie-products.json', 'freddie'],
  ['va-products.json', 'va'],
  ['fha-products.json', 'fha']
];

export function readProducts() {
  const list = [];
  for (const [fileName, prefix] of PRODUCT_FILES) {
    const data = readJsonFile(fileName);
    for (const p of data.products || []) {
      list.push({
        agency: data.agency,
        productId: `${prefix}:${p.id}`,
        id: p.id,
        name: p.name,
        tag: p.tag,
        sourceRefs: p.sourceRefs || []
      });
    }
  }
  return list;
}

/**
 * Rule metadata: disclaimers + official source URLs.
 */
export function readSources() {
  return readJsonFile('rule-metadata.json');
}

export function getGseDataDir() {
  return GSE_DIR;
}
