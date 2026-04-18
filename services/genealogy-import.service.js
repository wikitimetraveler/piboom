import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']);

function normalizeName(value = '') {
  return value
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function titleCaseName(value = '') {
  return value
    .toLowerCase()
    .split(' ')
    .filter(Boolean)
    .map(token => token.charAt(0).toUpperCase() + token.slice(1))
    .join(' ');
}

/** OCR often reads a leading 1 in years as Roman I or lowercase l (e.g. "I 778" -> 1778). */
export function repairOcrRomanYears(text = '') {
  return String(text).replace(/\b[Il]\s+(\d{3})\b/g, (_, triple) => {
    const y = 1000 + parseInt(triple, 10);
    if (y >= 1500 && y <= 1999) return String(y);
    return `I ${triple}`;
  });
}

export function splitPrimarySpouseSegments(text = '') {
  const s = String(text);
  const lower = s.toLowerCase();
  const re = /\b(?:she|he)\s+married\b|\bwas\s+wife\s+of\b|\bwas\s+husband\s+of\b/;
  const m = re.exec(lower);
  if (!m) return { primary: s.trim(), spouse: '' };
  const idx = m.index;
  return { primary: s.slice(0, idx).trim(), spouse: s.slice(idx + m[0].length).trim() };
}

export function parseBirthYear(text = '') {
  const repaired = repairOcrRomanYears(text);
  const { primary } = splitPrimarySpouseSegments(repaired);
  const b = primary.match(/\bb\.\s*.*?\b(1[5-9]\d{2}|20\d{2})\b/i);
  if (b) return parseInt(b[1], 10);
  const born = primary.match(/\bborn\s*.*?\b(1[5-9]\d{2}|20\d{2})\b/i);
  if (born) return parseInt(born[1], 10);
  const deathMatch = primary.match(/(?:\bd\.|\bdied)\s*[:,;]?\s*.*?\b(1[5-9]\d{2}|20\d{2})\b/i);
  const deathY = deathMatch ? parseInt(deathMatch[1], 10) : null;
  const yearRe = /\b(1[5-9]\d{2}|20\d{2})\b/g;
  let m;
  while ((m = yearRe.exec(primary)) !== null) {
    const y = parseInt(m[1], 10);
    if (deathY === null || y !== deathY) return y;
  }
  return null;
}

export function parseChildLine(text = '') {
  const candidate = text
    .replace(/^\s*(?:\(?\d+\)?|[IVXLCDM]+)\.\s*/i, '')
    .trim();

  const parts = candidate.split(',');
  if (!parts.length) return null;

  const rawName = parts[0].replace(/\[[^\]]+\]/g, '').trim();
  const name = titleCaseName(rawName);
  if (!name || name.length < 3) return null;

  const birthYear = parseBirthYear(candidate);
  return {
    name,
    birthYear,
    sourceText: text
  };
}

