import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let genealogyData = null;
let museumContent = null;

let lanePdfManifestCache = null;
let lanePdfCandidatesCache = null;
let lanePdfPortraitsCache = null;
let laneBookSayingsCache = null;

function loadLaneBookSayings() {
  if (laneBookSayingsCache !== null) return laneBookSayingsCache;
  try {
    const p = path.join(__dirname, '..', 'data', 'lane-book-sayings.json');
    laneBookSayingsCache = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    laneBookSayingsCache = { version: 0, source: '', entries: [] };
  }
  return laneBookSayingsCache;
}

function loadLanePdfManifest() {
  if (lanePdfManifestCache !== null) return lanePdfManifestCache;
  try {
    const manifestPath = path.join(__dirname, '..', 'data', 'lane-pdf-image-manifest.json');
    lanePdfManifestCache = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
  } catch {
    lanePdfManifestCache = null;
  }
  return lanePdfManifestCache;
}

function loadLanePdfPhotoCandidates() {
  if (lanePdfCandidatesCache !== null) return lanePdfCandidatesCache;
  try {
    const p = path.join(__dirname, '..', 'data', 'lane-pdf-photo-candidates.json');
    lanePdfCandidatesCache = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    lanePdfCandidatesCache = null;
  }
  return lanePdfCandidatesCache;
}

function loadLanePdfPersonPortraits() {
  if (lanePdfPortraitsCache !== null) return lanePdfPortraitsCache;
  try {
    const p = path.join(__dirname, '..', 'data', 'lane-pdf-person-portraits.json');
    lanePdfPortraitsCache = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    lanePdfPortraitsCache = null;
  }
  return lanePdfPortraitsCache;
}

/**
 * Bundle manifest, page-candidate join, and curated portraits for the Lane PDF gallery UI.
 */
export function getLanePdfGalleryData() {
  const manifest = loadLanePdfManifest();
  const candidates = loadLanePdfPhotoCandidates();
  const portraitsDoc = loadLanePdfPersonPortraits();

  const summary = manifest
    ? {
        generatedAt: manifest.generatedAt,
        sourcePdf: manifest.sourcePdf,
        pdfPageCount: manifest.pdfPageCount,
        extractedOkCount: manifest.extractedOkCount,
        skippedCount: manifest.skippedCount,
        listedImageSlots: manifest.listedImageSlots
      }
    : null;

  const creditDefault =
    (portraitsDoc && portraitsDoc.creditDefault) || 'Lane genealogy source book (digitized plates).';
  const rawPortraits = Array.isArray(portraitsDoc?.portraits) ? portraitsDoc.portraits : [];
  const portraits = rawPortraits
    .filter((p) => p && p.personId != null && (p.confirmed === undefined || p.confirmed === true))
    .map((p) => {
      const person = getPersonById(p.personId);
      const publicUrl =
        p.publicUrl ||
        (p.imageId ? `/family/assets/lane-pdf/${String(p.imageId)}.jpg` : '');
      return {
        personId: Number(p.personId),
        imageId: p.imageId || null,
        publicUrl,
        credit: p.credit || creditDefault,
        notes: p.notes || '',
        personName: person?.name || null
      };
    });

  return {
    summary,
    creditDefault,
    candidatesStats: candidates?.stats || null,
    images: candidates?.images || [],
    portraits
  };
}

/**
 * Curated book portraits for a single person (confirmed entries only).
 */
export function getLanePdfPortraitsForPerson(personId) {
  const doc = loadLanePdfPersonPortraits();
  if (!doc || !Array.isArray(doc.portraits)) return [];
  const pid = parseInt(personId, 10);
  if (Number.isNaN(pid)) return [];
  const creditDefault = doc.creditDefault || '';
  return doc.portraits
    .filter(
      (p) =>
        p &&
        Number(p.personId) === pid &&
        (p.confirmed === undefined || p.confirmed === true)
    )
    .map((p) => ({
      personId: pid,
      imageId: p.imageId || null,
      publicUrl: p.publicUrl || (p.imageId ? `/family/assets/lane-pdf/${String(p.imageId)}.jpg` : ''),
      credit: p.credit || creditDefault,
      notes: p.notes || ''
    }));
}

