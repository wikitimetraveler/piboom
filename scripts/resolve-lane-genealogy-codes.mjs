/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Decode the 1891 register codes (No. N, (N) carry-forward, Roman child order, pedigree chains) from
 * data/lanegenealogies01chap.pdf and resolve them against data/laneData.json.
 *
 * Usage:
 *   node scripts/resolve-lane-genealogy-codes.mjs                 # dry run → data/lane-genealogy-codes.json
 *   node scripts/resolve-lane-genealogy-codes.mjs --write         # also writes laneData.json links + genealogyCode
 *   node scripts/resolve-lane-genealogy-codes.mjs --pages-json p.json
 *   node scripts/resolve-lane-genealogy-codes.mjs --write --enrich  # also synthesize missing register people
 *
 * Then: npm run migrate:lane-json-postgres
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';
import {
  applyGenealogyCodePlan,
  buildGenealogyCodePlan,
  buildNodeIndex,
  decodeGenealogyRegister,
  enrichLaneDataFromRegister,
  summarizeRegister
} from '../services/lane-genealogy-codes.service.js';
import { validateLaneData } from '../services/genealogy-import.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LANE_DATA = path.join(ROOT, 'data', 'laneData.json');
const PDF = path.join(ROOT, 'data', 'lanegenealogies01chap.pdf');
const REGISTER_OUT = path.join(ROOT, 'data', 'lane-genealogy-codes.json');
const PUBLIC_REGISTER_OUT = path.join(ROOT, 'public', 'family', 'data', 'lane-genealogy-codes.json');

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? process.argv[i + 1] : null;
}

function loadPages() {
  const pagesJson = argValue('--pages-json');
  if (pagesJson) return JSON.parse(fs.readFileSync(pagesJson, 'utf-8'));
  if (!fs.existsSync(PDF)) {
    throw new Error(`Missing ${PDF} — the Lane Genealogies PDF is required to decode register codes`);
  }
  const python = process.platform === 'win32' ? 'python' : 'python3';
  const r = spawnSync(
    python,
    [path.join(ROOT, 'scripts', 'dump_lane_pdf_pages_json.py'), '--from-page', '1', '--to-page', '1000', '--max-chars', '200000'],
    { cwd: ROOT, encoding: 'utf-8', maxBuffer: 64 * 1024 * 1024, env: { ...process.env, PYTHONIOENCODING: 'utf-8' } }
  );
  if (r.status !== 0) throw new Error(`PDF text dump failed: ${r.stderr || r.error?.message || 'unknown error'}`);
  return JSON.parse(r.stdout);
}

function main() {
  const write = process.argv.includes('--write');
  const enrich = process.argv.includes('--enrich');
  let laneData = JSON.parse(fs.readFileSync(LANE_DATA, 'utf-8'));
  const pages = loadPages();
  const index = buildNodeIndex(laneData);
  const register = decodeGenealogyRegister(pages, { givenSet: index.givenSet, volume: 1 });
  register.volume = 1;
  register.source = 'lanegenealogies01chap.pdf';

  let plan = buildGenealogyCodePlan(register, laneData);
  let enrichStats = { created: 0 };
  if (enrich) {
    const enriched = enrichLaneDataFromRegister(laneData, register, { plan, source: register.source });
    laneData = enriched.laneData;
    enrichStats = enriched.stats;
    plan = buildGenealogyCodePlan(register, laneData);
  }

  const { laneData: updated, stats } = applyGenealogyCodePlan(laneData, plan);
  const validation = validateLaneData(updated);
  const summary = summarizeRegister(plan, stats);
  summary.validation = { valid: validation.valid, issues: validation.issues.length };
  summary.enrichment = enrich ? enrichStats : null;
  summary.volume = 1;

  fs.writeFileSync(REGISTER_OUT, JSON.stringify(summary, null, 2), 'utf-8');
  fs.mkdirSync(path.dirname(PUBLIC_REGISTER_OUT), { recursive: true });
  fs.writeFileSync(PUBLIC_REGISTER_OUT, JSON.stringify(summary, null, 2), 'utf-8');
  if (write) {
    if (!validation.valid) throw new Error(`Refusing to write laneData.json: ${validation.issues.length} validation issue(s)`);
    fs.writeFileSync(LANE_DATA, JSON.stringify(updated, null, 2), 'utf-8');
  }

  console.log(
    JSON.stringify(
      {
        mode: write ? 'write' : 'dry-run',
        enrich,
        sections: register.sections,
        stats: summary.stats,
        enrichment: summary.enrichment,
        valid: validation.valid,
        registerOut: path.relative(ROOT, REGISTER_OUT),
        next: write ? 'npm run migrate:lane-json-postgres' : 're-run with --write --enrich to update data/laneData.json'
      },
      null,
      2
    )
  );
}

try {
  main();
} catch (error) {
  console.error(`resolve-lane-genealogy-codes failed: ${error?.message || error}`);
  process.exit(1);
}
