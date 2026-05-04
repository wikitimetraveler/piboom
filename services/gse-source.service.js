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
export function readProducts() {
  const fannie = readJsonFile('fannie-products.json');
  const freddie = readJsonFile('freddie-products.json');
  const list = [];
  for (const p of fannie.products || []) {
    list.push({
      agency: fannie.agency,
      productId: `fannie:${p.id}`,
      id: p.id,
      name: p.name,
      tag: p.tag,
      sourceRefs: p.sourceRefs || []
    });
  }
  for (const p of freddie.products || []) {
    list.push({
      agency: freddie.agency,
      productId: `freddie:${p.id}`,
      id: p.id,
      name: p.name,
      tag: p.tag,
      sourceRefs: p.sourceRefs || []
    });
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
