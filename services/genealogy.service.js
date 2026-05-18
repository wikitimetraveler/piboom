/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  backfillLaneDataFromFilesystem,
  getAllLaneDatasetsFromPostgres,
  getLaneGraphDataFromPostgres
} from './lane-postgres.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let genealogyData = null;
let museumContent = null;

let lanePdfManifestCache = null;
let lanePdfCandidatesCache = null;
let lanePdfPortraitsCache = null;
let lanePdfGalleryHiddenCache = null;
let lanePdfBookIllustrationsCache = null;
let laneBookSayingsCache = null;
let laneDatasetsCache = {};
let lanePostgresHydratedAt = null;
const LANE_PDF_ALWAYS_VISIBLE_IDS = new Set(['p4-i0']);

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function cloneJson(value) {
  if (value == null) return value;
  return JSON.parse(JSON.stringify(value));
}

function getLaneDatasetDoc(datasetKey) {
  const key = String(datasetKey || '').trim();
  if (!key) return null;
  const value = laneDatasetsCache[key];
  return isObject(value) ? cloneJson(value) : null;
}

/**
 * Hydrate in-memory genealogy/Lane caches from Postgres.
 * This keeps sync getter APIs intact while switching storage backend.
 */
export async function refreshGenealogyCachesFromPostgres(options = {}) {
  const { bootstrapFromFilesystem = true } = options || {};
  try {
    if (bootstrapFromFilesystem) {
      await backfillLaneDataFromFilesystem();
    }
    const [graph, datasets] = await Promise.all([
      getLaneGraphDataFromPostgres(),
      getAllLaneDatasetsFromPostgres()
    ]);

    if (graph && Array.isArray(graph.nodes) && Array.isArray(graph.links) && graph.nodes.length > 0) {
      genealogyData = graph;
    }
    laneDatasetsCache = isObject(datasets) ? datasets : {};

    const museumDoc = getLaneDatasetDoc('lane-museum-content');
    if (museumDoc) museumContent = { ...DEFAULT_MUSEUM_CONTENT, ...museumDoc };
    const sayingsDoc = getLaneDatasetDoc('lane-book-sayings');
    if (sayingsDoc) laneBookSayingsCache = sayingsDoc;
    const manifestDoc = getLaneDatasetDoc('lane-pdf-image-manifest');
    if (manifestDoc) lanePdfManifestCache = manifestDoc;
    const candidatesDoc = getLaneDatasetDoc('lane-pdf-photo-candidates');
    if (candidatesDoc) lanePdfCandidatesCache = candidatesDoc;
    const portraitsDoc = getLaneDatasetDoc('lane-pdf-person-portraits');
    if (portraitsDoc) lanePdfPortraitsCache = portraitsDoc;
    const hiddenDoc = getLaneDatasetDoc('lane-pdf-gallery-hidden');
    if (hiddenDoc) lanePdfGalleryHiddenCache = hiddenDoc;
    const illustrationsDoc = getLaneDatasetDoc('lane-pdf-book-illustrations');
    if (illustrationsDoc) lanePdfBookIllustrationsCache = illustrationsDoc;

    lanePostgresHydratedAt = new Date().toISOString();
    return {
      success: true,
      hydratedAt: lanePostgresHydratedAt,
      graphNodes: Array.isArray(genealogyData?.nodes) ? genealogyData.nodes.length : 0,
      datasetCount: Object.keys(laneDatasetsCache).length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}
let laneTradingCardsCache = null;

function loadLaneBookSayings() {
  if (laneBookSayingsCache !== null) return laneBookSayingsCache;
  const pgDoc = getLaneDatasetDoc('lane-book-sayings');
  if (pgDoc) {
    laneBookSayingsCache = pgDoc;
    return laneBookSayingsCache;
  }
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
  const pgDoc = getLaneDatasetDoc('lane-pdf-image-manifest');
  if (pgDoc) {
    lanePdfManifestCache = pgDoc;
    return lanePdfManifestCache;
  }
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
  const pgDoc = getLaneDatasetDoc('lane-pdf-photo-candidates');
  if (pgDoc) {
    lanePdfCandidatesCache = pgDoc;
    return lanePdfCandidatesCache;
  }
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
  const pgDoc = getLaneDatasetDoc('lane-pdf-person-portraits');
  if (pgDoc) {
    lanePdfPortraitsCache = pgDoc;
    return lanePdfPortraitsCache;
  }
  try {
    const p = path.join(__dirname, '..', 'data', 'lane-pdf-person-portraits.json');
    lanePdfPortraitsCache = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    lanePdfPortraitsCache = null;
  }
  return lanePdfPortraitsCache;
}

function loadLanePdfGalleryHidden() {
  if (lanePdfGalleryHiddenCache !== null) return lanePdfGalleryHiddenCache;
  const pgDoc = getLaneDatasetDoc('lane-pdf-gallery-hidden');
  if (pgDoc) {
    lanePdfGalleryHiddenCache = pgDoc;
  }
  if (lanePdfGalleryHiddenCache !== null) {
    if (!lanePdfGalleryHiddenCache || !Array.isArray(lanePdfGalleryHiddenCache.hiddenImageIds)) {
      lanePdfGalleryHiddenCache = { version: 0, hiddenImageIds: [] };
    }
    return lanePdfGalleryHiddenCache;
  }
  try {
    const p = path.join(__dirname, '..', 'data', 'lane-pdf-gallery-hidden.json');
    lanePdfGalleryHiddenCache = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    lanePdfGalleryHiddenCache = { version: 0, hiddenImageIds: [] };
  }
  if (!lanePdfGalleryHiddenCache || !Array.isArray(lanePdfGalleryHiddenCache.hiddenImageIds)) {
    lanePdfGalleryHiddenCache = { version: 0, hiddenImageIds: [] };
  }
  return lanePdfGalleryHiddenCache;
}

function loadLanePdfBookIllustrations() {
  if (lanePdfBookIllustrationsCache !== null) return lanePdfBookIllustrationsCache;
  const pgDoc = getLaneDatasetDoc('lane-pdf-book-illustrations');
  if (pgDoc) {
    lanePdfBookIllustrationsCache = pgDoc;
  }
  if (lanePdfBookIllustrationsCache !== null) {
    if (!lanePdfBookIllustrationsCache || !Array.isArray(lanePdfBookIllustrationsCache.illustrations)) {
      lanePdfBookIllustrationsCache = { version: 0, illustrations: [] };
    }
    return lanePdfBookIllustrationsCache;
  }
  try {
    const p = path.join(__dirname, '..', 'data', 'lane-pdf-book-illustrations.json');
    lanePdfBookIllustrationsCache = JSON.parse(fs.readFileSync(p, 'utf-8'));
  } catch {
    lanePdfBookIllustrationsCache = { version: 0, illustrations: [] };
  }
  if (!lanePdfBookIllustrationsCache || !Array.isArray(lanePdfBookIllustrationsCache.illustrations)) {
    lanePdfBookIllustrationsCache = { version: 0, illustrations: [] };
  }
  return lanePdfBookIllustrationsCache;
}

/**
 * Bundle manifest, page-candidate join, and curated portraits for the Lane PDF gallery UI.
 */
export function getLanePdfGalleryData() {
  const manifest = loadLanePdfManifest();
  const candidates = loadLanePdfPhotoCandidates();
  const portraitsDoc = loadLanePdfPersonPortraits();
  const hiddenDoc = loadLanePdfGalleryHidden();
  const candidateImages = Array.isArray(candidates?.images) ? candidates.images : [];
  const knownPlateImageIds = new Set(
    candidateImages
      .map((img) => (img && img.imageId != null ? String(img.imageId).trim() : ''))
      .filter((id) => id.length > 0)
  );
  /** Only denylist ids that exist in the corpus (typos / stale entries dropped). */
  const galleryHiddenIds = [...new Set((hiddenDoc.hiddenImageIds || []).map((id) => String(id)))]
    .filter((id) => knownPlateImageIds.has(id) && !LANE_PDF_ALWAYS_VISIBLE_IDS.has(id))
    .sort();

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
      const occupations = Array.isArray(person?.occupation)
        ? person.occupation
            .map((entry) => (entry && typeof entry.job === 'string' ? entry.job.trim() : ''))
            .filter(Boolean)
        : [];
      const publicUrl =
        p.publicUrl ||
        (p.imageId ? `/family/assets/lane-pdf/${String(p.imageId)}.jpg` : '');
      return {
        personId: Number(p.personId),
        imageId: p.imageId || null,
        publicUrl,
        credit: p.credit || creditDefault,
        notes: p.notes || '',
        personName: person?.name || null,
        personBirthYear: person?.birthYear || null,
        personDeathYear: person?.deathYear || null,
        personBorn: person?.born || person?.birthPlace || null,
        personDeathPlace: person?.deathPlace || null,
        personGeneration: person?.generation ?? null,
        personTitle: person?.title || null,
        personOccupations: compactUnique(occupations).slice(0, 4)
      };
    });

  const bookDoc = loadLanePdfBookIllustrations();
  const illRows = Array.isArray(bookDoc.illustrations) ? bookDoc.illustrations : [];
  const illustrationRefsByPlate = new Map();
  for (const ill of illRows) {
    if (!ill || ill.illustrationNo == null) continue;
    const plateIds = Array.isArray(ill.plateImageIds) ? ill.plateImageIds : [];
    for (const rawId of plateIds) {
      const plateId = String(rawId ?? '').trim();
      if (!plateId) continue;
      if (!illustrationRefsByPlate.has(plateId)) illustrationRefsByPlate.set(plateId, []);
      illustrationRefsByPlate.get(plateId).push({
        illustrationNo: Number(ill.illustrationNo),
        caption: typeof ill.caption === 'string' ? ill.caption : '',
        printedPage:
          ill.printedPage != null && Number.isFinite(Number(ill.printedPage))
            ? Number(ill.printedPage)
            : null,
        section: typeof ill.section === 'string' && ill.section.trim() ? ill.section.trim() : null,
        matchStatus: typeof ill.matchStatus === 'string' ? ill.matchStatus : null
      });
    }
  }
  for (const refList of illustrationRefsByPlate.values()) {
    refList.sort((a, b) => a.illustrationNo - b.illustrationNo);
  }
  function summarizeBookIllustrations(refs) {
    if (!refs || !refs.length) return '';
    return refs
      .map((r) => {
        const cap = String(r.caption || '').trim();
        const tail = cap.endsWith('.') ? cap.slice(0, -1) : cap;
        return `#${r.illustrationNo} ${tail}`;
      })
      .join(' · ');
  }
  const galleryImages = candidateImages.map((img) => {
    const id = img && img.imageId != null ? String(img.imageId).trim() : '';
    const refs = id && illustrationRefsByPlate.has(id) ? illustrationRefsByPlate.get(id) : [];
    if (!refs.length) return img;
    return {
      ...img,
      bookIllustrations: refs,
      bookIllustrationLabel: summarizeBookIllustrations(refs)
    };
  });

  return {
    summary,
    creditDefault,
    candidatesStats: candidates?.stats || null,
    images: galleryImages,
    portraits,
    galleryHiddenIds
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

const SERVICE_SIGNAL_TERMS = [
  'soldier',
  'troop',
  'trooper',
  'troops',
  'service',
  'served',
  'serving',
  'enlist',
  'enlisted',
  'enlistment',
  'discharge',
  'veteran',
  'militia',
  'regiment',
  'company',
  'infantry',
  'artillery',
  'cavalry',
  'dragoons',
  'army',
  'navy',
  'marine',
  'officer',
  'capt',
  'captain',
  'lt',
  'lieutenant',
  'ensign',
  'sergeant',
  'corporal',
  'major',
  'colonel',
  'general',
  'surgeon',
  'pension'
];

const RELATIONSHIP_SIGNAL_TERMS = [
  'm.',
  'married',
  'husband',
  'wife',
  'widow',
  'widower',
  'spouse',
  'her cousin',
  'his cousin'
];

const CONFLICT_DEFINITIONS = [
  {
    slug: 'colonial-frontier-militia',
    label: 'Colonial frontier militia (New England / Maine)',
    years: [1689, 1763],
    keywords: [
      'lieutenant governor dummer',
      'thomas westbrook',
      'fighting the indians',
      'county of york',
      'dummer',
      'westbrook'
    ]
  },
  {
    slug: 'king-philips-war',
    label: "King Philip's War",
    years: [1675, 1678],
    keywords: [
      "king philip's war",
      "philip's indian war",
      'king philips war',
      'metacom',
      'capt. turner',
      'capt. poole',
      'capt. wadsworth',
      'wadsworth',
      'wampanoag',
      'narragansett',
      'nipmuc',
      'great swamp',
      'bloody brook',
      'peskeompskut'
    ]
  },
  {
    slug: 'french-and-indian-war',
    label: 'French and Indian War',
    years: [1754, 1763],
    keywords: ['french and indian war', 'seven years war', 'braddock']
  },
  {
    slug: 'revolutionary-war',
    label: 'Revolutionary War',
    years: [1775, 1783],
    keywords: [
      'revolutionary',
      'revolution',
      'revolutionary war',
      'the revolution',
      'continental',
      'bunker hill',
      'lexington',
      'concord',
      'west point',
      'saratoga',
      'yorktown',
      'trenton',
      'hessian',
      'burgoyne',
      'bennington',
      'dearborn',
      'stickney',
      'gale'
    ]
  },
  {
    slug: 'war-of-1812',
    label: 'War of 1812',
    years: [1812, 1815],
    keywords: ['war of 1812', '1812']
  },
  {
    slug: 'mexican-american-war',
    label: 'Mexican-American War',
    years: [1846, 1848],
    keywords: ['mexican war', 'mexican american war', 'with scott']
  },
  {
    slug: 'civil-war',
    label: 'Civil War',
    years: [1861, 1865],
    keywords: ['civil war', 'war of the rebellion', 'union soldier', 'confederate', 'union army']
  },
  {
    slug: 'spanish-american-war',
    label: 'Spanish-American War',
    years: [1898, 1898],
    keywords: ['spanish american war']
  },
  {
    slug: 'world-war-i',
    label: 'World War I',
    years: [1914, 1918],
    keywords: ['world war i', 'world war 1', 'wwi', 'great war']
  },
  {
    slug: 'world-war-ii',
    label: 'World War II',
    years: [1939, 1945],
    keywords: ['world war ii', 'world war 2', 'wwii']
  }
];

const WAR_DEFINITIONS = CONFLICT_DEFINITIONS.reduce((acc, war) => {
  acc[war.slug] = war;
  return acc;
}, {});

const DEFAULT_MUSEUM_CONTENT = {
  featuredStory: {
    slug: 'william-e-lane-boston',
    title: 'William E Lane of Boston',
    subtitle: 'Exhibit 1 · Opening exhibit',
    personQuery: {
      preferredNames: ['William E Lane', 'William Lane'],
      fallbackKeywords: ['William', 'Boston']
    },
    summary:
      'William E Lane of Boston (cordwainer) anchors the opening exhibit; the museum narrative continues through later Lane generations.',
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
      displayName: 'William E Lane of Boston',
      personQuery: 'William Lane',
      caption: 'Opening exhibit · colonial chronology anchor (same as featured panel)',
      eraLabel: 'Colonial Boston · 17th century',
      blurb:
        'Book narrative: Hartford (Samuel b. 8 Aug. 1648), Lynn (1651), freeman 1657; Mary d. 1656; marriage to Mary Brewer — see Hist. Gen. Reg. XII, 196.',
      imageUrl: '/family/assets/william-e-lane-boston-hero.png',
      imageCaption: 'Portrait plate associated with William E Lane of Boston (book materials).',
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
      caption: 'William E Lane of Boston — portrait from book materials',
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
      'Connect this exhibit to wider American history.',
      'Who compiled Lane Genealogies Vol. I (1891)—Chapman and Fitts, the Hampton monument committee, and manuscripts left by Rev. James P. Lane—and where does this site summarize that lineage?',
      'Where is plate p4-i0 in the book plates gallery, and what are the historian portrait deep links?'
    ]
  },
  historiansTeaser: {
    title: 'Honoring the compilers',
    lede:
      'Volume I (1891) was generations in the making—from Hampton-area deacon charts through Dover collectors, Rev. James P. Lanes manuscripts, and the Hampton monument publishing committee. Read the frontispiece, title page, timeline, and Chapmans preface on a dedicated page.',
    href: '/family/lane-historians.html',
    ctaLabel: 'Open Lane Historians',
    imageUrl: '/family/assets/lane-historians/frontispiece-title-1891.png'
  },
  /** Optional: Lane lunar crater “observatory” panel (see lane-museum-content.json). */
  lunarExhibit: null
};

/**
 * Load genealogy data from laneData.json
 */
export function loadGenealogyData() {
  try {
    const pgDoc = getLaneDatasetDoc('laneData');
    if (pgDoc && Array.isArray(pgDoc.nodes) && Array.isArray(pgDoc.links)) {
      genealogyData = pgDoc;
      return genealogyData;
    }
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
    const pgDoc = getLaneDatasetDoc('lane-museum-content');
    if (pgDoc) {
      museumContent = {
        ...DEFAULT_MUSEUM_CONTENT,
        ...pgDoc
      };
      return museumContent;
    }
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

/** Common OCR fold for military snippets before keyword tests. */
function ocrFoldMilitaryHaystack(value = '') {
  return String(value ?? '').replace(/\bthc\b/gi, 'the');
}

function hasRevolutionaryEraAnchorInEvidence(militarySignal) {
  const lines = militarySignal?.evidence;
  if (!Array.isArray(lines) || !lines.length) return false;
  const j = lines.map((line) => ocrFoldMilitaryHaystack(line)).join(' ');
  return /\b(revolution|revolutionary|continental)\b/i.test(j);
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
  const raw = ocrFoldMilitaryHaystack(haystack);
  const h = normalizeLoose(raw);
  if (!h) return false;
  return keywords.some((kw) => {
    const k = String(kw || '').trim();
    if (!k) return false;
    if (/^\d{3,4}$/.test(k)) {
      try {
        return new RegExp(`\\b${k}\\b`).test(raw);
      } catch {
        return false;
      }
    }
    return h.includes(normalizeLoose(k));
  });
}

function normalizeSpaces(value = '') {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function termPattern(terms = []) {
  const escaped = terms
    .map((t) => String(t || '').trim())
    .filter(Boolean)
    .map((t) => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .map((t) => t.replace(/\\\./g, '[.]?'));
  return escaped.length ? new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'i') : null;
}

const RELATIONSHIP_PATTERN = termPattern(RELATIONSHIP_SIGNAL_TERMS);
const SERVICE_PATTERN = termPattern(SERVICE_SIGNAL_TERMS);

function hasServiceSignal(text = '') {
  return SERVICE_PATTERN ? SERVICE_PATTERN.test(String(text || '')) : false;
}

function extractWarAssociationText(node = {}) {
  const text = [];
  if (node.text) text.push(String(node.text));
  const ocrFacts = node.importMeta?.ocrFacts;
  if (ocrFacts?.rawText) text.push(String(ocrFacts.rawText));
  if (Array.isArray(ocrFacts?.military)) {
    for (const line of ocrFacts.military) text.push(String(line));
  }
  if (Array.isArray(ocrFacts?.marriageSnippets)) {
    for (const line of ocrFacts.marriageSnippets) text.push(String(line));
  }
  return compactUnique(text);
}

function detectFamilyWarAssociation(node = {}, warDef = {}) {
  const snippets = [];
  const lines = extractWarAssociationText(node);
  for (const line of lines) {
    if (!hasKeyword(line, warDef.keywords)) continue;
    if (!RELATIONSHIP_PATTERN || !RELATIONSHIP_PATTERN.test(line)) continue;
    if (!hasServiceSignal(line)) continue;
    snippets.push(normalizeSpaces(line));
  }
  return {
    isFamilyAssociated: snippets.length > 0,
    snippets: snippets.slice(0, 3)
  };
}

function extractAssociatedServicePeople(node = {}) {
  const names = [];
  const seen = new Set();
  const lines = extractWarAssociationText(node);
  const patterns = [
    /\bm\.\s*(?:her|his)?\s*cousin,\s*([^,;]+),/i,
    /\bmarried\s+(?:her|his)?\s*cousin,\s*([^,;]+),/i,
    /\bmarried\s+([^,;]+),/i
  ];
  for (const line of lines) {
    for (const pattern of patterns) {
      const m = line.match(pattern);
      if (!m) continue;
      const candidate = normalizeSpaces(m[1]).replace(/\s*\.+$/, '');
      if (!candidate) continue;
      const key = normalizeLoose(candidate);
      if (!key || seen.has(key)) continue;
      seen.add(key);
      names.push(candidate);
    }
  }
  return names.slice(0, 3);
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
  /** Optional pilot: curated engagement lines (same review rules as other military text). */
  if (Array.isArray(node.militaryEngagements)) {
    for (const m of node.militaryEngagements) {
      if (typeof m === 'string') evidence.push(m);
      else if (m && typeof m === 'object' && m.text) evidence.push(String(m.text));
    }
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

function summarizeMilitarySignal(node = {}) {
  const evidence = extractMilitaryEvidence(node);
  const serviceSignalEvidence = evidence.filter((line) => hasServiceSignal(line));
  return {
    evidence,
    hasMilitarySignal: serviceSignalEvidence.length > 0,
    serviceSignalEvidence
  };
}

function parseYearNumber(value) {
  const y = parseInt(value, 10);
  return Number.isFinite(y) ? y : null;
}

function yearsOverlapRange(birthYear, deathYear, range = []) {
  if (!Array.isArray(range) || range.length !== 2) return false;
  const start = Number(range[0]);
  const end = Number(range[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  const by = Number.isFinite(birthYear) ? birthYear : null;
  const dy = Number.isFinite(deathYear) ? deathYear : null;
  if (by === null && dy === null) return false;
  if (by !== null && dy !== null) return !(dy < start || by > end);
  if (by !== null) return by <= end + 65;
  return dy >= start - 65;
}

/**
 * Gates inferred keyword-only matches: someone born ~1701 must not "match" the Mexican War
 * via generic military vocabulary plus the old loose year heuristic.
 * Uses a typical enlisted-age window at campaign start (≤45) and youth ceiling at campaign end.
 */
function plausibleAgeForWarInference(birthYear, deathYear, range = []) {
  if (!Array.isArray(range) || range.length !== 2) return false;
  const start = Number(range[0]);
  const end = Number(range[1]);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;

  const minBirth = start - 45;
  const maxBirth = end - 14;

  const by = Number.isFinite(birthYear) ? birthYear : null;
  const dy = Number.isFinite(deathYear) ? deathYear : null;

  if (by !== null) {
    if (by > maxBirth) return false;
    if (by < minBirth) return false;
    if (dy !== null && dy < start) return false;
    return true;
  }

  if (dy !== null) {
    return dy >= start + 14;
  }

  return false;
}

function analyzeConflictMatch(node, warDef, militarySignal) {
  const evidence = militarySignal.evidence;
  let structured = false;
  let semiStructured = false;
  let textOnly = false;
  const hasKeywordMatch = evidence.some((line) => hasKeyword(line, warDef.keywords));

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

  const birthYear = parseYearNumber(node.birthYear);
  const deathYear = parseYearNumber(node.deathYear);
  const yearSignal = yearsOverlapRange(birthYear, deathYear, warDef.years);
  const inferredBySignalAndYearsRaw =
    !hasKeywordMatch &&
    militarySignal.hasMilitarySignal &&
    yearSignal &&
    plausibleAgeForWarInference(birthYear, deathYear, warDef.years);
  const revAnchor = hasRevolutionaryEraAnchorInEvidence(militarySignal);
  const inferredBySignalAndYears =
    inferredBySignalAndYearsRaw && !(revAnchor && warDef.slug !== 'revolutionary-war');
  const textOnlyPlausible =
    !textOnly || plausibleAgeForWarInference(birthYear, deathYear, warDef.years);

  return {
    structured,
    semiStructured,
    textOnly,
    hasKeywordMatch,
    yearSignal,
    inferredBySignalAndYears,
    matched:
      structured || semiStructured || (textOnly && textOnlyPlausible) || inferredBySignalAndYears
  };
}

function scoreWarMatch(node, warDef) {
  const militarySignal = summarizeMilitarySignal(node);
  const conflict = analyzeConflictMatch(node, warDef, militarySignal);
  if (!conflict.matched) {
    return null;
  }

  const familyAssociation = detectFamilyWarAssociation(node, warDef);
  let confidence = 'low';
  if (conflict.structured) confidence = 'high';
  else if (
    conflict.semiStructured ||
    conflict.textOnly ||
    familyAssociation.isFamilyAssociated ||
    conflict.inferredBySignalAndYears
  ) {
    confidence = 'medium';
  }

  const matchedEvidence = militarySignal.evidence
    .filter((line) => hasKeyword(line, warDef.keywords) || (conflict.inferredBySignalAndYears && hasServiceSignal(line)))
    .slice(0, 8);
  const associationType =
    !conflict.structured && familyAssociation.isFamilyAssociated ? 'family-associated' : 'service-member';
  const associatedPeople = associationType === 'family-associated' ? extractAssociatedServicePeople(node) : [];
  let associationNotes =
    associationType === 'family-associated'
      ? [
          'War reference appears in spouse/cousin relationship text; included as family-associated record.',
          ...familyAssociation.snippets
        ].slice(0, 3)
      : [];
  if (warDef.slug === 'revolutionary-war' && familyAssociation.isFamilyAssociated) {
    associationNotes = [
      'Service language may describe a spouse or in-law (by marriage); confirm which person held the commission.',
      ...associationNotes
    ].slice(0, 4);
  }

  return {
    confidence,
    evidence: matchedEvidence.length ? matchedEvidence : militarySignal.evidence.slice(0, 4),
    associationType,
    associatedPeople,
    associationNotes,
    hasMilitarySignal: militarySignal.hasMilitarySignal
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

export function getLaneStorageStatus() {
  return {
    lanePostgresHydratedAt,
    laneDatasetCount: Object.keys(laneDatasetsCache).length,
    loadedPeople: Array.isArray(genealogyData?.nodes) ? genealogyData.nodes.length : 0
  };
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

function normalizeStringArray(values) {
  if (!Array.isArray(values)) return [];
  return values
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

function normalizeCardCitations(citations) {
  if (!Array.isArray(citations)) return [];
  return citations
    .map((citation) => {
      if (!citation || typeof citation !== 'object') return null;
      const label = String(citation.label || '').trim();
      const kind = String(citation.kind || '').trim();
      if (!label || !kind) return null;
      const url = String(citation.url || '').trim();
      const pageRef = String(citation.pageRef || '').trim();
      return {
        label,
        kind,
        ...(url ? { url } : {}),
        ...(pageRef ? { pageRef } : {})
      };
    })
    .filter(Boolean);
}

function normalizeTradingCard(card) {
  if (!card || typeof card !== 'object') return null;
  const cardId = String(card.cardId || '').trim().toLowerCase();
  if (!cardId) return null;
  const personId = Number(card.personId);
  const title = String(card.title || '').trim();
  const era = String(card.era || '').trim();
  const branch = String(card.branch || '').trim();
  const summary = String(card.summary || '').trim();
  if (!Number.isFinite(personId) || !title || !era || !branch || !summary) return null;

  const facts = normalizeStringArray(card.facts);
  const citations = normalizeCardCitations(card.citations);
  const tags = normalizeStringArray(card.tags).map((tag) => tag.toLowerCase());
  if (!facts.length || !citations.length || !tags.length) return null;

  const relatedCardIds = normalizeStringArray(card.relatedCardIds).map((id) => id.toLowerCase());
  const frontImage = String(card.frontImage || '').trim();
  const rarity = String(card.rarity || '').trim().toLowerCase();
  const timelineYear = Number(card.timelineYear);

  return {
    cardId,
    personId,
    title,
    era,
    branch,
    summary,
    facts,
    citations,
    tags,
    relatedCardIds,
    ...(frontImage ? { frontImage } : {}),
    ...(rarity ? { rarity } : {}),
    ...(Number.isFinite(timelineYear) ? { timelineYear } : {})
  };
}

function loadLaneTradingCards() {
  if (laneTradingCardsCache !== null) return laneTradingCardsCache;
  try {
    const pgDoc = getLaneDatasetDoc('lane-trading-cards-first-edition');
    const parsed = pgDoc || (() => {
      const p = path.join(__dirname, '..', 'data', 'lane-trading-cards-first-edition.json');
      return JSON.parse(fs.readFileSync(p, 'utf-8'));
    })();
    laneTradingCardsCache = {
      version: Number(parsed?.version) || 1,
      edition: String(parsed?.edition || 'First Edition'),
      generatedAt: String(parsed?.generatedAt || ''),
      sourceLabel: String(parsed?.sourceLabel || 'Lane Genealogies Vol. I (1891)'),
      cards: Array.isArray(parsed?.cards) ? parsed.cards.map((card) => normalizeTradingCard(card)).filter(Boolean) : []
    };
  } catch {
    laneTradingCardsCache = {
      version: 1,
      edition: 'First Edition',
      generatedAt: '',
      sourceLabel: 'Lane Genealogies Vol. I (1891)',
      cards: []
    };
  }
  return laneTradingCardsCache;
}

function enrichLaneTradingCard(card, personById) {
  const person = personById.get(card.personId) || null;
  const born = person?.born || person?.birthPlace || '';
  const dates = `${person?.birthYear || '?'} - ${person?.deathYear || '?'}`;
  return {
    ...card,
    person,
    personDisplay: {
      name: person?.name || card.title,
      dates,
      born
    }
  };
}

export function getLaneTradingCards(filters = {}) {
  const doc = loadLaneTradingCards();
  const people = getAllPeople();
  const personById = new Map(people.map((person) => [Number(person.id), person]));
  const eraFilter = String(filters.era || '').trim().toLowerCase();
  const tagFilter = String(filters.tag || '').trim().toLowerCase();
  const branchFilter = String(filters.branch || '').trim().toLowerCase();
  const qFilter = String(filters.q || '').trim().toLowerCase();
  const personIdFilter = Number(filters.personId);

  const cards = doc.cards
    .filter((card) => (eraFilter ? card.era.toLowerCase() === eraFilter : true))
    .filter((card) => (tagFilter ? card.tags.includes(tagFilter) : true))
    .filter((card) => (branchFilter ? card.branch.toLowerCase() === branchFilter : true))
    .filter((card) => (Number.isFinite(personIdFilter) ? card.personId === personIdFilter : true))
    .filter((card) => {
      if (!qFilter) return true;
      const haystack = [card.cardId, card.title, card.summary, card.era, card.branch, card.tags.join(' ')].join(' ').toLowerCase();
      return haystack.includes(qFilter);
    })
    .map((card) => enrichLaneTradingCard(card, personById))
    .sort((a, b) => {
      const ay = Number.isFinite(a.timelineYear) ? a.timelineYear : 99999;
      const by = Number.isFinite(b.timelineYear) ? b.timelineYear : 99999;
      if (ay !== by) return ay - by;
      return a.title.localeCompare(b.title);
    });

  const eras = compactUnique(doc.cards.map((card) => card.era));
  const branches = compactUnique(doc.cards.map((card) => card.branch));
  const tags = compactUnique(doc.cards.flatMap((card) => card.tags)).sort((a, b) =>
    a.localeCompare(b, undefined, { sensitivity: 'base' })
  );

  return {
    version: doc.version,
    edition: doc.edition,
    generatedAt: doc.generatedAt,
    sourceLabel: doc.sourceLabel,
    count: cards.length,
    eras,
    branches,
    tags,
    cards
  };
}

export function getLaneTradingCardById(cardId) {
  const requested = String(cardId || '').trim().toLowerCase();
  if (!requested) return null;
  const listing = getLaneTradingCards();
  const card = listing.cards.find((entry) => entry.cardId === requested);
  if (!card) return null;
  const relatedCards = card.relatedCardIds
    .map((id) => listing.cards.find((entry) => entry.cardId === id))
    .filter(Boolean);
  return {
    ...card,
    relatedCards
  };
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
        associationType: scored.associationType || 'service-member',
        associatedPeople: scored.associatedPeople || [],
        associationNotes: scored.associationNotes || [],
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
  }).filter((c) => c.participantCount > 0);
  return { campaigns };
}

export function getMilitaryDeepScanReport() {
  const people = getAllPeople();
  const byConflict = Object.fromEntries(
    Object.values(WAR_DEFINITIONS).map((w) => [w.slug, { war: w, participants: [] }])
  );
  const suspicious = [];
  let serviceSignalHits = 0;

  for (const person of people) {
    const militarySignal = summarizeMilitarySignal(person);
    if (!militarySignal.hasMilitarySignal) continue;
    serviceSignalHits += 1;

    let matchedAny = false;
    for (const war of Object.values(WAR_DEFINITIONS)) {
      const scored = scoreWarMatch(person, war);
      if (!scored) continue;
      matchedAny = true;
      byConflict[war.slug].participants.push({
        id: person.id,
        name: person.name,
        birthYear: person.birthYear,
        deathYear: person.deathYear,
        confidence: scored.confidence,
        associationType: scored.associationType,
        evidence: scored.evidence.slice(0, 3)
      });
    }

    if (!matchedAny) {
      suspicious.push({
        id: person.id,
        name: person.name,
        birthYear: person.birthYear,
        deathYear: person.deathYear,
        evidence: militarySignal.serviceSignalEvidence.slice(0, 3)
      });
    }
  }

  const conflicts = Object.values(byConflict)
    .filter((entry) => entry.participants.length > 0)
    .map((entry) => ({
      slug: entry.war.slug,
      label: entry.war.label,
      years: entry.war.years,
      participantCount: entry.participants.length,
      participants: entry.participants
    }));

  return {
    scannedPeople: people.length,
    serviceSignalHits,
    conflictCount: conflicts.length,
    conflicts,
    suspiciousUnmatched: suspicious
  };
}

export const __test__ = {
  SERVICE_SIGNAL_TERMS,
  hasServiceSignal,
  summarizeMilitarySignal,
  analyzeConflictMatch,
  scoreWarMatch,
  plausibleAgeForWarInference,
  WAR_DEFINITIONS,
  ocrFoldMilitaryHaystack,
  hasRevolutionaryEraAnchorInEvidence,
  hasKeyword
};

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

/** Deterministic single-child step for direct descendant line: earliest documented birth year (missing years sort last). */
function sortChildrenForDirectDescendantLine(children) {
  const list = (children || []).filter(Boolean);
  return list.sort((a, b) => {
    const ay = Number.isFinite(Number(a?.birthYear)) ? Number(a.birthYear) : 99999;
    const by = Number.isFinite(Number(b?.birthYear)) ? Number(b.birthYear) : 99999;
    if (ay !== by) return ay - by;
    return String(a.name || '').localeCompare(String(b.name || ''));
  });
}

/**
 * Direct descendant chain from start person: one child per generation (earliest documented child).
 */
export function getDirectDescendantStory(startId = 112) {
  const anchor = getPersonById(startId);
  if (!anchor) return null;

  const visited = new Set();
  const chain = [];
  let current = anchor;

  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    chain.push(summarizeDirectLinePerson(current));

    const kids = getChildren(current.id).filter(Boolean);
    if (!kids.length) break;

    const sorted = sortChildrenForDirectDescendantLine(kids);
    const next = sorted[0];
    if (!next || visited.has(next.id)) break;

    current = next;
  }

  return {
    startId: anchor.id,
    startPerson: { id: anchor.id, name: anchor.name, birthYear: anchor.birthYear, deathYear: anchor.deathYear },
    order: 'forward',
    directOnly: true,
    generations: chain.length,
    line: chain,
    childPickRule: 'earliest-documented-birth-year'
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
 * Named associations (non-parent/spouse ties), e.g. book cross-references without implying biology.
 * Uses links with relation "associated"; does not affect getParents/getChildren.
 */
export function getAssociatedPeople(personId) {
  const relationships = getRelationships(personId);
  return relationships.filter(rel => rel.relation === 'associated')
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
  refreshGenealogyCachesFromPostgres,
  getAllFamilyData,
  getAllPeople,
  getPersonById,
  searchPeople,
  getRelationships,
  getChildren,
  getParents,
  getSpouses,
  getAssociatedPeople,
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
  getMilitaryDeepScanReport,
  getOccupationSummary,
  getDirectAncestorStory,
  getDirectDescendantStory,
  getLanePdfGalleryData,
  getLanePdfPortraitsForPerson,
  getLaneTradingCards,
  getLaneTradingCardById,
  getLaneStorageStatus
};

