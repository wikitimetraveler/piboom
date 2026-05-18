/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Maintainer one-off: remove `militaryEngagements` from every node in data/laneData.json.
 * Stale blobs can contradict genealogy.service scoring after war-matching fixes.
 *
 * Default: dry-run (counts nodes that would change). Pass --write to apply.
 * Optional: copy backup to data/laneData.backup-pre-strip-military.json (unless --no-backup).
 *
 * Usage: npm run strip:lane-military-engagements           (dry-run)
 *        npm run strip:lane-military-engagements:write     (apply + backup)
 *        node scripts/tools/strip-lane-military-engagements.mjs --write
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const DATA = path.join(ROOT, 'data', 'laneData.json');
const BACKUP = path.join(ROOT, 'data', 'laneData.backup-pre-strip-military.json');

const args = process.argv.slice(2);
const write = args.includes('--write');
const noBackup = args.includes('--no-backup');

async function main() {
  const raw = await fs.promises.readFile(DATA, 'utf8');
  const data = JSON.parse(raw);
  const nodes = Array.isArray(data.nodes) ? data.nodes : [];
  const touched = [];
  for (const node of nodes) {
    if (node && Object.prototype.hasOwnProperty.call(node, 'militaryEngagements')) {
      touched.push(node.id);
    }
  }
  console.log(`Nodes with militaryEngagements: ${touched.length}`);
  if (touched.length && touched.length <= 40) {
    console.log(`Ids: ${touched.join(', ')}`);
  } else if (touched.length) {
    console.log(`First ids: ${touched.slice(0, 20).join(', ')} …`);
  }
  if (!write) {
    console.log('Dry run. Re-run with --write to strip and save.');
    return;
  }
  if (!noBackup) {
    await fs.promises.copyFile(DATA, BACKUP);
    console.log(`Backup: ${BACKUP}`);
  }
  let stripped = 0;
  for (const node of nodes) {
    if (node && Object.prototype.hasOwnProperty.call(node, 'militaryEngagements')) {
      delete node.militaryEngagements;
      stripped += 1;
    }
  }
  const out = `${JSON.stringify(data, null, 2)}\n`;
  await fs.promises.writeFile(DATA, out, 'utf8');
  console.log(`Stripped militaryEngagements from ${stripped} nodes. Wrote ${DATA}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
