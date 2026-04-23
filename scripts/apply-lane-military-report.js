import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const laneDataPath = path.join(dataDir, 'laneData.json');
const reportPath = path.join(dataDir, 'lane-military-deep-scan-report.json');

function normalizeString(value) {
  return String(value || '').trim();
}

function normalizeEvidenceList(list) {
  const seen = new Set();
  const out = [];
  for (const item of Array.isArray(list) ? list : []) {
    const text = normalizeString(item);
    if (!text) continue;
    const key = text.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out.slice(0, 8);
}

function parseReport(fileText) {
  const raw = String(fileText || '');
  const start = raw.indexOf('{');
  if (start < 0) throw new Error('Report JSON start token not found.');
  return JSON.parse(raw.slice(start));
}

function mergeEngagement(existing, incoming) {
  const key = `${incoming.warSlug}::${incoming.associationType || 'service-member'}`;
  const list = Array.isArray(existing) ? existing : [];
  const idx = list.findIndex((entry) => {
    if (!entry || typeof entry !== 'object') return false;
    const warSlug = normalizeString(entry.warSlug);
    const associationType = normalizeString(entry.associationType || 'service-member');
    return `${warSlug}::${associationType}` === key;
  });

  if (idx === -1) return [...list, incoming];

  const prior = list[idx] || {};
  const merged = {
    ...prior,
    ...incoming,
    confidence:
      prior.confidence === 'high' || incoming.confidence === 'high'
        ? 'high'
        : prior.confidence === 'medium' || incoming.confidence === 'medium'
          ? 'medium'
          : incoming.confidence || prior.confidence || 'low',
    evidence: normalizeEvidenceList([...(prior.evidence || []), ...(incoming.evidence || [])])
  };
  const next = list.slice();
  next[idx] = merged;
  return next;
}

function main() {
  const laneData = JSON.parse(fs.readFileSync(laneDataPath, 'utf8'));
  const report = parseReport(fs.readFileSync(reportPath, 'utf8'));
  const nodes = Array.isArray(laneData.nodes) ? laneData.nodes : [];
  const idToNode = new Map(nodes.map((n) => [Number(n?.id), n]));

  let conflictEntries = 0;
  let nodesTouched = 0;
  const touched = new Set();

  for (const conflict of Array.isArray(report.conflicts) ? report.conflicts : []) {
    const warSlug = normalizeString(conflict.slug);
    const warLabel = normalizeString(conflict.label);
    for (const participant of Array.isArray(conflict.participants) ? conflict.participants : []) {
      const id = Number(participant?.id);
      const node = idToNode.get(id);
      if (!node) continue;
      const incoming = {
        warSlug,
        warLabel,
        confidence: normalizeString(participant.confidence || 'low').toLowerCase(),
        associationType: normalizeString(participant.associationType || 'service-member'),
        evidence: normalizeEvidenceList(participant.evidence || []),
        source: 'lane-military-deep-scan-report'
      };
      node.militaryEngagements = mergeEngagement(node.militaryEngagements, incoming);
      conflictEntries += 1;
      if (!touched.has(id)) {
        touched.add(id);
        nodesTouched += 1;
      }
    }
  }

  fs.writeFileSync(laneDataPath, `${JSON.stringify(laneData, null, 2)}\n`, 'utf8');
  process.stdout.write(
    JSON.stringify(
      {
        ok: true,
        nodes: nodes.length,
        nodesTouched,
        conflictEntriesMerged: conflictEntries
      },
      null,
      2
    ) + '\n'
  );
}

main();
