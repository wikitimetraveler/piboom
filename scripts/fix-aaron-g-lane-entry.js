/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dataDir = path.join(__dirname, '..', 'data');
const laneDataPath = path.join(dataDir, 'laneData.json');
const reportPath = path.join(dataDir, 'lane-military-deep-scan-report.json');

const WIKI_NOTE =
  "Lane's Crossing (San Bernardino County, California) was a ford and traveler stop on the Mormon Road at the Mojave River, established in 1859 by Captain Aaron G. Lane, a veteran of the Mexican-American War and Forty-niner.";

function updateLaneData() {
  const doc = JSON.parse(fs.readFileSync(laneDataPath, 'utf8'));
  const nodes = Array.isArray(doc.nodes) ? doc.nodes : [];
  const node = nodes.find((n) => Number(n?.id) === 1024);
  if (!node) return false;

  node.name = 'Aaron G. Lane';
  node.lastName = 'Lane';
  node.gender = 'M';
  node.birthYear = 1817;
  node.deathYear = node.deathYear || 1883;
  node.born = 'New Hampshire, USA';
  node.deathPlace = "Lane's Crossing, Mojave River, San Bernardino County, California, USA";

  const textParts = [
    String(node.text || '').trim(),
    WIKI_NOTE
  ].filter(Boolean);
  node.text = Array.from(new Set(textParts)).join(' ');

  const locations = Array.isArray(node.locations) ? node.locations : [];
  const desiredLocations = [
    "Lane's Crossing",
    'Mojave River',
    'San Bernardino County',
    'California',
    'Halleck'
  ];
  node.locations = Array.from(
    new Set(
      [...locations, ...desiredLocations]
        .map((x) => String(x || '').trim())
        .filter(Boolean)
    )
  );

  fs.writeFileSync(laneDataPath, `${JSON.stringify(doc, null, 2)}\n`, 'utf8');
  return true;
}

function updateReport() {
  const report = JSON.parse(fs.readFileSync(reportPath, 'utf8'));
  let touched = 0;
  for (const conflict of Array.isArray(report.conflicts) ? report.conflicts : []) {
    for (const participant of Array.isArray(conflict.participants) ? conflict.participants : []) {
      if (Number(participant?.id) !== 1024) continue;
      participant.name = 'Aaron G. Lane';
      const evidence = Array.isArray(participant.evidence) ? participant.evidence : [];
      const merged = Array.from(new Set([...evidence, WIKI_NOTE])).filter(Boolean);
      participant.evidence = merged;
      touched += 1;
    }
  }
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return touched;
}

const laneDataOk = updateLaneData();
const reportRows = updateReport();
process.stdout.write(
  JSON.stringify(
    {
      ok: laneDataOk,
      reportRowsUpdated: reportRows
    },
    null,
    2
  ) + '\n'
);