const WAR_DEFINITIONS = {
  'king-philips-war': {
    slug: 'king-philips-war',
    label: "King Philip's War",
    years: [1675, 1678],
    keywords: [
      "king philip's war",
      "philip's indian war",
      'king philips war',
      'metacom',
      'capt. turner',
      'capt. poole'
    ]
  },
  'revolutionary-war': {
    slug: 'revolutionary-war',
    label: 'Revolutionary War',
    years: [1775, 1783],
    keywords: [
      'revolutionary',
      'revolutionary war',
      'the revolution',
      'continental',
      'bunker hill',
      'lexington',
      'concord',
      'west point'
    ]
  }
};

const DEFAULT_MUSEUM_CONTENT = {
  featuredStory: {
    slug: 'william-e-lane-boston',
    title: 'Exhibit 1: William Lane of Boston',
    subtitle: 'Opening the Lane story in chronological order',
    personQuery: {
      preferredNames: ['William E Lane', 'William Lane'],
      fallbackKeywords: ['William', 'Boston']
    },
    summary:
      'William Lane of Boston (cordwainer) anchors the opening exhibit; the museum narrative continues through later Lane generations.',
    historianNotes: [
      'Verify Hartford / Lynn harmonization and NEHGR XII:196 against original register and town records.',
      'Use this exhibit as the chronology baseline for future stories, including Lane Crater.'
    ],
    citations: [{ label: 'Lane genealogy source book', kind: 'book' }]
  },
  prominentLanes: [
    {
      order: 1,
      personId: 4,
      displayName: 'William Lane of Boston',
      personQuery: 'William Lane',
      caption: 'Opening exhibit · colonial chronology anchor',
      eraLabel: 'Colonial Boston · 17th century',
      blurb:
        'Book narrative: Hartford (Samuel b. 8 Aug. 1648), Lynn (1651), freeman 1657; Mary d. 1656; marriage to Mary Brewer — see Hist. Gen. Reg. XII, 196.',
      imageUrl: '/family/assets/william-e-lane-boston-hero.png',
      imageCaption: 'Portrait plate (book materials).',
      imageCredit: 'Lane family / genealogy compilation',
      links: [
        {
          label: 'NEHGR XII:196 — citation in Lane genealogy narrative',
          kind: 'book'
        }
      ]
    }
  ],
  media: [
    {
      id: 'exhibit1-hero',
      storySlug: 'william-e-lane-boston',
      type: 'image',
      url: '/family/assets/william-e-lane-boston-hero.png',
      caption: 'William Lane of Boston — portrait from book materials',
      credit: 'Lane family / genealogy compilation'
    },
    {
      id: 'exhibit1-map',
      storySlug: 'william-e-lane-boston',
      type: 'image',
      url: '/family/assets/boston-map-placeholder.jpg',
      caption: 'Map context for Boston-era Lane history',
      credit: 'Pending map source'
    }
  ],
  timelineEvents: [
    {
      year: 1625,
      title: 'Chronology Start',
      description: 'William E Lane of Boston is used as the opening narrative anchor.',
      kind: 'family'
    },
    {
      year: 1770,
      title: 'American History Context',
      description: 'Colonial tensions shape New England family life and migration patterns.',
      kind: 'history'
    }
  ],
  themes: {
    defaultTheme: 'museumDark',
    available: [
      { id: 'museumDark', label: 'Museum Dark' },
      { id: 'archiveLight', label: 'Archival Light' }
    ]
  },
  aiDocent: {
    personaName: 'American History + Lane Expert',
    intro:
      'I focus on Lane lineage chronology and historical context, starting with William E Lane of Boston.',
    promptChips: [
      'Who was William E Lane of Boston, and why is he the opening figure?',
      'Show the next major Lane events in chronological order.',
      'Connect this exhibit to wider American history.'
    ]
  },
  /** Optional: Lane lunar crater “observatory” panel (see lane-museum-content.json). */
  lunarExhibit: null
};

/**
 * Load genealogy data from laneData.json
 */
