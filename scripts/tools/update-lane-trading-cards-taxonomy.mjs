/**
 * Development work by David Lane
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const p = path.join(__dirname, '..', '..', 'data', 'lane-trading-cards-first-edition.json');
const doc = JSON.parse(fs.readFileSync(p, 'utf8'));

doc.taxonomyVersion = 2;
doc.generatedAt = new Date().toISOString();

const rarityMap = {
  'william-lane-i': 'legendary',
  'samuel-lane-ii': 'rare',
  'john-lane-poole': 'rare',
  'william-lane-ii': 'notable',
  'sarah-dickinson-lane': 'rare',
  'john-lane-libbey': 'notable',
  'thomas-lane-sexton': 'notable',
  'mary-libbey-lane': 'notable',
  'cornet-john-lane-iv': 'rare',
  'lt-john-lane-bennington': 'rare',
  'daniel-lane-gale': 'rare',
  'lt-ezekiel-lane': 'rare',
  'deacon-samuel-lane': 'notable',
  'jonathan-homer-lane': 'legendary',
  'captain-aaron-g-lane': 'rare',
  'george-g-lane': 'legendary',
  'alderman-homer-r-lane': 'legendary',
  'william-homer-lane': 'common',
  'gordon-brewer': 'common',
  'elizabeth-brewer': 'common',
  'mary-kelway-lane': 'common',
  'mary-brewer-lane': 'notable',
  'mary-lane-1656': 'common',
  'museum-frontispiece-context': 'rare'
};

for (const card of doc.cards) {
  card.cardKind = card.cardKind || 'person';
  if (card.cardId === 'museum-frontispiece-context') {
    card.cardKind = 'artifact';
    card.artifactType = 'plate-extract';
  }
  if (rarityMap[card.cardId]) card.rarity = rarityMap[card.cardId];
  else if (card.rarity === 'uncommon') card.rarity = 'notable';
  if (!card.rarity) card.rarity = 'common';
}

const newCards = [
  {
    cardId: 'event-king-philips-war',
    personId: 0,
    cardKind: 'event',
    eventSlug: 'king-philips-war',
    title: "King Philip's War (1675–76)",
    era: "King Philip's War era",
    branch: 'Colonial New England',
    frontImage: '/family/assets/lane-genealogies-title-spread.png',
    summary:
      'Event card for the 1675–76 conflict context where Vol. I places Lane brothers under Poole and Turner companies.',
    facts: [
      'John Lane narrative: March 1675 service under Capt. Poole.',
      'Samuel Lane narrative: 1676 under Capt. Turner in related company lineage.'
    ],
    citations: [
      { label: 'Lane war history', kind: 'internal', url: '/family/lane-war-history.html' },
      { label: 'Lane Genealogies Vol. I', kind: 'book', url: 'https://archive.org/details/lanegenealogies01chap' }
    ],
    tags: ['king-philips', 'military-context', 'event'],
    relatedCardIds: ['samuel-lane-ii', 'john-lane-poole'],
    rarity: 'rare',
    timelineYear: 1675
  },
  {
    cardId: 'event-french-indian-frontier',
    personId: 0,
    cardKind: 'event',
    eventSlug: 'french-indian-frontier',
    title: 'French & Indian frontier — Chester horse troop',
    era: 'French and Indian frontier',
    branch: 'Chester militia context',
    frontImage: '/family/assets/cornet-john-lane.png',
    summary: 'Event card for mounted militia and frontier duty context tied to Cornet John Lane (1754 compilation note).',
    facts: [
      'Vol. I cites September 1754 cornet appointment in a troop of horse.',
      'Parent generation for Revolutionary officers in the Chester cluster.'
    ],
    citations: [
      { label: 'Lane Genealogies Vol. I', kind: 'book', url: 'https://archive.org/details/lanegenealogies01chap' },
      { label: 'War history timeline', kind: 'internal', url: '/family/lane-war-history.html' }
    ],
    tags: ['french-indian', 'chester', 'event'],
    relatedCardIds: ['cornet-john-lane-iv'],
    rarity: 'rare',
    timelineYear: 1754
  },
  {
    cardId: 'event-hampton-settlement',
    personId: 0,
    cardKind: 'event',
    eventSlug: 'hampton-settlement',
    title: 'Hampton settlement (1686)',
    era: 'Late 17th century migration',
    branch: 'NH coast',
    frontImage: '/family/assets/lane-genealogies-title-spread.png',
    summary: 'Event card for William² tailor line removal to Hampton and coastal parish context in Vol. I.',
    facts: [
      'North Church Boston and Hampton grant notes appear in the compilation.',
      'Webster-linked household threads through later coastal records.'
    ],
    citations: [{ label: 'Lane Genealogies Vol. I', kind: 'book', url: 'https://archive.org/details/lanegenealogies01chap' }],
    tags: ['hampton', 'migration', 'event'],
    relatedCardIds: ['william-lane-ii'],
    rarity: 'notable',
    timelineYear: 1686
  },
  {
    cardId: 'event-boston-migration',
    personId: 0,
    cardKind: 'event',
    eventSlug: 'boston-migration',
    title: 'Boston migration & William I household',
    era: 'Colonial Boston',
    branch: 'Boston anchor',
    frontImage: '/family/assets/william-e-lane-boston-hero.png',
    summary:
      'Event card for William I freeman record, Hartford/Lynn harmonization notes, and Mary Brewer second household.',
    facts: [
      'Freeman Massachusetts Bay, 1657.',
      'Mary (Kelway) and Mary (Brewer) household chronology in Vol. I narrative.'
    ],
    citations: [
      { label: 'Lane Genealogies Vol. I', kind: 'book', url: 'https://archive.org/details/lanegenealogies01chap' },
      { label: 'Lane Museum — William exhibit', kind: 'internal', url: '/family/lane-museum.html' }
    ],
    tags: ['boston', 'migration', 'event'],
    relatedCardIds: ['william-lane-i', 'mary-brewer-lane'],
    rarity: 'legendary',
    timelineYear: 1656
  },
  {
    cardId: 'event-captivity-canada-1704',
    personId: 0,
    cardKind: 'event',
    eventSlug: 'captivity-canada-1704',
    title: 'Captivity to Canada (1704)',
    era: 'Frontier raid narrative',
    branch: 'Hadley strand',
    frontImage: '/family/assets/sarah-dickinson-lane.png',
    summary: 'Event card for the 10 Feb. 1704 French and Indian raid taking Sarah Dickinson Kellogg and children captive.',
    facts: [
      'Widow of Samuel Lane; remarried Martin Kellogg, 27 Feb. 1691.',
      'Compilation narrative: released except one daughter who remained in Canada.'
    ],
    citations: [{ label: 'Lane Genealogies Vol. I', kind: 'book', url: 'https://archive.org/details/lanegenealogies01chap' }],
    tags: ['captivity', 'frontier', 'event'],
    relatedCardIds: ['sarah-dickinson-lane', 'samuel-lane-ii'],
    rarity: 'rare',
    timelineYear: 1704
  },
  {
    cardId: 'artifact-lane-genealogies-title-1891',
    personId: 0,
    cardKind: 'artifact',
    artifactType: 'printed-book',
    title: 'Lane Genealogies title spread (1891)',
    era: 'Printed volume',
    branch: 'Book provenance',
    frontImage: '/family/assets/lane-genealogies-title-spread.png',
    summary: 'Artifact card for the 1891 Exeter imprint title spread—anchor object for the First Edition card set.',
    facts: [
      'Chapman and Fitts completed the printed volume for the Hampton monument committee.',
      'Use with plates gallery for page-level provenance.'
    ],
    citations: [
      { label: 'Internet Archive facsimile', kind: 'book', url: 'https://archive.org/details/lanegenealogies01chap' },
      { label: 'Lane Historians', kind: 'internal', url: '/family/lane-historians.html' }
    ],
    tags: ['artifact', 'book', 'provenance'],
    relatedCardIds: ['museum-frontispiece-context', 'william-lane-i'],
    rarity: 'rare',
    timelineYear: 1891
  },
  {
    cardId: 'artifact-plate-p4-i0',
    personId: 0,
    cardKind: 'artifact',
    artifactType: 'plate-extract',
    title: 'Frontispiece plate p4-i0',
    era: 'Historians and compilers',
    branch: 'Book plates',
    frontImage: '/family/assets/lane-pdf/p4-i0.jpg',
    summary: 'Artifact card for committee frontispiece plate—four compiler portraits and title-page context.',
    facts: [
      'Deep link opens filtered gallery view for plate p4-i0.',
      'Per-face crops appear on Lane Historians page.'
    ],
    citations: [
      { label: 'Lane PDF gallery', kind: 'internal', url: '/family/lane-pdf-gallery.html?plate=p4-i0&pdfPage=4' },
      { label: 'Lane Historians', kind: 'internal', url: '/family/lane-historians.html' }
    ],
    tags: ['artifact', 'plate', 'historians'],
    relatedCardIds: ['museum-frontispiece-context'],
    rarity: 'rare',
    timelineYear: 1891
  },
  {
    cardId: 'artifact-plate-opening-boston',
    personId: 0,
    cardKind: 'artifact',
    artifactType: 'plate-extract',
    title: 'Opening Boston plate context',
    era: 'Colonial Boston',
    branch: 'Book plates',
    frontImage: '/family/assets/william-e-lane-boston-hero.png',
    summary: 'Artifact card linking William I exhibit portrait materials to scanned book plates and museum chronology.',
    facts: [
      'Pairs with William E Lane of Boston museum exhibit.',
      'Book illustration index may map additional plate ids.'
    ],
    citations: [
      { label: 'Lane Museum', kind: 'internal', url: '/family/lane-museum.html' },
      { label: 'Lane PDF gallery', kind: 'internal', url: '/family/lane-pdf-gallery.html' }
    ],
    tags: ['artifact', 'boston', 'plate'],
    relatedCardIds: ['william-lane-i', 'event-boston-migration'],
    rarity: 'notable',
    timelineYear: 1625
  }
];

const existingIds = new Set(doc.cards.map((c) => c.cardId));
for (const c of newCards) {
  if (!existingIds.has(c.cardId)) doc.cards.push(c);
}

const addRelated = (id, relatedId) => {
  const card = doc.cards.find((c) => c.cardId === id);
  if (!card) return;
  if (!card.relatedCardIds) card.relatedCardIds = [];
  if (!card.relatedCardIds.includes(relatedId)) card.relatedCardIds.push(relatedId);
};
addRelated('samuel-lane-ii', 'event-king-philips-war');
addRelated('john-lane-poole', 'event-king-philips-war');
addRelated('sarah-dickinson-lane', 'event-captivity-canada-1704');
addRelated('william-lane-ii', 'event-hampton-settlement');
addRelated('william-lane-i', 'event-boston-migration');
addRelated('cornet-john-lane-iv', 'event-french-indian-frontier');

doc.timelineSpine = [
  { year: 1625, label: 'William Lane (I) born', cardId: 'william-lane-i', beatKind: 'birth' },
  { year: 1635, label: 'Mary (Brewer) Lane born', cardId: 'mary-brewer-lane', beatKind: 'birth' },
  { year: 1651, label: 'Samuel Lane born', cardId: 'samuel-lane-ii', beatKind: 'birth' },
  { year: 1656, label: 'Boston migration & William I household', cardId: 'event-boston-migration', beatKind: 'migration' },
  {
    year: 1657,
    label: 'Sarah Lane born (Boston register line)',
    cardId: 'mary-lane-1656',
    beatKind: 'birth',
    notes: 'Sibling-era Sarah in Vol. I; distinct from Sarah Dickinson (Hadley).'
  },
  { year: 1675, label: "John Lane serves in King Philip's War", cardId: 'event-king-philips-war', beatKind: 'military' },
  { year: 1676, label: 'Samuel Lane under Capt. Turner', cardId: 'samuel-lane-ii', beatKind: 'military' },
  { year: 1686, label: 'William² Lane removes to Hampton', cardId: 'event-hampton-settlement', beatKind: 'migration' },
  { year: 1704, label: 'Sarah Dickinson / Kellogg captivity', cardId: 'event-captivity-canada-1704', beatKind: 'event' },
  { year: 1754, label: 'Cornet John Lane — Chester horse troop', cardId: 'event-french-indian-frontier', beatKind: 'military' },
  { year: 1777, label: 'Battle of Bennington — Chester officers', cardId: 'lt-ezekiel-lane', beatKind: 'military' },
  { year: 1819, label: 'Jonathan Homer Lane born', cardId: 'jonathan-homer-lane', beatKind: 'birth' },
  {
    year: 1891,
    label: 'Lane Genealogies published — frontispiece plate',
    cardId: 'artifact-plate-p4-i0',
    beatKind: 'publication'
  }
];

fs.writeFileSync(p, `${JSON.stringify(doc, null, 2)}\n`);
console.log('cards', doc.cards.length, 'spine', doc.timelineSpine.length);