function parseAncestorHeader(text = '') {
  const match = text.match(/^\s*([A-Z][A-Z\s'.-]+?)\b[^.]*\bhad\b/i);
  if (!match) return null;
  const name = titleCaseName(match[1]);
  return name.length >= 3 ? name : null;
}

function parseSpouseContext(text = '') {
  const match = text.match(/\bby (?:his|her) [^,;:]* wife\s+([A-Z][A-Z\s'.()-]+)/i);
  if (!match) return null;
  const cleaned = match[1].replace(/\[[^\]]+\]/g, ' ').trim();
  const name = titleCaseName(cleaned);
  return name.length >= 3 ? name : null;
}

/**
 * OCR intermediate format contract:
 * {
 *   pageNumber: number,
 *   sourceImageName: string,
 *   sourceMimeType: string,
 *   sourceSizeBytes: number,
 *   extraction: {
 *     method: 'provided-ocr' | 'pending-ocr',
 *     lines: [{ text: string, confidence: number, lineNumber: number }]
 *   }
 * }
 */
export function defineOcrIntermediateContract(files = [], providedOcrPages = []) {
  return files.map((file, index) => {
    const providedPage = Array.isArray(providedOcrPages) ? providedOcrPages[index] : null;
    const providedLines = Array.isArray(providedPage?.lines) ? providedPage.lines : [];
    const lines = providedLines
      .map((line, lineIndex) => ({
        text: String(line?.text || '').trim(),
        confidence: typeof line?.confidence === 'number' ? line.confidence : 0.7,
        lineNumber: lineIndex + 1
      }))
      .filter(line => line.text.length > 0);

    return {
      pageNumber: index + 1,
      sourceImageName: file.originalname,
      sourceMimeType: file.mimetype,
      sourceSizeBytes: file.size,
      extraction: {
        method: lines.length ? 'provided-ocr' : 'pending-ocr',
        lines
      }
    };
  });
}

export function parsePeopleFromOcrContract(ocrPages = []) {
  const personMap = new Map();
  const parsedRelationships = [];
  const reviewQueue = [];
  let contextFatherKey = null;
  let contextMotherKey = null;

  function ensurePerson(name, birthYear = null) {
    const normalized = normalizeName(name);
    if (!normalized) return null;
    const key = `${normalized}|${birthYear || 'unknown'}`;
    if (!personMap.has(key)) {
      personMap.set(key, {
        key,
        normalized,
        name: titleCaseName(name),
        birthYear: birthYear || null,
        sources: []
      });
    }
    return personMap.get(key);
  }

  for (const page of ocrPages) {
    if (!Array.isArray(page.extraction?.lines) || page.extraction.lines.length === 0) {
      reviewQueue.push({
        type: 'page',
        pageNumber: page.pageNumber,
        reason: 'No OCR lines available',
        severity: 'high'
      });
      continue;
    }

    for (const line of page.extraction.lines) {
      const text = line.text.trim();
      if (!text) continue;

      const ancestor = parseAncestorHeader(text);
      if (ancestor) {
        const ancestorBirthYear = parseBirthYear(text);
        const ancestorNode = ensurePerson(ancestor, ancestorBirthYear);
        if (ancestorNode) {
          ancestorNode.sources.push({ pageNumber: page.pageNumber, lineNumber: line.lineNumber, confidence: line.confidence });
          contextFatherKey = ancestorNode.key;
          contextMotherKey = null;
        }
      }

      const spouseName = parseSpouseContext(text);
      if (spouseName) {
        const spouseBirthYear = parseBirthYear(text);
        const spouseNode = ensurePerson(spouseName, spouseBirthYear);
        if (spouseNode) {
          spouseNode.sources.push({ pageNumber: page.pageNumber, lineNumber: line.lineNumber, confidence: line.confidence });
          contextMotherKey = spouseNode.key;
          if (contextFatherKey) {
            parsedRelationships.push({
              relation: 'spouse',
              childKey: contextFatherKey,
              parentKey: contextMotherKey,
              confidenceSignals: {
                nameConfidence: line.confidence,
                temporalSanity: true,
                contextConfirmation: true
              },
              source: { pageNumber: page.pageNumber, lineNumber: line.lineNumber }
            });
          }
        }
      }

      if (/^\s*(?:\(?\d+\)?|[IVXLCDM]+)\./i.test(text)) {
        const parsedChild = parseChildLine(text);
        if (!parsedChild) {
          reviewQueue.push({
            type: 'child-line',
            pageNumber: page.pageNumber,
            lineNumber: line.lineNumber,
            reason: 'Could not parse child line',
            sourceText: text
          });
          continue;
        }

        const childNode = ensurePerson(parsedChild.name, parsedChild.birthYear);
        if (!childNode) continue;
        childNode.sources.push({ pageNumber: page.pageNumber, lineNumber: line.lineNumber, confidence: line.confidence });

        if (contextFatherKey) {
          parsedRelationships.push({
            relation: 'father',
            childKey: childNode.key,
            parentKey: contextFatherKey,
            confidenceSignals: {
              nameConfidence: line.confidence,
              temporalSanity: true,
              contextConfirmation: true
            },
            source: { pageNumber: page.pageNumber, lineNumber: line.lineNumber }
          });
        }

        if (contextMotherKey) {
          parsedRelationships.push({
            relation: 'mother',
            childKey: childNode.key,
            parentKey: contextMotherKey,
            confidenceSignals: {
              nameConfidence: line.confidence,
              temporalSanity: true,
              contextConfirmation: true
            },
            source: { pageNumber: page.pageNumber, lineNumber: line.lineNumber }
          });
        }
      }
    }
  }

  return {
    people: Array.from(personMap.values()),
    relationshipCandidates: parsedRelationships,
    reviewQueue
  };
}

function temporalSanityPass(parentBirthYear, childBirthYear) {
  if (!parentBirthYear || !childBirthYear) return false;
  const delta = childBirthYear - parentBirthYear;
  return delta >= 13 && delta <= 80;
}

export function buildStrictLinks(parsedPeople = [], relationshipCandidates = []) {
  const personByKey = new Map(parsedPeople.map(p => [p.key, p]));
  const accepted = [];
  const rejected = [];
  const dedupe = new Set();

  for (const candidate of relationshipCandidates) {
    const child = personByKey.get(candidate.childKey);
    const parent = personByKey.get(candidate.parentKey);
    if (!child || !parent) {
      rejected.push({
        ...candidate,
        reason: 'Missing parent or child node'
      });
      continue;
    }

    const nameConfidence = candidate.confidenceSignals?.nameConfidence ?? 0;
    const contextConfirmation = Boolean(candidate.confidenceSignals?.contextConfirmation);
    const temporalSanity = candidate.relation === 'spouse' ? true : temporalSanityPass(parent.birthYear, child.birthYear);

    if (nameConfidence < 0.7 || !contextConfirmation || !temporalSanity) {
      rejected.push({
        ...candidate,
        reason: 'Strict confidence gate failed',
        gate: { nameConfidence, contextConfirmation, temporalSanity }
      });
      continue;
    }

    const key = `${candidate.relation}:${candidate.childKey}:${candidate.parentKey}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    accepted.push(candidate);
  }

  return { accepted, rejected };
}

export function emitLaneDataJson(people = [], acceptedLinks = []) {
  const nodes = people.map((person, index) => ({
    name: person.name,
    id: index,
    text: '',
    generation: 0,
    gender: 'U',
    lastName: '',
    birthYear: person.birthYear || '',
    deathYear: '',
    birthDate: '',
    deathDate: '',
    born: '',
    deathPlace: '',
    burial: ''
  }));
  const nodeIdByKey = new Map();
  people.forEach((person, index) => nodeIdByKey.set(person.key, index));

  const links = [];
  const seenSpousePairs = new Set();
  for (const rel of acceptedLinks) {
    const source = nodeIdByKey.get(rel.childKey);
    const target = nodeIdByKey.get(rel.parentKey);
    if (typeof source !== 'number' || typeof target !== 'number') continue;

    if (rel.relation === 'spouse') {
      const pairKey = source < target ? `${source}|${target}` : `${target}|${source}`;
      if (seenSpousePairs.has(pairKey)) continue;
      seenSpousePairs.add(pairKey);
    }

    links.push({
      source,
      target,
      color: rel.relation === 'father' ? '#39F' : rel.relation === 'mother' ? '#F39' : '#CC0',
      relation: rel.relation
    });
  }

  return { nodes, links };
}

export function validateLaneData(laneData) {
  const issues = [];
  const nodeIds = new Set();

  for (const node of laneData.nodes) {
    if (nodeIds.has(node.id)) {
      issues.push({ severity: 'error', reason: 'Duplicate node id', id: node.id });
    }
    nodeIds.add(node.id);
  }

  for (const link of laneData.links) {
    if (!nodeIds.has(link.source) || !nodeIds.has(link.target)) {
      issues.push({
        severity: 'error',
        reason: 'Link references missing node id',
        link
      });
    }
    if (!['father', 'mother', 'spouse'].includes(link.relation)) {
      issues.push({
        severity: 'error',
        reason: 'Unsupported relation',
        relation: link.relation
      });
    }
  }

  return {
    valid: issues.filter(i => i.severity === 'error').length === 0,
    issues
  };
}

export async function writeImportArtifact(laneData, suffix = 'latest') {
  const outputPath = path.join(__dirname, '..', 'data', `genealogy-import-${suffix}.json`);
  await fs.writeFile(outputPath, JSON.stringify(laneData, null, 2), 'utf-8');
  return outputPath;
}

export function summarizeGenealogyImageImport(files = [], providedOcrPages = []) {
  const acceptedFiles = [];
  const rejectedFiles = [];

  for (const file of files) {
    const isImage = IMAGE_MIME_TYPES.has(file.mimetype) || String(file.mimetype || '').startsWith('image/');
    if (!isImage) {
      rejectedFiles.push({
        name: file.originalname,
        mimetype: file.mimetype || 'unknown',
        reason: 'Unsupported file type'
      });
      continue;
    }
    acceptedFiles.push(file);
  }

  const ocrContractPages = defineOcrIntermediateContract(acceptedFiles, providedOcrPages);
  const parsed = parsePeopleFromOcrContract(ocrContractPages);
  const strictLinks = buildStrictLinks(parsed.people, parsed.relationshipCandidates);
  const laneData = emitLaneDataJson(parsed.people, strictLinks.accepted);
  const validation = validateLaneData(laneData);

  return {
    acceptedCount: acceptedFiles.length,
    rejectedCount: rejectedFiles.length,
    rejectedFiles,
    ocrPages: ocrContractPages,
    parsed,
    strictLinks,
    laneData,
    validation
  };
}

export default {
  defineOcrIntermediateContract,
  parsePeopleFromOcrContract,
  buildStrictLinks,
  emitLaneDataJson,
  validateLaneData,
  summarizeGenealogyImageImport,
  writeImportArtifact,
  repairOcrRomanYears,
  splitPrimarySpouseSegments,
  parseBirthYear,
  parseChildLine
};