export function loadGenealogyData() {
  try {
    const dataPath = path.join(__dirname, '..', 'data', 'laneData.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    genealogyData = JSON.parse(rawData);
    console.log(`✅ Genealogy data loaded: ${genealogyData.nodes.length} people, ${genealogyData.links.length} relationships`);
    return genealogyData;
  } catch (error) {
    console.error('❌ Error loading genealogy data:', error.message);
    return null;
  }
}

/**
 * Load curated museum content for genealogy storytelling pages.
 */
export function loadMuseumContent() {
  try {
    const dataPath = path.join(__dirname, '..', 'data', 'lane-museum-content.json');
    const rawData = fs.readFileSync(dataPath, 'utf-8');
    museumContent = {
      ...DEFAULT_MUSEUM_CONTENT,
      ...JSON.parse(rawData)
    };
    return museumContent;
  } catch (error) {
    console.warn('⚠️ Could not load lane-museum-content.json, using defaults:', error.message);
    museumContent = DEFAULT_MUSEUM_CONTENT;
    return museumContent;
  }
}

function normalizeLoose(value = '') {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function compactUnique(values = []) {
  const out = [];
  const seen = new Set();
  for (const value of values) {
    const s = String(value || '').trim();
    if (!s) continue;
    const key = normalizeLoose(s);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function hasKeyword(haystack, keywords = []) {
  const h = normalizeLoose(haystack);
  if (!h) return false;
  return keywords.some((kw) => h.includes(normalizeLoose(kw)));
}

function extractMilitaryEvidence(node = {}) {
  const evidence = [];
  const occupation = Array.isArray(node.occupation) ? node.occupation : [];
  for (const occ of occupation) {
    if (!occ || typeof occ !== 'object') continue;
    if (occ.text) evidence.push(String(occ.text));
    const service = Array.isArray(occ.service) ? occ.service : [];
    for (const svc of service) {
      if (!svc || typeof svc !== 'object') continue;
      if (svc.text) evidence.push(String(svc.text));
      if (svc.war) evidence.push(String(svc.war));
      const wars = Array.isArray(svc.wars) ? svc.wars : [];
      for (const warObj of wars) {
        if (!warObj || typeof warObj !== 'object') continue;
        if (warObj.war) evidence.push(String(warObj.war));
        if (warObj.text) evidence.push(String(warObj.text));
      }
    }
  }
  const facts = node.importMeta?.ocrFacts;
  if (facts && Array.isArray(facts.military)) {
    for (const item of facts.military) evidence.push(String(item));
  }
  if (node.text) evidence.push(String(node.text));
  return compactUnique(evidence);
}

function extractParticipantPlaces(node = {}) {
  const places = [];
  if (node.born) places.push(node.born);
  if (node.deathPlace) places.push(node.deathPlace);
  if (node.burial) places.push(node.burial);
  if (Array.isArray(node.locations)) {
    for (const loc of node.locations) places.push(loc);
  }
  return compactUnique(places);
}

function scoreWarMatch(node, warDef) {
  const evidence = extractMilitaryEvidence(node);
  let structured = false;
  let semiStructured = false;
  let textOnly = false;

  const occupation = Array.isArray(node.occupation) ? node.occupation : [];
  for (const occ of occupation) {
    if (!occ || typeof occ !== 'object') continue;
    const service = Array.isArray(occ.service) ? occ.service : [];
    for (const svc of service) {
      if (!svc || typeof svc !== 'object') continue;
      if (svc.war && hasKeyword(svc.war, warDef.keywords)) structured = true;
      if (Array.isArray(svc.wars)) {
        for (const w of svc.wars) {
          if (w?.war && hasKeyword(w.war, warDef.keywords)) structured = true;
        }
      }
      if (svc.text && hasKeyword(svc.text, warDef.keywords)) semiStructured = true;
    }
    if (occ.text && hasKeyword(occ.text, warDef.keywords)) semiStructured = true;
  }

  if (!structured && !semiStructured) {
    const facts = node.importMeta?.ocrFacts;
    if (Array.isArray(facts?.military) && facts.military.some((m) => hasKeyword(m, warDef.keywords))) {
      semiStructured = true;
    }
  }
  if (!structured && !semiStructured && hasKeyword(node.text || '', warDef.keywords)) {
    textOnly = true;
  }

  if (!structured && !semiStructured && !textOnly) {
    return null;
  }

  let confidence = 'low';
  if (structured) confidence = 'high';
  else if (semiStructured) confidence = 'medium';

  const matchedEvidence = evidence.filter((line) => hasKeyword(line, warDef.keywords)).slice(0, 8);

  return {
    confidence,
    evidence: matchedEvidence.length ? matchedEvidence : evidence.slice(0, 4)
  };
}

function scorePersonForQuery(person = {}, query = {}) {
  const name = normalizeLoose(person.name);
  const born = normalizeLoose(person.born);
  const text = normalizeLoose(person.text);
  let score = 0;

  for (const preferred of query.preferredNames || []) {
    const p = normalizeLoose(preferred);
    if (!p) continue;
    if (name === p) score += 100;
    else if (name.includes(p)) score += 60;
  }
  for (const keyword of query.fallbackKeywords || []) {
    const k = normalizeLoose(keyword);
    if (!k) continue;
    if (name.includes(k)) score += 20;
    if (born.includes(k)) score += 8;
    if (text.includes(k)) score += 4;
  }
  return score;
}

function resolveFeaturedPerson(story = {}, people = []) {
  const query = story.personQuery || {};
  let best = null;
  let bestScore = -1;
  for (const person of people) {
    const score = scorePersonForQuery(person, query);
    if (score > bestScore) {
      best = person;
      bestScore = score;
    }
  }
  return bestScore > 0 ? best : null;
}

export function getMuseumContent() {
  if (!museumContent) {
    loadMuseumContent();
  }
  return museumContent;
}

/**
 * Curated / merged Lane book sayings for museum docent context (see data/lane-book-sayings.json).
 */
export function getLaneBookSayings() {
  return loadLaneBookSayings();
}

export function getFeaturedStory() {
  const content = getMuseumContent() || {};
  const story = content.featuredStory || {};
  const people = getAllPeople();
  const featuredPerson = resolveFeaturedPerson(story, people);
  return {
    ...story,
    featuredPerson
  };
}

export function getProminentLanes() {
  const content = getMuseumContent() || {};
  const people = getAllPeople();
  const entries = content.prominentLanes || [];
  const resolved = entries
    .map((entry) => {
      let person = null;
      const pid = entry.personId;
      if (pid != null && pid !== '' && Number.isFinite(Number(pid))) {
        const idNum = Number(pid);
        person = people.find((p) => Number(p.id) === idNum) || null;
      }
      if (!person) {
        const pq = String(entry.personQuery || '').toLowerCase().trim();
        if (pq) {
          person = people.find((p) => String(p.name || '').toLowerCase().includes(pq)) || null;
        }
      }
      return { ...entry, person };
    })
    .sort((a, b) => (a.order || 0) - (b.order || 0));

  // Fallback: show early generation members if curated entries do not resolve.
  const resolvedCount = resolved.filter((r) => r.person).length;
  if (!resolvedCount) {
    return people
      .slice()
      .sort((a, b) => {
        const ga = Number.isFinite(+a.generation) ? +a.generation : 999;
        const gb = Number.isFinite(+b.generation) ? +b.generation : 999;
        if (ga !== gb) return ga - gb;
        return (a.birthYear || 9999) - (b.birthYear || 9999);
      })
      .slice(0, 8)
      .map((person, idx) => ({
        order: idx + 1,
        caption: 'Chronological prominent Lane',
        eraLabel: person.birthYear ? `c. ${person.birthYear}` : 'Undated',
        person
      }));
  }

  return resolved;
}

export function getWarParticipants(warSlug) {
  const key = String(warSlug || '').toLowerCase();
  const war = WAR_DEFINITIONS[key];
  if (!war) return [];
  const people = getAllPeople();

  return people
    .map((person) => {
      const scored = scoreWarMatch(person, war);
      if (!scored) return null;
      return {
        warSlug: war.slug,
        warLabel: war.label,
        warYears: war.years,
        confidence: scored.confidence,
        person,
        evidence: scored.evidence,
        places: extractParticipantPlaces(person)
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const order = { high: 0, medium: 1, low: 2 };
      const c = order[a.confidence] - order[b.confidence];
      if (c !== 0) return c;
      const ay = parseInt(a.person.birthYear) || 9999;
      const by = parseInt(b.person.birthYear) || 9999;
      return ay - by;
    });
}

export function getWarCampaignsSummary() {
  const campaigns = Object.values(WAR_DEFINITIONS).map((war) => {
    const participants = getWarParticipants(war.slug);
    const counts = {
      high: participants.filter((p) => p.confidence === 'high').length,
      medium: participants.filter((p) => p.confidence === 'medium').length,
      low: participants.filter((p) => p.confidence === 'low').length
    };
    return {
      slug: war.slug,
      label: war.label,
      years: war.years,
      participantCount: participants.length,
      confidenceCounts: counts
    };
  });
  return { campaigns };
}

function titleCaseWords(value = '') {
  return String(value)
    .trim()
    .split(/\s+/)
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

/**
 * Aggregate distinct occupation.job values across the tree with participant lists.
 */
export function getOccupationSummary() {
  const people = getAllPeople();
  const byKey = new Map();
  let totalJobTags = 0;

  for (const person of people) {
    const occ = Array.isArray(person.occupation) ? person.occupation : [];
    for (const entry of occ) {
      if (!entry || typeof entry !== 'object') continue;
      const raw = entry.job;
      if (typeof raw !== 'string') continue;
      const trimmed = raw.trim();
      if (!trimmed) continue;
      totalJobTags += 1;
      const jobKey = trimmed.toLowerCase();

      if (!byKey.has(jobKey)) {
        byKey.set(jobKey, {
          jobKey,
          jobLabel: titleCaseWords(trimmed),
          seenIds: new Set(),
          people: []
        });
      }
      const bucket = byKey.get(jobKey);
      const id = person.id;
      if (bucket.seenIds.has(id)) continue;
      bucket.seenIds.add(id);
      bucket.people.push({
        id,
        name: person.name,
        birthYear: person.birthYear,
        deathYear: person.deathYear
      });
    }
  }

  const occupations = [...byKey.values()].map((bucket) => {
    const peopleList = bucket.people
      .slice()
      .sort((a, b) => {
        const ay = parseInt(a.birthYear, 10) || 9999;
        const by = parseInt(b.birthYear, 10) || 9999;
        if (ay !== by) return ay - by;
        return String(a.name || '').localeCompare(String(b.name || ''), undefined, { sensitivity: 'base' });
      });
    return {
      jobKey: bucket.jobKey,
      jobLabel: bucket.jobLabel,
      count: peopleList.length,
      people: peopleList
    };
  });

  occupations.sort((a, b) => {
    if (b.count !== a.count) return b.count - a.count;
    return String(a.jobLabel).localeCompare(String(b.jobLabel), undefined, { sensitivity: 'base' });
  });

  return {
    occupations,
    totalDistinctJobs: occupations.length,
    totalJobTags
  };
}

function extractOccupationLabels(person = {}) {
  const occ = Array.isArray(person.occupation) ? person.occupation : [];
  const labels = [];
  for (const entry of occ) {
    if (!entry || typeof entry !== 'object') continue;
    if (typeof entry.job === 'string' && entry.job.trim()) {
      labels.push(titleCaseWords(entry.job.trim()));
    }
  }
  return compactUnique(labels);
}

function extractWarLinks(person = {}) {
  const links = [];
  for (const war of Object.values(WAR_DEFINITIONS)) {
    const scored = scoreWarMatch(person, war);
    if (!scored) continue;
    links.push({
      warSlug: war.slug,
      warLabel: war.label,
      confidence: scored.confidence,
      evidence: scored.evidence.slice(0, 3)
    });
  }
  return links;
}

function summarizeDirectLinePerson(person = {}) {
  const spouses = getSpouses(person.id).filter(Boolean);
  const children = getChildren(person.id).filter(Boolean);
  const parents = getParents(person.id).filter((p) => p?.person);
  const occupations = extractOccupationLabels(person);
  const warLinks = extractWarLinks(person);

  const birthYear = person.birthYear || '?';
  const deathYear = person.deathYear || '?';
  const place = person.born || person.deathPlace || 'Location not recorded';
  const parentNames = parents.map((p) => p.person?.name).filter(Boolean);
  const narrativeParts = [
    `${person.name || 'Unknown'} (${birthYear} - ${deathYear}) is part of the direct ancestor line.`,
    `Place context: ${place}.`
  ];
  if (occupations.length) {
    narrativeParts.push(`Recorded occupations include ${occupations.slice(0, 3).join(', ')}.`);
  }
  if (warLinks.length) {
    narrativeParts.push(`War-linked evidence appears for ${warLinks.map((w) => w.warLabel).join(', ')}.`);
  }
  if (parentNames.length) {
    narrativeParts.push(`Parent record links: ${parentNames.join(' and ')}.`);
  }

  return {
    id: person.id,
    name: person.name,
    generation: person.generation,
    birthYear: person.birthYear,
    deathYear: person.deathYear,
    born: person.born || '',
    deathPlace: person.deathPlace || '',
    burial: person.burial || '',
    occupations,
    warLinks,
    spouses: spouses.map((s) => ({ id: s.id, name: s.name, birthYear: s.birthYear, deathYear: s.deathYear })),
    children: children.map((c) => ({ id: c.id, name: c.name, birthYear: c.birthYear, deathYear: c.deathYear })),
    parents: parents.map((p) => ({
      relation: p.relation,
      person: p.person
        ? { id: p.person.id, name: p.person.name, birthYear: p.person.birthYear, deathYear: p.person.deathYear }
        : null
    })),
    narrative: narrativeParts.join(' ')
  };
}

export function getDirectAncestorStory(startId = 112, order = 'oldest-first') {
  const anchor = getPersonById(startId);
  if (!anchor) return null;

  const visited = new Set();
  const chain = [];
  let current = anchor;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(summarizeDirectLinePerson(current));

    const parentLinks = getParents(current.id).filter((p) => p?.person);
    const father = parentLinks.find((p) => p.relation === 'father')?.person || null;
    const mother = parentLinks.find((p) => p.relation === 'mother')?.person || null;
    current = father || mother || null;
  }

  const orderedLine = order === 'newest-first' ? chain : chain.slice().reverse();
  return {
    startId: anchor.id,
    startPerson: { id: anchor.id, name: anchor.name, birthYear: anchor.birthYear, deathYear: anchor.deathYear },
    order: order === 'newest-first' ? 'newest-first' : 'oldest-first',
    directOnly: true,
    generations: orderedLine.length,
    line: orderedLine
  };
}

/**
 * Get all family data (nodes + links)
 */
export function getAllFamilyData() {
  if (!genealogyData) {
    loadGenealogyData();
  }
  return genealogyData;
}

/**
 * Get all family members (nodes only)
 */
export function getAllPeople() {
  if (!genealogyData) {
    loadGenealogyData();
  }
  return genealogyData?.nodes || [];
}

/**
 * Get person by ID
 */
export function getPersonById(id) {
  const people = getAllPeople();
  return people.find(person => person.id === parseInt(id));
}

/**
 * Search people by name
 */
export function searchPeople(query) {
  const people = getAllPeople();
  const lowerQuery = query.toLowerCase();
  return people.filter((person) => {
    const nm = (person.name || '').toLowerCase();
    const tt = (person.title || '').toLowerCase();
    return nm.includes(lowerQuery) || tt.includes(lowerQuery);
  });
}

/**
 * Get relationships for a person
 */
export function getRelationships(personId) {
  if (!genealogyData) {
    loadGenealogyData();
  }
  
  const id = parseInt(personId);
  const relationships = genealogyData.links.filter(link => 
    link.source === id || link.target === id
  );
  
  // Enrich with person data
  return relationships.map(rel => {
    const isSource = rel.source === id;
    const otherId = isSource ? rel.target : rel.source;
    const otherPerson = getPersonById(otherId);
    
    return {
      relation: rel.relation,
      person: otherPerson,
      direction: isSource ? 'from' : 'to'
    };
  });
}

/**
 * Get children of a person
 * Links are stored child -> parent (source = child, target = parent) for father/mother.
 */
export function getChildren(personId) {
  if (!genealogyData) {
    loadGenealogyData();
  }
  const id = parseInt(personId, 10);
  const childLinks = genealogyData.links.filter(
    (link) =>
      link.target === id && (link.relation === 'father' || link.relation === 'mother')
  );
  return childLinks.map((link) => getPersonById(link.source)).filter(Boolean);
}

/**
 * Get parents of a person
 */
export function getParents(personId) {
  if (!genealogyData) {
    loadGenealogyData();
  }
  
  const id = parseInt(personId);
  const parentLinks = genealogyData.links.filter(link => 
    link.source === id && (link.relation === 'father' || link.relation === 'mother')
  );
  
  return parentLinks.map(link => ({
    relation: link.relation,
    person: getPersonById(link.target)
  }));
}

/**
 * Get spouse(s) of a person
 */
export function getSpouses(personId) {
  const relationships = getRelationships(personId);
  return relationships.filter(rel => rel.relation === 'spouse')
    .map(rel => rel.person);
}

/**
 * Get siblings of a person (share same parents)
 */
export function getSiblings(personId) {
  const parents = getParents(personId);
  if (parents.length === 0) return [];
  
  // Get all children of these parents
  const allChildren = new Set();
  parents.forEach(parent => {
    const children = getChildren(parent.person.id);
    children.forEach(child => {
      if (child.id !== parseInt(personId)) {
        allChildren.add(JSON.stringify(child));
      }
    });
  });
  
  return Array.from(allChildren).map(child => JSON.parse(child));
}

/**
 * Map birth year to musical era
 */
export function getMusicalEra(birthYear) {
  const year = parseInt(birthYear);
  
  if (year < 1600) return { era: 'Medieval', period: 'Medieval/Renaissance', music: 'Gregorian Chant, Early Polyphony' };
  if (year < 1750) return { era: 'Baroque', period: 'Baroque Era', music: 'Bach, Vivaldi, Handel' };
  if (year < 1820) return { era: 'Classical', period: 'Classical Era', music: 'Mozart, Haydn, Early Beethoven' };
  if (year < 1900) return { era: 'Romantic', period: 'Romantic Era', music: 'Beethoven, Chopin, Wagner' };
  if (year < 1920) return { era: 'Early Modern', period: 'Ragtime & Early Jazz', music: 'Scott Joplin, Early Blues' };
  if (year < 1940) return { era: 'Jazz Age', period: 'Jazz & Swing Era', music: 'Louis Armstrong, Duke Ellington' };
  if (year < 1955) return { era: 'Big Band', period: 'Swing & Big Band', music: 'Glenn Miller, Frank Sinatra' };
  if (year < 1965) return { era: 'Rock Birth', period: 'Birth of Rock & Roll', music: 'Elvis, Chuck Berry, Little Richard' };
  if (year < 1975) return { era: 'Classic Rock', period: 'Classic Rock & Psychedelic', music: 'Beatles, Stones, Pink Floyd, Led Zeppelin' };
  if (year < 1985) return { era: 'Disco/Punk', period: 'Disco, Punk & Arena Rock', music: 'Bee Gees, Sex Pistols, Queen' };
  if (year < 1995) return { era: 'Hip-Hop Rise', period: 'Hip-Hop, Hair Metal & Grunge', music: 'Run-DMC, Metallica, Nirvana' };
  if (year < 2005) return { era: 'Digital Age', period: 'Pop, Hip-Hop & Electronic', music: 'Eminem, Beyoncé, Daft Punk' };
  return { era: 'Streaming Era', period: 'Digital Streaming Era', music: 'All genres accessible' };
}

/**
 * Get people alive during a specific year
 */
export function getPeopleAliveDuring(year) {
  const people = getAllPeople();
  return people.filter(person => {
    const birthYear = parseInt(person.birthYear);
    const deathYear = person.deathYear ? parseInt(person.deathYear) : new Date().getFullYear();
    return birthYear <= year && deathYear >= year;
  });
}

/**
 * Get people by generation
 */
export function getPeopleByGeneration(generation) {
  const people = getAllPeople();
  return people.filter(person => person.generation === parseInt(generation));
}

/**
 * Get statistics about the family tree
 */
export function getFamilyStats() {
  if (!genealogyData) {
    loadGenealogyData();
  }
  
  const people = genealogyData.nodes;
  const links = genealogyData.links;
  
  // Count by generation
  const generationCounts = {};
  people.forEach(person => {
    generationCounts[person.generation] = (generationCounts[person.generation] || 0) + 1;
  });
  
  // Count by gender
  const genderCounts = { M: 0, F: 0 };
  people.forEach(person => {
    genderCounts[person.gender] = (genderCounts[person.gender] || 0) + 1;
  });
  
  // Year range
  const birthYears = people.map(p => parseInt(p.birthYear)).filter(y => !isNaN(y));
  const minYear = Math.min(...birthYears);
  const maxYear = Math.max(...birthYears);
  
  return {
    totalPeople: people.length,
    totalRelationships: links.length,
    generationCounts,
    genderCounts,
    yearRange: { min: minYear, max: maxYear },
    timespan: maxYear - minYear
  };
}

// Initialize on import
loadGenealogyData();

export default {
  loadGenealogyData,
  loadMuseumContent,
  getAllFamilyData,
  getAllPeople,
  getPersonById,
  searchPeople,
  getRelationships,
  getChildren,
  getParents,
  getSpouses,
  getSiblings,
  getMusicalEra,
  getPeopleAliveDuring,
  getPeopleByGeneration,
  getFamilyStats,
  getMuseumContent,
  getFeaturedStory,
  getProminentLanes,
  getWarParticipants,
  getWarCampaignsSummary,
  getOccupationSummary,
  getDirectAncestorStory,
  getLanePdfGalleryData,
  getLanePdfPortraitsForPerson
};

