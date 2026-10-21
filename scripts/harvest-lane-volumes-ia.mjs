/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Harvest Lane Genealogies Vol. II (1897) and Vol. III (1902) plain text from Internet Archive,
 * decode numbered register families, and write a multi-volume research report.
 *
 * Usage:
 *   node scripts/harvest-lane-volumes-ia.mjs
 *   node scripts/harvest-lane-volumes-ia.mjs --skip-download   # reuse cached page JSON
 *   node scripts/harvest-lane-volumes-ia.mjs --enrich --write  # also synthesize people into laneData
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  buildGenealogyCodePlan,
  buildNodeIndex,
  decodeGenealogyRegister,
  enrichLaneDataFromRegister,
  applyGenealogyCodePlan,
  summarizeRegister,
  SECTION_LABELS
} from '../services/lane-genealogy-codes.service.js';
import { validateLaneData } from '../services/genealogy-import.service.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA = path.join(ROOT, 'data');

const VOLUMES = [
  {
    volume: 2,
    year: 1897,
    iaId: 'lanegenealogies02chap',
    defaultSection: 'dorchester',
    sourcePdf: 'lanegenealogies02chap.pdf',
    archiveUrl: 'https://archive.org/details/lanegenealogies02chap',
    pagesOut: path.join(DATA, 'lane-vol2-pages.json'),
    registerOut: path.join(DATA, 'lane-genealogy-codes-vol2.json')
  },
  {
    volume: 3,
    year: 1902,
    iaId: 'lanegenealogies03chap',
    defaultSection: 'joblane',
    sourcePdf: 'lanegenealogies03chap.pdf',
    archiveUrl: 'https://archive.org/details/lanegenealogies03chap',
    pagesOut: path.join(DATA, 'lane-vol3-pages.json'),
    registerOut: path.join(DATA, 'lane-genealogy-codes-vol3.json')
  }
];

const REPORT_OUT = path.join(DATA, 'lane-deep-research-report.json');
const LANE_DATA = path.join(DATA, 'laneData.json');
const VOL1_REGISTER = path.join(DATA, 'lane-genealogy-codes.json');
const PUBLIC_REGISTER = path.join(ROOT, 'public', 'family', 'data', 'lane-genealogy-codes.json');

function argFlag(flag) {
  return process.argv.includes(flag);
}

async function fetchText(iaId) {
  const url = `https://archive.org/download/${iaId}/${iaId}_djvu.txt`;
  const res = await fetch(url, { headers: { 'User-Agent': 'piBoom-lane-research/1.0' } });
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  return res.text();
}

/**
 * Split IA djvu.txt into page objects. Prefers form-feed pages; falls back to ~3k-char chunks
 * so the register decoder still sees family headers.
 */
function splitDjvuIntoPages(rawText) {
  const text = String(rawText || '').replace(/\r\n/g, '\n');
  let chunks = text.split('\f').map((t) => t.trim()).filter(Boolean);
  if (chunks.length < 8) {
    chunks = [];
    const approx = 3500;
    for (let i = 0; i < text.length; i += approx) {
      const slice = text.slice(i, i + approx).trim();
      if (slice) chunks.push(slice);
    }
  }
  return chunks.map((pageText, i) => ({
    pdfPage: i + 1,
    text: pageText.replace(/\n/g, ' ')
  }));
}

function loadOrDownloadPages(vol, skipDownload) {
  if (skipDownload && fs.existsSync(vol.pagesOut)) {
    return JSON.parse(fs.readFileSync(vol.pagesOut, 'utf-8'));
  }
  return null;
}

async function harvestVolume(vol, { skipDownload, givenSet }) {
  let pages = loadOrDownloadPages(vol, skipDownload);
  if (!pages) {
    console.error(`Downloading ${vol.iaId}_djvu.txt …`);
    const raw = await fetchText(vol.iaId);
    pages = splitDjvuIntoPages(raw);
    fs.writeFileSync(vol.pagesOut, JSON.stringify(pages, null, 2), 'utf-8');
    console.error(`  wrote ${path.relative(ROOT, vol.pagesOut)} (${pages.length} pages)`);
  } else {
    console.error(`Reusing cached ${path.relative(ROOT, vol.pagesOut)} (${pages.length} pages)`);
  }

  const register = decodeGenealogyRegister(pages, {
    givenSet,
    volume: vol.volume,
    defaultSection: vol.defaultSection
  });
  register.volume = vol.volume;
  register.year = vol.year;
  register.source = vol.sourcePdf;
  register.archiveUrl = vol.archiveUrl;
  register.iaId = vol.iaId;
  register.pageCount = pages.length;
  return { pages, register };
}

function familyHighlights(families = [], limit = 12) {
  return families
    .filter((f) => f.head)
    .slice(0, limit)
    .map((f) => ({
      section: f.section,
      sectionLabel: f.sectionLabel || SECTION_LABELS[f.section] || f.section,
      familyNo: f.familyNo,
      familyKey: f.familyKey,
      head: f.head?.displayName || f.head?.given || null,
      wife: f.wives?.[0]?.displayName || null,
      children: (f.children || []).filter((c) => c.level === 1).length,
      pdfPage: f.pdfPage,
      parentFamilyNo: f.parentLink?.familyNo ?? null
    }));
}

