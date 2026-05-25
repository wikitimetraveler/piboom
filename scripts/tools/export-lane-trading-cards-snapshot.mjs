/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '..', '..');

function getArg(name, fallback = '') {
  const i = process.argv.indexOf(name);
  if (i < 0) return fallback;
  return process.argv[i + 1] || fallback;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  if (value && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(text) {
  return crypto.createHash('sha256').update(text).digest('hex');
}

function buildCatalogHtml(doc) {
  const cards = Array.isArray(doc.cards) ? doc.cards : [];
  const sections = cards
    .map(
      (card, index) => `
      <section class="card">
        <h2>${index + 1}. ${card.title}</h2>
        <p class="meta">${card.era} · ${card.branch} · ${card.cardId}</p>
        <p>${card.summary}</p>
        <h3>Facts</h3>
        <ul>${(card.facts || []).map((fact) => `<li>${fact}</li>`).join('')}</ul>
        <h3>Citations</h3>
        <ul>${(card.citations || [])
          .map((citation) => `<li>${citation.label}${citation.pageRef ? ` (${citation.pageRef})` : ''}${citation.url ? ` — ${citation.url}` : ''}</li>`)
          .join('')}</ul>
      </section>
    `
    )
    .join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Lane Trading Cards Catalog Snapshot</title>
  <style>
    body { font-family: Georgia, serif; margin: 24px; color: #111; }
    h1 { margin-bottom: 0; }
    .sub { color: #444; margin-top: 4px; }
    .card { border: 1px solid #bbb; padding: 12px; margin: 0 0 12px; page-break-inside: avoid; }
    .meta { color: #444; font-size: 14px; }
    h2 { margin: 0 0 6px; font-size: 20px; }
    h3 { margin: 8px 0 4px; font-size: 15px; }
  </style>
</head>
<body>
  <h1>Lane Trading Cards · ${doc.edition}</h1>
  <p class="sub">Source: ${doc.sourceLabel}</p>
  ${sections}
</body>
</html>`;
}

async function main() {
  const sourcePath = path.join(repoRoot, 'data', 'lane-trading-cards-first-edition.json');
  const schemaPath = path.join(repoRoot, 'data', 'lane-trading-cards.schema.json');
  const sourceText = await fs.readFile(sourcePath, 'utf-8');
  const sourceDoc = JSON.parse(sourceText);
  const cards = Array.isArray(sourceDoc.cards) ? sourceDoc.cards.slice() : [];
  cards.sort((a, b) => String(a.cardId || '').localeCompare(String(b.cardId || ''), undefined, { sensitivity: 'base' }));

  const stamp = getArg('--stamp', new Date().toISOString().replace(/[:.]/g, '-'));
  const outRoot = getArg('--outDir', path.join(repoRoot, 'data', 'lane-trading-cards-snapshots', stamp));
  await fs.mkdir(outRoot, { recursive: true });

  const snapshotDoc = {
    version: sourceDoc.version,
    edition: sourceDoc.edition,
    generatedAt: sourceDoc.generatedAt,
    exportedAt: new Date().toISOString(),
    sourceLabel: sourceDoc.sourceLabel,
    cards
  };
  const stableJson = stableStringify(snapshotDoc);
  const manifest = {
    stamp,
    cardCount: cards.length,
    checksumSha256: sha256(stableJson),
    files: ['lane-trading-cards.snapshot.json', 'lane-trading-cards.catalog.html', 'lane-trading-cards.manifest.json', 'lane-trading-cards.schema.json']
  };
  const catalogHtml = buildCatalogHtml(snapshotDoc);

  await fs.writeFile(path.join(outRoot, 'lane-trading-cards.snapshot.json'), `${stableJson}\n`, 'utf-8');
  await fs.writeFile(path.join(outRoot, 'lane-trading-cards.catalog.html'), `${catalogHtml}\n`, 'utf-8');
  await fs.writeFile(path.join(outRoot, 'lane-trading-cards.manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf-8');
  await fs.copyFile(schemaPath, path.join(outRoot, 'lane-trading-cards.schema.json'));

  console.log(`Exported Lane Trading Cards snapshot to ${outRoot}`);
  console.log(`Cards: ${cards.length}`);
  console.log(`SHA-256: ${manifest.checksumSha256}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