async function main() {
  const skipDownload = argFlag('--skip-download');
  const write = argFlag('--write');
  const enrich = argFlag('--enrich');

  let laneData = fs.existsSync(LANE_DATA)
    ? JSON.parse(fs.readFileSync(LANE_DATA, 'utf-8'))
    : { nodes: [], links: [] };
  const index = buildNodeIndex(laneData);

  const volumeResults = [];
  for (const vol of VOLUMES) {
    const { register } = await harvestVolume(vol, { skipDownload, givenSet: index.givenSet });
    let plan = buildGenealogyCodePlan(register, laneData);
    let enrichStats = null;
    if (enrich) {
      const enriched = enrichLaneDataFromRegister(laneData, register, {
        plan,
        source: register.source
      });
      laneData = enriched.laneData;
      enrichStats = enriched.stats;
      plan = buildGenealogyCodePlan(register, laneData);
    }
    const applied = applyGenealogyCodePlan(laneData, plan);
    laneData = applied.laneData;
    const summary = summarizeRegister(plan, applied.stats);
    summary.volume = vol.volume;
    summary.year = vol.year;
    summary.source = register.source;
    summary.archiveUrl = register.archiveUrl;
    summary.iaId = register.iaId;
    summary.enrichment = enrichStats;
    fs.writeFileSync(vol.registerOut, JSON.stringify(summary, null, 2), 'utf-8');

    volumeResults.push({
      volume: vol.volume,
      year: vol.year,
      iaId: vol.iaId,
      archiveUrl: vol.archiveUrl,
      source: register.source,
      pageCount: register.pageCount,
      sections: Array.isArray(register.sections) ? register.sections : Object.keys(register.sections || {}),
      stats: summary.stats,
      enrichment: enrichStats,
      highlights: familyHighlights(register.families, 16),
      registerOut: path.relative(ROOT, vol.registerOut)
    });
  }

  const vol1 = fs.existsSync(VOL1_REGISTER) ? JSON.parse(fs.readFileSync(VOL1_REGISTER, 'utf-8')) : null;

  // Merge multi-volume family indexes into the public register document (Vol. I families stay primary).
  // Drop any previously merged Vol. II / III rows so re-runs do not duplicate.
  if (vol1 && Array.isArray(vol1.families)) {
    const vol1Only = vol1.families.filter((f) => !f.volume || f.volume === 1);
    const mergedFamilies = [...vol1Only];
    for (const vr of volumeResults) {
      const doc = JSON.parse(fs.readFileSync(path.join(ROOT, vr.registerOut), 'utf-8'));
      for (const f of doc.families || []) {
        mergedFamilies.push({ ...f, volume: vr.volume, source: vr.source });
      }
    }
    const merged = {
      ...vol1,
      volumes: [
        { volume: 1, year: 1891, source: vol1.source, archiveUrl: 'https://archive.org/details/lanegenealogies01chap', stats: vol1.stats },
        ...volumeResults.map((v) => ({
          volume: v.volume,
          year: v.year,
          source: v.source,
          archiveUrl: v.archiveUrl,
          stats: v.stats
        }))
      ],
      families: mergedFamilies,
      stats: {
        ...vol1.stats,
        multiVolumeFamilies: mergedFamilies.length,
        volumesDecoded: 1 + volumeResults.length
      }
    };
    fs.writeFileSync(VOL1_REGISTER, JSON.stringify(merged, null, 2), 'utf-8');
    fs.mkdirSync(path.dirname(PUBLIC_REGISTER), { recursive: true });
    fs.writeFileSync(PUBLIC_REGISTER, JSON.stringify(merged, null, 2), 'utf-8');
  }

  if (write) {
    const validation = validateLaneData(laneData);
    if (!validation.valid) {
      throw new Error(`Refusing to write laneData.json: ${validation.issues.length} validation issue(s)`);
    }
    fs.writeFileSync(LANE_DATA, JSON.stringify(laneData, null, 2), 'utf-8');
  }

  const report = {
    generatedAt: new Date().toISOString(),
    title: 'Lane Genealogies multi-volume deep research report',
    sources: [
      {
        volume: 1,
        year: 1891,
        iaId: 'lanegenealogies01chap',
        archiveUrl: 'https://archive.org/details/lanegenealogies01chap',
        stats: vol1?.stats || null
      },
      ...volumeResults.map((v) => ({
        volume: v.volume,
        year: v.year,
        iaId: v.iaId,
        archiveUrl: v.archiveUrl,
        pageCount: v.pageCount,
        sections: v.sections,
        stats: v.stats,
        enrichment: v.enrichment
      }))
    ],
    totals: {
      volumes: 1 + volumeResults.length,
      families:
        (vol1?.stats?.families || 0) + volumeResults.reduce((a, v) => a + (v.stats?.families || 0), 0),
      children:
        (vol1?.stats?.children || 0) + volumeResults.reduce((a, v) => a + (v.stats?.children || 0), 0),
      reviewItems:
        (vol1?.stats?.reviewItems || 0) + volumeResults.reduce((a, v) => a + (v.stats?.reviewItems || 0), 0)
    },
    volumeResults,
    notes: [
      'Vol. I decoded from local PDF lanegenealogies01chap.pdf via resolve:lane-genealogy-codes.',
      'Vol. II / III harvested from Internet Archive djvu.txt OCR (Fitts 1897 / 1902).',
      'Register people synthesized only when --enrich is set; OCR junk is filtered by isPlausibleRegisterPerson.'
    ]
  };
  fs.writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2), 'utf-8');
  console.log(
    JSON.stringify(
      {
        reportOut: path.relative(ROOT, REPORT_OUT),
        write,
        enrich,
        totals: report.totals,
        volumes: volumeResults.map((v) => ({
          volume: v.volume,
          families: v.stats?.families,
          sections: v.sections,
          pages: v.pageCount
        }))
      },
      null,
      2
    )
  );
}

try {
  await main();
} catch (error) {
  console.error(`harvest-lane-volumes-ia failed: ${error?.message || error}`);
  process.exit(1);
}
