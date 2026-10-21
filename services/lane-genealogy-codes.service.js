/**
 * Development work by David Lane
 */
/**
 * Genealogy source file.
 * Author: Levi Lane.
 */
/**
 * Decodes the register codes printed in Lane Genealogies Vol. 1 (1891):
 *   - family blocks:        "No. 24. DEACON JEREMIAH LANE 4 (Josh. 3, Wm. 2), 1732-1806, and his w. MARY (SANBORN) had:"
 *   - carry-forward marks:  "(24) XI. Deacon Jeremiah 4, b. 10 March, 1732" — this child heads family No. 24 later
 *   - child order:          Roman numerals (children), "1." (grandchildren), "1.)" (great-grandchildren)
 *   - pedigree chains:      "(Josh. 3, Wm. 2)" — father, grandfather, ... of the family head
 * and resolves those people against data/laneData.json so parent/spouse links can be written.
 *
 * The embedded PDF text has its spaces stripped ("No.4.SAMUELLANE3(Sam.^VVm.i)andhisw.,ABI.(HOVEY)"),
 * so every pattern here tolerates glued tokens and common OCR digit/letter swaps.
 */

export const GENEALOGY_CODE_SOURCE = 'lanegenealogies01chap.pdf';
export const GENEALOGY_CODE_METHOD = 'lane-genealogy-codes';

export const SECTION_LABELS = {
  boston: 'Part I · William Lane of Boston',
  buxton: 'Part II · Buxton Lane family',
  fishersfield: 'Part III · Fishersfield Lane family',
  additions: 'Additions',
  // Volume II (1897) — Fitts
  dorchester: 'Vol. II · William Lane of Dorchester',
  stratford: 'Vol. II · Robert Lane of Stratford',
  milford: 'Vol. II · John Lane of Milford',
  merrifield: 'Vol. II · John Merrifield Lane of Boston',
  newlondon: 'Vol. II · Daniel Lane of New London',
  rye: 'Vol. II · George Lane of Rye',
  // Volume III (1902) — Fitts
  rickmansworth: 'Vol. III · English family, Rickmansworth',
  joblane: 'Vol. III · Job Lane of Malden & Billerica',
  casco: 'Vol. III · James Lane of Casco Bay',
  edwardlane: 'Vol. III · Edward Lane of Boston'
};

/** Nickname / diminutive groups — any two names in a group agree. */
export const NICKNAME_GROUPS = [
  ['abi', 'abigail', 'nabby', 'abby'],
  ['betsey', 'betsy', 'eliza', 'elizabeth', 'betty', 'bessie', 'libby'],
  ['polly', 'molly', 'mary', 'mae', 'mamie'],
  ['sally', 'sarah'],
  ['patty', 'martha'],
  ['sukey', 'susanna', 'susan', 'susannah', 'sue'],
  ['peggy', 'margaret', 'maggie', 'meg'],
  ['hitty', 'mehitable', 'hetty'],
  ['nelly', 'eleanor', 'ellen', 'nell', 'nellie'],
  ['jenny', 'jane', 'janet', 'jean'],
  ['katie', 'kate', 'catherine', 'catharine', 'katherine'],
  ['william', 'will', 'wm', 'billy', 'bill'],
  ['samuel', 'sam', 'saml'],
  ['john', 'jon', 'jno', 'jack'],
  ['joseph', 'joe', 'jo'],
  ['joshua', 'josh'],
  ['benjamin', 'ben', 'benj'],
  ['jonathan', 'jonth', 'jona'],
  ['ebenezer', 'eben'],
  ['jeremiah', 'jere', 'jerry'],
  ['daniel', 'dan', 'danl', 'dani'],
  ['nathaniel', 'nath', 'nat'],
  ['robert', 'robt', 'bob'],
  ['richard', 'rich', 'dick'],
  ['matthew', 'matt'],
  ['nicholas', 'nich', 'nick'],
  ['thomas', 'thos', 'tom'],
  ['james', 'jas', 'jim'],
  ['josiah', 'si'],
  ['bathsheba', 'bathsheea', 'sheba']
];

const NICKNAME_CANONICAL = (() => {
  const map = new Map();
  for (const group of NICKNAME_GROUPS) {
    const canon = group[0];
    for (const n of group) map.set(n, canon);
  }
  return map;
})();

/** Known OCR given-name repairs (space-split or letter-swapped). */
export const OCR_GIVEN_REPAIRS = {
  'eliza beth': 'elizabeth',
  elizabeth: 'elizabeth',
  'sus anna': 'susanna',
  susanna: 'susanna',
  'jo siah': 'josiah',
  josiah: 'josiah',
  bathsheea: 'bathsheba',
  'bath sheba': 'bathsheba',
  'mehit able': 'mehitable',
  mehitable: 'mehitable',
  'abi gail': 'abigail',
  'beth sheba': 'bathsheba',
  'hepsi bah': 'hepsibah',
  'me hitable': 'mehitable',
  'bar bara': 'barbara',
  'mar tha': 'martha',
  'han nah': 'hannah',
  'deb orah': 'deborah',
  'eunice': 'eunice',
  'prisc illa': 'priscilla',
  'cath erine': 'catherine',
  'kath erine': 'katherine'
};

const RELATION_COLORS = { father: '#39F', mother: '#F39', spouse: '#CC0' };

const PEDIGREE_ABBREVIATIONS = {
  wm: 'William',
  will: 'William',
  sam: 'Samuel',
  saml: 'Samuel',
  jn: 'John',
  jno: 'John',
  jo: 'Joseph',
  josh: 'Joshua',
  thos: 'Thomas',
  jere: 'Jeremiah',
  eben: 'Ebenezer',
  dan: 'Daniel',
  danl: 'Daniel',
  dani: 'Daniel',
  jonth: 'Jonathan',
  jona: 'Jonathan',
  sim: 'Simeon',
  jas: 'James',
  benj: 'Benjamin',
  nich: 'Nicholas',
  abr: 'Abraham',
  robt: 'Robert',
  rich: 'Richard',
  matt: 'Matthew',
  nath: 'Nathaniel'
};

const PEDIGREE_STOPWORDS = new Set([
  'dau', 'of', 'and', 'lane', 'capt', 'captain', 'dea', 'deacon', 'lt', 'col', 'rev', 'dr', 'hon', 'esq', 'mrs'
]);

export const DEFAULT_GIVEN_NAMES = [
  'william', 'john', 'samuel', 'joshua', 'thomas', 'james', 'daniel', 'joseph', 'benjamin', 'jonathan',
  'ebenezer', 'jeremiah', 'david', 'isaac', 'jacob', 'abraham', 'isaiah', 'josiah', 'jabez', 'enos', 'gad',
  'simon', 'simeon', 'levi', 'noah', 'ward', 'joel', 'nathan', 'peter', 'ezekiel', 'stephen', 'henry',
  'charles', 'edward', 'edwin', 'george', 'alfred', 'albert', 'arthur', 'dennis', 'willis', 'reuben',
  'franklin', 'anthony', 'moses', 'elias', 'elijah', 'aaron', 'amos', 'asa', 'abijah', 'hiram', 'comfort',
  'matthew', 'richard', 'robert', 'nicholas', 'edmund', 'silas', 'rufus', 'alvin', 'jesse', 'enoch',
  'nathaniel', 'caleb', 'timothy', 'philip', 'andrew', 'walter', 'frank', 'francis', 'jason', 'winthrop',
  'oliver', 'calvin', 'luther', 'ira', 'eli', 'obadiah', 'mellen', 'azel', 'temple', 'matthias', 'ithamar',
  'mary', 'sarah', 'elizabeth', 'hannah', 'abigail', 'anna', 'anne', 'ann', 'lydia', 'bathsheba', 'betsey',
  'martha', 'ruth', 'rachel', 'susanna', 'susan', 'judith', 'huldah', 'mehitable', 'eunice', 'deborah',
  'hepsibah', 'olive', 'caroline', 'lucy', 'polly', 'sally', 'nancy', 'esther', 'phebe', 'priscilla',
  'joanna', 'dorcas', 'keziah', 'emily', 'emma', 'ellen', 'laura', 'frances', 'jane', 'margaret',
  'catherine', 'catharine', 'alice', 'abi', 'nabby', 'molly', 'rebecca', 'louisa', 'harriet', 'eliza'
];

const GLUED_TITLES = ['LIEUTENANT', 'LIEUT', 'CAPTAIN', 'CORNET', 'DEACON', 'MAJOR', 'ENSIGN'];
const DOTTED_TITLES = ['CAPT', 'COL', 'REV', 'DR', 'HON', 'ESQ', 'DEA', 'LT', 'GEN', 'MAJ', 'MRS', 'MR'];

export function squash(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

function titleCase(value = '') {
  return String(value || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((t) => t.charAt(0).toUpperCase() + t.slice(1))
    .join(' ');
}

/** OCR digit repair for family numbers and years: I/l/i/| -> 1, O/o -> 0, S -> 8, g -> 9, Z/z -> 2. */
export function repairOcrDigits(token = '') {
  return String(token || '')
    .replace(/[Ili|!]/g, '1')
    .replace(/[Oo]/g, '0')
    .replace(/S/g, '8')
    .replace(/g/g, '9')
    .replace(/[Zz]/g, '2');
}

/** "II" -> { no: 11 }, "loi" -> 101, "103a" -> { no: 103, suffix: 'a' }. */
export function parseFamilyNumber(raw = '') {
  const m = String(raw || '').trim().match(/^([0-9IlOoSig|]{1,4}?)(a)?$/);
  if (!m) return null;
  const digits = repairOcrDigits(m[1]);
  if (!/^\d{1,4}$/.test(digits)) return null;
  const no = Number.parseInt(digits, 10);
  if (!Number.isFinite(no) || no < 1) return null;
  return { no, suffix: m[2] || '', key: `${no}${m[2] || ''}` };
}

const ROMAN_VALUES = { I: 1, V: 5, X: 10, L: 50 };

export function romanToInt(value = '') {
  const s = String(value || '').toUpperCase();
  if (!/^[IVXL]+$/.test(s)) return null;
  let total = 0;
  for (let i = 0; i < s.length; i += 1) {
    const cur = ROMAN_VALUES[s[i]];
    const next = ROMAN_VALUES[s[i + 1]] || 0;
    total += cur < next ? -cur : cur;
  }
  return total > 0 ? total : null;
}

/**
 * Carry-forward marker "(24)" (OCR variants "(4:)", "(4*7)", "(XI)", "(I3)") -> family number.
 * Roman-only content with X/V is read as Roman; everything else as OCR digits.
 */
export function normalizeCarryForward(raw = '') {
  const s = String(raw || '').replace(/[\s^'"\-:*�.,]/g, '');
  if (!s) return null;
  if (/^[XVL][IVXL]*$|^[IVXL]*[XVL]$/.test(s) && /[XVL]/.test(s)) return romanToInt(s);
  const digits = repairOcrDigits(s);
  if (!/^\d{1,3}$/.test(digits)) return null;
  const n = Number.parseInt(digits, 10);
  return n > 0 ? n : null;
}

/** OCR-tolerant 4-digit year ("1S25" -> 1825, "i746" -> 1746). */
export function parseOcrYear(token = '') {
  const digits = repairOcrDigits(String(token || ''));
  if (!/^\d{4}$/.test(digits)) return null;
  const y = Number.parseInt(digits, 10);
  return y >= 1550 && y <= 1899 ? y : null;
}

const YEAR_TOKEN = '[1Iil][5-8S][0-9SOoIil]{2}';
const LIFESPAN_RE = new RegExp(`^[\\s,.'\\-]{0,3}(${YEAR_TOKEN})(?![0-9])(?:\\s*-\\s*(${YEAR_TOKEN})?)?`);
const YEAR_RE = new RegExp(`(${YEAR_TOKEN})`);

/** Lifespan printed right after a header name/pedigree: "1651-1690", ",1715", "1802-". */
export function parseLifespan(text = '') {
  const m = String(text || '').match(LIFESPAN_RE);
  if (!m) return { birthYear: null, deathYear: null };
  return { birthYear: parseOcrYear(m[1]), deathYear: m[2] ? parseOcrYear(m[2]) : null };
}

/** Year from the child's own "b." clause — stops before the marriage/death clause on the same line. */
export function parseChildBirthYear(segment = '') {
  const s = String(segment || '');
  const b = s.match(/\b[bh]\s*\.\s*/);
  if (!b) return null;
  let clause = s.slice(b.index + b[0].length, b.index + b[0].length + 34);
  const cut = clause.search(/[,;]\s*(?:m|d|bapt|ni)\s*[.,]|\bm\.\s*\d|\bd\.\s*\d|;/);
  if (cut >= 0) clause = clause.slice(0, cut);
  const m = clause.match(YEAR_RE);
  return m ? parseOcrYear(m[1]) : null;
}

/* ------------------------------------------------------------------ */
/* Page cleanup + sections                                             */
/* ------------------------------------------------------------------ */

const EVEN_HEADER_RE =
  /^[\s0-9IlOoSi/'j^]{0,8}(?:WI[LJ]\.?LIAM\s*LANE\s*AN[DTt)]+|THE\s*(?:BUXTON|FISHERSFIELD)(?:\s*AND\s*FISHERSFIELD)?\s*LANE)\s*[-".,]?\s*[Ff][A-Za-z.'\s]{1,7}?(?:L[YV]|LIES)\s*[.,]?/;
const ODD_HEADER_RE = /^[\s\d]{0,10}(?:NU\w?MBER[A-Z-]+|APPENDIX|ADDITIONS)\s*[.,]+\s*/;
const OCR_DIGIT_CHAR = /[0-9IlOoSi/$Q?|]/;

/**
 * Strip the running head ("12 WILLIAM LANE AND FAMILY." / "NUMBER FIVE. 13") from a page.
 * Returns { text, printedPage } where printedPage is parsed from an even-page head when readable.
 */
export function stripRunningHeader(pageText = '', expectedOddPage = null) {
  let text = String(pageText || '');
  const even = text.match(EVEN_HEADER_RE);
  if (even) {
    const lead = (even[0].match(/^[\s0-9IlOoSi/'j^]*/) || [''])[0];
    const digits = repairOcrDigits(lead.replace(/[^0-9IlOoSi]/g, '').slice(0, 3));
    const printedPage = /^\d+$/.test(digits) ? Number.parseInt(digits, 10) : null;
    return { text: text.slice(even[0].length), printedPage };
  }
  const odd = text.match(ODD_HEADER_RE);
  if (odd) {
    text = text.slice(odd[0].length);
    const want = expectedOddPage ? String(expectedOddPage).length : 0;
    if (want) {
      let i = 0;
      let taken = 0;
      while (i < text.length && taken < want) {
        const ch = text[i];
        if (/\s/.test(ch)) {
          i += 1;
          continue;
        }
        if (!OCR_DIGIT_CHAR.test(ch)) break;
        taken += 1;
        i += 1;
      }
      if (taken === want) text = text.slice(i);
    }
    return { text, printedPage: expectedOddPage };
  }
  return { text, printedPage: null };
}

function detectPageMode(rawText, currentMode, options = {}) {
  const head = String(rawText || '').slice(0, 160).replace(/\s+/g, '');
  const volume = options.volume || 1;
  if (volume === 1) {
    if (/^PART\s*SECOND/i.test(head)) return 'buxton';
    if (/^PART\s*THIRD/i.test(head)) return 'fishersfield';
    if (/^ADDITIONS/.test(head)) return 'additions';
    if (/^(?:APPENDIX|INDEX|CORRECTIONS|NAMESOFPERSONS|CHRISTIANNAMES)/.test(head)) return 'skip';
    if (/LISTOFSUBSCRIBERS/.test(head)) return 'skip';
    if (currentMode === 'front' && /No\.\s*[1Il]\.\s*WILLIAM\s*LANE/.test(rawText)) return 'boston';
    return currentMode;
  }
  if (volume === 2) {
    if (/DORCHESTER/i.test(head) || /WILLIAM\s*LANE.*DORCHESTER/i.test(head)) return 'dorchester';
    if (/STRATFORD/i.test(head) || /ROBERT\s*LANE/i.test(head)) return 'stratford';
    if (/MILFORD/i.test(head) && /LANE/i.test(head)) return 'milford';
    if (/MERRIFIELD/i.test(head)) return 'merrifield';
    if (/NEW\s*LONDON/i.test(head) || /DANIEL\s*LANE/i.test(head)) return 'newlondon';
    if (/\bRYE\b/i.test(head) || /GEORGE\s*LANE/i.test(head)) return 'rye';
    if (/^(?:APPENDIX|INDEX|CORRECTIONS|NAMESOFPERSONS|CHRISTIANNAMES)/.test(head)) return 'skip';
    if (currentMode === 'front' && /No\.\s*[1Il]\./.test(rawText)) return options.defaultSection || 'dorchester';
    return currentMode === 'front' ? options.defaultSection || 'dorchester' : currentMode;
  }
  if (volume === 3) {
    if (/RICKMANSWORTH/i.test(head) || /ENGLISH\s*FAMILY/i.test(head)) return 'rickmansworth';
    if (/JOB\s*LANE/i.test(head) || /MALDEN/i.test(head) || /BILLERICA/i.test(head)) return 'joblane';
    if (/CASCO/i.test(head) || /NORTH\s*YARMOUTH/i.test(head) || /JAMES\s*LANE/i.test(head)) return 'casco';
    if (/EDWARD\s*LANE/i.test(head)) return 'edwardlane';
    if (/^(?:APPENDIX|INDEX|CORRECTIONS|NAMESOFPERSONS|CHRISTIANNAMES)/.test(head)) return 'skip';
    if (currentMode === 'front' && /No\.\s*[1Il]\./.test(rawText)) return options.defaultSection || 'joblane';
    return currentMode === 'front' ? options.defaultSection || 'joblane' : currentMode;
  }
  return currentMode;
}

/**
 * Internet Archive djvu OCR for Vol. II/III inserts spaces between nearly every token
 * ("No.  5,  WILLIAM  LANE"). Collapse to the glued form the Vol. I PDF parsers expect.
 */
export function collapseSpacedOcr(text = '') {
  return String(text || '')
    .replace(/\r\n/g, '\n')
    .replace(/\n/g, ' ')
    .replace(/\s+/g, '')
    // Common Fitts OCR swaps once spaces are gone
    .replace(/LAXE/g, 'LANE')
    .replace(/I\.ANE/g, 'LANE')
    .replace(/LAME(?=[,(0-9])/g, 'LANE');
}

/**
 * pages: [{ pdfPage, text }] -> { sections: { boston: { text, pageStarts: [{offset, pdfPage}] }, ... } }
 */
export function buildSectionStreams(pages = [], options = {}) {
  const sections = {};
  let mode = 'front';
  let lastEvenPrinted = null;
  const volume = options.volume || 1;
  const collapse = volume > 1 || options.collapseSpaces === true;
  for (const page of pages) {
    const raw = String(page?.text || '');
    if (!raw.trim()) continue;
    mode = detectPageMode(raw, mode, options);
    const expectedOdd = lastEvenPrinted != null ? lastEvenPrinted + 1 : null;
    // Running-header strip expects lightly spaced text; collapse after.
    const stripped = stripRunningHeader(raw, expectedOdd);
    let text = stripped.text;
    const printedPage = stripped.printedPage;
    if (printedPage != null && EVEN_HEADER_RE.test(raw)) lastEvenPrinted = printedPage;
    else if (EVEN_HEADER_RE.test(raw) && lastEvenPrinted != null) lastEvenPrinted += 2;
    if (mode === 'front' || mode === 'skip') continue;
    if (!sections[mode]) sections[mode] = { key: mode, text: '', pageStarts: [], volume };
    const sec = sections[mode];
    sec.pageStarts.push({ offset: sec.text.length, pdfPage: page.pdfPage });
    const body = collapse ? collapseSpacedOcr(text) : text.replace(/\n/g, '');
    sec.text += body + (collapse ? '' : ' ');
  }
  return { sections };
}

export function pdfPageAtOffset(section, offset) {
  let page = null;
  for (const ps of section?.pageStarts || []) {
    if (ps.offset <= offset) page = ps.pdfPage;
    else break;
  }
  return page;
}

/* ------------------------------------------------------------------ */
/* Family header parsing                                               */
/* ------------------------------------------------------------------ */

const FAMILY_HEADER_RE =
  /No\s*\.?\s*([0-9IlOoSig|]{1,4}a?)\s*[.,]\s*(?=(?:\[[^\]]{0,60}\]\s*)?(?:BY\s*J\.?\s*H\.?\s*F(?:ITTS)?\.?\]?\s*)?[A-Z][A-Z.'\-^]{2})/g;

/**
 * Vol. II / III (Fitts) family heads look like:
 *   "6.EBENEZERLANE^(George--,William'),1650-1726"
 *   "27.ABIALLANE,1735-1803"
 * rather than Chapman/Fitts Vol. I "No. N. NAME".
 */
const FITTS_FAMILY_HEADER_RE =
  /(?<![0-9A-Za-z])(\d{1,3})\.((?:DEACON|CAPT|LT|REV|DR|COL|MAJOR|CORNET|ENSIGN)?[A-Z][A-Z.'\-]{1,36}LANE)/g;

function finalizeFamilyBlocks(section, blocks) {
  for (let i = 0; i < blocks.length; i += 1) {
    const end = i + 1 < blocks.length ? blocks[i + 1].start : (section?.text || '').length;
    blocks[i].text = (section?.text || '').slice(blocks[i].bodyStart, end);
  }
  return blocks;
}

/** Split a section stream into family blocks using monotonic "No. N." headers (Vol. I). */
export function splitFamilyBlocks(section) {
  const text = section?.text || '';
  const blocks = [];
  let lastNo = 0;
  FAMILY_HEADER_RE.lastIndex = 0;
  let m;
  while ((m = FAMILY_HEADER_RE.exec(text)) !== null) {
    const before = text.slice(Math.max(0, m.index - 20), m.index);
    if (/See[^\]]*$/i.test(before)) continue;
    const parsed = parseFamilyNumber(m[1]);
    if (!parsed) continue;
    const isSuffixRepeat = parsed.suffix && parsed.no === lastNo;
    if (!isSuffixRepeat) {
      if (lastNo === 0 && parsed.no > 3) continue;
      if (lastNo > 0 && (parsed.no <= lastNo || parsed.no > lastNo + 15)) continue;
    }
    blocks.push({
      section: section.key,
      familyNo: parsed.no,
      familyKey: parsed.key,
      start: m.index,
      bodyStart: m.index + m[0].length,
      pdfPage: pdfPageAtOffset(section, m.index)
    });
    lastNo = parsed.no;
  }
  return finalizeFamilyBlocks(section, blocks);
}

/** Split Fitts Vol. II / III section streams on "N.NAMELANE" family heads. */
export function splitFittsFamilyBlocks(section) {
  const text = section?.text || '';
  const blocks = [];
  let lastNo = 0;
  FITTS_FAMILY_HEADER_RE.lastIndex = 0;
  let m;
  while ((m = FITTS_FAMILY_HEADER_RE.exec(text)) !== null) {
    const parsed = parseFamilyNumber(m[1]);
    if (!parsed) continue;
    // Skip tiny arabic list items that aren't family heads (1–3 without LANE pedigree/lifespan nearby).
    const peek = text.slice(m.index, m.index + m[0].length + 80);
    const looksLikeHead =
      /\([A-Za-z]/.test(peek) ||
      /1[5-9]\d{2}/.test(peek) ||
      /(?:andhis|m\.|married|bap|bapt|born|d\.|died)/i.test(peek);
    if (!looksLikeHead && parsed.no > 3) continue;
    if (lastNo > 0 && (parsed.no <= lastNo || parsed.no > lastNo + 40)) continue;
    if (lastNo === 0 && parsed.no > 20) continue;
    blocks.push({
      section: section.key,
      familyNo: parsed.no,
      familyKey: parsed.key,
      start: m.index,
      // Keep the NAME LANE token inside the block so parseFamilyHeader can read the head.
      bodyStart: m.index + String(m[1]).length + 1,
      pdfPage: pdfPageAtOffset(section, m.index),
      style: 'fitts'
    });
    lastNo = parsed.no;
  }
  return finalizeFamilyBlocks(section, blocks);
}

const WIFE_CLAUSE_RE =
  /(?:and\s*his\s*|and\s*(?=w\.))(?:first\s*|second\s*)?(?:\(\s*[0-9iIl]\s*\)\s*)?(?:wife|vv|w)\s*[.,]?\s*,?\s*(?=[A-Z(])|His\s*wife\s*was\s*/;

function stripTitles(upper) {
  let s = upper;
  const titles = [];
  let changed = true;
  while (changed) {
    changed = false;
    for (const t of DOTTED_TITLES) {
      const re = new RegExp(`^${t}\\.\\s*`);
      if (re.test(s)) {
        titles.push(titleCase(t) + '.');
        s = s.replace(re, '');
        changed = true;
      }
    }
    for (const t of GLUED_TITLES) {
      if (s.startsWith(t) && s.length - t.length >= 3) {
        titles.push(titleCase(t));
        s = s.slice(t.length).replace(/^[.\s]+/, '');
        changed = true;
      }
    }
  }
  return { rest: s, titles };
}

function pickKnownGiven(candidates, givenSet) {
  for (const c of candidates) {
    if (c && givenSet.has(c.toLowerCase())) return c;
  }
  return candidates[0];
}

/**
 * Rejoin OCR-split given names ("Eliza Beth" → "Elizabeth") and fix known letter swaps
 * ("Bathsheea" → "Bathsheba"). Safe no-op when the name is already clean.
 */
export function repairSplitGivenName(name = '', givenSet = new Set(DEFAULT_GIVEN_NAMES)) {
  let s = String(name || '')
    .replace(/[^A-Za-z\s.-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!s) return s;
  const lower = s.toLowerCase();
  if (OCR_GIVEN_REPAIRS[lower]) return titleCase(OCR_GIVEN_REPAIRS[lower]);
  const joined = squash(s);
  if (OCR_GIVEN_REPAIRS[joined]) return titleCase(OCR_GIVEN_REPAIRS[joined]);
  if (givenSet.has(joined) || DEFAULT_GIVEN_NAMES.includes(joined)) return titleCase(joined);
  if (NICKNAME_CANONICAL.has(joined)) return titleCase(joined);
  const words = lower.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    const mashed = words.join('');
    if (OCR_GIVEN_REPAIRS[mashed] || givenSet.has(mashed) || DEFAULT_GIVEN_NAMES.includes(mashed) || NICKNAME_CANONICAL.has(mashed)) {
      return titleCase(OCR_GIVEN_REPAIRS[mashed] || mashed);
    }
  }
  return titleCase(s);
}

/** "SAMUELA." -> "Samuel A.", "DANIELWARD" -> "Daniel Ward" (when both parts are known given names). */
export function formatGlued(upper = '', givenSet = new Set(DEFAULT_GIVEN_NAMES)) {
  const s = String(upper || '').replace(/[^A-Za-z.\s]/g, '').trim();
  const parts = s.split(/(?<=\.)|\s+/).map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (const part of parts) {
    const initial = part.match(/^([A-Za-z]{3,})([A-Za-z])\.$/);
    if (initial) {
      out.push(titleCase(splitKnownGiven(initial[1], givenSet)), `${initial[2].toUpperCase()}.`);
      continue;
    }
    out.push(titleCase(splitKnownGiven(part.replace(/\.$/, ''), givenSet)) + (part.endsWith('.') && part.length <= 2 ? '.' : ''));
  }
  return repairSplitGivenName(out.join(' ').replace(/\s+/g, ' ').trim(), givenSet);
}

function splitKnownGiven(word, givenSet) {
  const lower = word.toLowerCase();
  if (OCR_GIVEN_REPAIRS[lower]) return OCR_GIVEN_REPAIRS[lower];
  if (givenSet.has(lower)) return lower;
  for (let i = lower.length - 3; i >= 3; i -= 1) {
    const a = lower.slice(0, i);
    const b = lower.slice(i);
    if ((givenSet.has(a) || NICKNAME_CANONICAL.has(a)) && (givenSet.has(b) || NICKNAME_CANONICAL.has(b))) return `${a} ${b}`;
  }
  return lower;
}

/** "(Sam.^VVm.i)" -> { names: ['Samuel','William'], text: 'Sam., Wm.' } */
export function parsePedigree(raw = '') {
  let s = String(raw || '')
    .replace(/VV/g, 'W')
    .replace(/\]n/g, 'Jn')
    .replace(/Wra\b/g, 'Wm')
    .replace(/^\s*(?:dau\s*\.?|s\s*\.)\s*(?:of)?\s*/i, '');
  s = s.replace(/(^|[,\s.^'"0-9])([a-z])/g, (_, pre, c) => pre + c.toUpperCase());
  const tokens = [...s.matchAll(/([A-Z][a-z]{1,9})/g)].map((m) => m[1]);
  const names = [];
  const abbrevs = [];
  for (const tok of tokens) {
    const key = tok.toLowerCase();
    if (PEDIGREE_STOPWORDS.has(key)) continue;
    abbrevs.push(tok);
    names.push(PEDIGREE_ABBREVIATIONS[key] || tok);
  }
  return { names, text: abbrevs.map((a) => (PEDIGREE_ABBREVIATIONS[a.toLowerCase()] ? `${a}.` : a)).join(', ') };
}

/**
 * Parse one person from a header segment, e.g.
 *   "SAMUELLANE2(William')1651-1690,a(soldier..."
 *   "JOHNS(Josh.'i,josh.3,Wm.2)LANE,1750-1823,ofCandia,"
 *   "MARY(dau.ofJosh.Wm.')LANE,1720-1797,"
 *   "SARAH(DICKINSON)."
 */
export function parseHeaderPerson(segment = '', givenSet = new Set(DEFAULT_GIVEN_NAMES)) {
  let seg = String(segment || '').replace(/[\^�*"`]/g, '').trim();
  let alias = null;
  const aliasM = seg.match(/^\(([A-Z]{3,})\)\s*/);
  if (aliasM) {
    alias = titleCase(aliasM[1]);
    seg = seg.slice(aliasM[0].length);
  }
  const upM = seg.match(/^([A-Z][A-Z0.'\-\s]*[A-Z0.])/);
  if (!upM) return null;
  let upper = upM[1].replace(/0/g, 'O').replace(/['\-\s]+$/g, '').replace(/[\s'-]/g, '');
  let rest = seg.slice(upM[0].length);
  const { rest: noTitles, titles } = stripTitles(upper);
  upper = noTitles;

  let surname = null;
  let givenRaw = upper;
  let pedigreeRaw = null;
  let maiden = null;
  let parentNote = null;

  const laneTail = upper.match(/^(.*?)L\.?AN[EP][CSPIJT]?$/);
  if (laneTail && laneTail[1].replace(/[^A-Z]/g, '').length >= 2) {
    surname = 'Lane';
    givenRaw = laneTail[1];
  } else {
    const pedLane = rest.match(/^[\s0-9SCP'\-.,]{0,4}\(([^)]{0,90})\)\s*,?\s*L\s*\.?\s*[A-Z-]{0,2}N[EP]/);
    if (pedLane) {
      surname = 'Lane';
      pedigreeRaw = pedLane[1];
      rest = rest.slice(pedLane[0].length);
      givenRaw = upper.replace(/[-']+$/, '');
      if (/[A-Z]$/.test(givenRaw)) {
        const g = givenRaw.toLowerCase();
        givenRaw = pickKnownGiven([g, g.slice(0, -1), `${g.slice(0, -1)}i`], givenSet).toUpperCase();
      }
    } else {
      const sonOf = rest.match(/^\s*\(((?:s|dau)\.?\s*of[^)]{0,80})\)\s*([A-Z][A-Z]{2,})/);
      const paren = rest.match(/^\s*\(([A-Z][A-Z\s.,]*?)\s*,?\)/);
      if (sonOf) {
        parentNote = sonOf[1];
        surname = titleCase(sonOf[2]);
        rest = rest.slice(sonOf[0].length);
      } else if (paren) {
        maiden = titleCase(paren[1].replace(/[^A-Z\s]/g, ' ').trim());
        rest = rest.slice(paren[0].length);
        if (squash(maiden) === 'lane') surname = 'Lane';
        const dauLane = rest.match(/^\s*\(([^)]{0,90})\)\s*,?\s*LANE/);
        if (dauLane) pedigreeRaw = dauLane[1];
      } else {
        const dauPed = rest.match(/^[\s0-9SCP'\-.,]{0,4}\(([^)]{0,90})\)\s*,?\s*\(?LANE\)?/);
        if (dauPed) {
          surname = 'Lane';
          pedigreeRaw = dauPed[1];
          rest = rest.slice(dauPed[0].length);
        }
      }
      if (!surname && !maiden) {
        const split = splitGivenSurname(upper, givenSet);
        if (split) {
          givenRaw = split.given;
          surname = titleCase(split.surname);
        }
      }
    }
  }

  if (!pedigreeRaw) {
    // Leading generation superscript / footnote dagger OCR ("2", "^", "t", "f") before the pedigree.
    const ped = rest.match(/^[\s0-9SCPIJTitf'\-.,]{0,4}\(([^)]{1,90})\)/);
    if (ped && !/^\s*(?:s|dau)\.?\s*of/i.test(ped[1]) && /[A-Z][a-z]/.test(ped[1])) {
      pedigreeRaw = ped[1];
      rest = rest.slice(ped.index + ped[0].length);
    } else if (ped && /^\s*dau\.?\s*of/i.test(ped[1])) {
      pedigreeRaw = ped[1];
      rest = rest.slice(ped.index + ped[0].length);
    }
  }

  const given = formatGlued(givenRaw, givenSet);
  if (!given || squash(given).length < 2) return null;
  const pedigree = pedigreeRaw ? parsePedigree(pedigreeRaw) : { names: [], text: '' };
  const { birthYear, deathYear } = parseLifespan(rest.slice(0, 40));

  return {
    given,
    surname,
    maiden,
    alias,
    titles,
    parentNote,
    pedigree: pedigree.names,
    pedigreeText: pedigree.text ? `(${pedigree.text})` : '',
    birthYear,
    deathYear,
    displayName: [given, maiden ? `(${maiden})` : '', surname || ''].filter(Boolean).join(' ')
  };
}

function splitGivenSurname(upper, givenSet) {
  const s = upper.replace(/[^A-Z.]/g, '');
  const initial = s.match(/^([A-Z]{3,}[A-Z]\.)([A-Z]{3,})$/);
  if (initial) return { given: initial[1], surname: initial[2] };
  const lower = s.replace(/\./g, '').toLowerCase();
  for (let i = Math.min(lower.length - 3, 10); i >= 3; i -= 1) {
    if (givenSet.has(lower.slice(0, i))) return { given: lower.slice(0, i).toUpperCase(), surname: lower.slice(i).toUpperCase() };
  }
  return null;
}

/** Parse the head + first wife of a family block, plus later "By (2) w." wives. */
export function parseFamilyHeader(blockText = '', givenSet = new Set(DEFAULT_GIVEN_NAMES)) {
  let h = String(blockText || '').slice(0, 900);
  const prefix = h.match(/^\s*(?:\[[^\]]{0,60}\]\s*)?(?:BY\s*J\.?\s*H\.?\s*F(?:ITTS)?\.?\]?\s*)?/);
  const offset = prefix ? prefix[0].length : 0;
  h = h.slice(offset);
  const wifeM = h.match(WIFE_CLAUSE_RE);
  const headSeg = wifeM ? h.slice(0, wifeM.index) : h.slice(0, 260);
  const head = parseHeaderPerson(headSeg, givenSet);
  const wives = [];
  let headerEnd = offset + headSeg.length;
  if (wifeM) {
    const after = h.slice(wifeM.index + wifeM[0].length);
    const stop = after.search(/(?:,|\s)*(?:had|hkd|Had)\b|had[b:.,]|:/);
    const wifeSeg = after.slice(0, stop > 0 ? Math.min(stop, 200) : 160);
    const wife = parseHeaderPerson(wifeSeg, givenSet);
    if (wife) wives.push({ ...wife, order: 1, position: 0 });
    headerEnd = offset + wifeM.index + wifeM[0].length + wifeSeg.length;
  }
  const byWifeRe = /By\s*(?:his\s*)?\(\s*([2-4])\s*\)\s*(?:vv|w|d\s*w)\s*\.?\s*,?\s*([A-Z][A-Z.\s]*\(?[A-Z][A-Z.\s,]*\)?)/g;
  let bw;
  while ((bw = byWifeRe.exec(blockText)) !== null) {
    const wife = parseHeaderPerson(bw[2], givenSet);
    // "By his (2) w. DAVID LANE had:" restates the husband, not the wife.
    if (wife && !(head && squash(wife.given) === squash(head.given))) wives.push({ ...wife, order: Number(bw[1]), position: bw.index });
  }
  return { head, wives, headerEnd };
}

/* ------------------------------------------------------------------ */
/* Children lists                                                      */
/* ------------------------------------------------------------------ */

const CHILD_TITLE_RE = /^(?:Dea|Deacon|Lt|Lieut|Lieutenant|Capt|Captain|Col|Dr|Rev|Hon|Esq|Major|Maj|Cornet|Ensign|Gen|Mrs)\s*[.,]?\s*/;
const CHILD_MARKER_RE =
  /(?:\(\s*([^()\s]{1,6})\s*\)\s*[\^\-'"*�]*\s*)?(?:(?<![A-Za-z0-9])([IVX]{1,5})\s*[.\-](?!\s*\))|(?<![A-Za-z0-9.])([1-9][0-9]?)\s*[.\-](?!\s*\)|\d)|(?<![A-Za-z0-9])([1-9I])\s*[.,]?\s*\))\s*/g;

function cleanChildName(raw = '') {
  let s = String(raw || '').replace(/^y(?=[aeiou])/, 'J');
  s = s.replace(/[^A-Za-z]/g, ' ').trim();
  const tokens = s.split(/\s+/).filter(Boolean);
  const first = tokens[0] || '';
  const words = first.split(/(?<=[a-z])(?=[A-Z][a-z])/);
  let cleaned = words
    .map((w) => w.replace(/(?<=[a-z]{3})[A-Z]$/, ''))
    .map((w) => (w.length > 1 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .filter((w) => w.length >= 2)
    .join(' ');
  // Keep a second OCR-split token when joining yields a known given ("Eliza Beth").
  if (tokens.length >= 2 && tokens[1].length >= 3 && tokens[1].length <= 6) {
    const trial = repairSplitGivenName(`${cleaned} ${tokens[1]}`);
    if (squash(trial) !== squash(cleaned)) cleaned = trial;
  } else {
    cleaned = repairSplitGivenName(cleaned);
  }
  return cleaned;
}

/**
 * Children in a family block body. Level 1 = Roman (children of the head), level 2 = "1." under the
 * last Roman child, level 3 = "1.)" under the last level-2 (or level-1) child. Sequence checks drop
 * dates/page numbers that look like list markers.
 */
export function extractChildren(body = '', wives = []) {
  const text = String(body || '');
  const markers = [];
  CHILD_MARKER_RE.lastIndex = 0;
  let m;
  while ((m = CHILD_MARKER_RE.exec(text)) !== null) {
    if (m[0].length === 0) {
      CHILD_MARKER_RE.lastIndex += 1;
      continue;
    }
    const after = text.slice(m.index + m[0].length);
    const titleM = after.match(CHILD_TITLE_RE);
    const nameStart = titleM ? titleM[0].length : 0;
    const nameM = after.slice(nameStart).match(/^([A-Zy][A-Za-z/]{1,30})/);
    if (!nameM) continue;
    let level;
    let value;
    let order;
    if (m[2]) {
      level = 1;
      value = romanToInt(m[2]);
      order = m[2];
    } else if (m[3]) {
      level = 2;
      value = Number.parseInt(m[3], 10);
      order = `${value}.`;
    } else {
      level = 3;
      value = m[4] === 'I' ? 1 : Number.parseInt(m[4], 10);
      order = `${value}.)`;
    }
    markers.push({
      level,
      value,
      order,
      carryForward: m[1] ? normalizeCarryForward(m[1]) : null,
      carryForwardRaw: m[1] || null,
      index: m.index,
      title: titleM ? titleM[0].replace(/[.,\s]+$/, '') : null,
      name: cleanChildName(nameM[1])
    });
  }

  const children = [];
  let lastL1 = 0;
  let lastL2 = 0;
  let lastL3 = 0;
  let curL1 = -1;
  let curL2 = -1;
  for (const mk of markers) {
    if (!mk.name || mk.name.length < 2) continue;
    if (mk.level === 1) {
      if (!(mk.value > lastL1 && mk.value <= lastL1 + 2)) continue;
      if (lastL1 === 0 && mk.value > 2) continue;
      lastL1 = mk.value;
      lastL2 = 0;
      lastL3 = 0;
      curL2 = -1;
      const wifeIdx = wives.reduce((acc, w, i) => (w.position && w.position < mk.index ? i : acc), 0);
      children.push({ ...mk, parentIndex: null, wifeIndex: wives.length ? wifeIdx : null });
      curL1 = children.length - 1;
    } else if (mk.level === 2) {
      if (curL1 < 0) continue;
      if (!(mk.value > lastL2 && mk.value <= lastL2 + 2)) continue;
      if (lastL2 === 0 && mk.value > 2) continue;
      lastL2 = mk.value;
      lastL3 = 0;
      children.push({ ...mk, parentIndex: curL1, wifeIndex: null });
      curL2 = children.length - 1;
    } else {
      const parent = curL2 >= 0 ? curL2 : curL1;
      if (parent < 0) continue;
      if (!(mk.value > lastL3 && mk.value <= lastL3 + 2)) continue;
      if (lastL3 === 0 && mk.value > 2) continue;
      lastL3 = mk.value;
      children.push({ ...mk, parentIndex: parent, wifeIndex: null });
    }
  }
  for (let i = 0; i < children.length; i += 1) {
    const nextIdx = i + 1 < children.length ? children[i + 1].index : text.length;
    const segment = text.slice(children[i].index, nextIdx);
    children[i].birthYear = parseChildBirthYear(segment);
    children[i].segment = segment.slice(0, 240);
  }
  return children;
}

/* ------------------------------------------------------------------ */
/* Register: blocks + headers + children + family links                */
/* ------------------------------------------------------------------ */

function givenKey(name = '') {
  return squash(String(name || '').split(/\s+/)[0]).slice(0, 3);
}

function nicknameKey(name = '') {
  const first = squash(String(name || '').split(/\s+/)[0]);
  if (!first) return '';
  return NICKNAME_CANONICAL.get(first) || first;
}

/** True when two given names match by 3-letter prefix or known nickname/diminutive. */
export function namesAgree(a, b) {
  const ka = givenKey(a);
  const kb = givenKey(b);
  if (ka.length >= 2 && ka === kb) return true;
  const na = nicknameKey(a);
  const nb = nicknameKey(b);
  return na.length >= 2 && na === nb;
}

function pedigreeAgrees(childPed = [], parentPed = []) {
  const n = Math.min(childPed.length, parentPed.length);
  for (let i = 0; i < n; i += 1) {
    if (!namesAgree(childPed[i], parentPed[i])) return false;
  }
  return true;
}

/**
 * pages -> register of family blocks with decoded heads, wives, children and family-to-family links.
 */
export function decodeGenealogyRegister(pages = [], options = {}) {
  const givenSet = options.givenSet || new Set(DEFAULT_GIVEN_NAMES);
  const { sections } = buildSectionStreams(pages, options);
  const families = [];
  const volume = options.volume || 1;
  for (const section of Object.values(sections)) {
    const blocks = volume > 1 ? splitFittsFamilyBlocks(section) : splitFamilyBlocks(section);
    for (const block of blocks) {
      const header = parseFamilyHeader(block.text, givenSet);
      const body = block.text.slice(header.headerEnd);
      const children = extractChildren(body, header.wives);
      for (const c of children) c.pdfPage = pdfPageAtOffset(section, block.bodyStart + header.headerEnd + c.index);
      let lineal = 'head';
      if (!header.head || header.head.surname !== 'Lane') {
        const laneWife = header.wives.find((w) => w.surname === 'Lane' || w.pedigree.length);
        if (laneWife) lineal = 'wife';
        else if (header.head?.parentNote && /lane/i.test(header.head.parentNote)) lineal = 'head';
        else if (header.wives.length) lineal = 'wife';
      }
      families.push({
        section: section.key,
        sectionLabel: SECTION_LABELS[section.key] || section.key,
        volume: options.volume || section.volume || 1,
        familyNo: block.familyNo,
        familyKey: block.familyKey,
        pdfPage: block.pdfPage,
        head: header.head,
        wives: header.wives,
        lineal,
        children,
        parentLink: null,
        generation: null
      });
    }
  }

  linkFamilies(families);
  return { families, sections: Object.keys(sections) };
}

function linealPerson(family) {
  if (!family) return null;
  if (family.lineal === 'wife') return family.wives[0] || null;
  return family.head;
}

/** Link each family to the family its lineal person was born into (carry-forward first, pedigree second). */
function linkFamilies(families) {
  const bySection = new Map();
  for (const f of families) {
    if (!bySection.has(f.section)) bySection.set(f.section, new Map());
    bySection.get(f.section).set(f.familyNo, f);
  }

  for (const parent of families) {
    const sectionMap = bySection.get(parent.section);
    parent.children.forEach((child, childIndex) => {
      if (child.level !== 1 || !child.carryForward) return;
      const target = sectionMap.get(child.carryForward);
      if (!target || target.familyNo <= parent.familyNo || target.parentLink) return;
      const nameMatchHead = target.head && namesAgree(child.name, target.head.given);
      const nameMatchWife = target.wives[0] && namesAgree(child.name, target.wives[0].given);
      if (nameMatchWife && !nameMatchHead) target.lineal = 'wife';
      if (nameMatchHead && !nameMatchWife) target.lineal = 'head';
      const lp = linealPerson(target);
      const parentLp = parent.head;
      const pedOk = lp?.pedigree?.length ? namesAgree(lp.pedigree[0], parentLp?.given) || namesAgree(lp.pedigree[0], linealPerson(parent)?.given) : false;
      if (!nameMatchHead && !nameMatchWife && !pedOk) return;
      target.parentLink = {
        familyNo: parent.familyNo,
        childIndex,
        childOrder: child.order,
        carryForwardNo: child.carryForward,
        method: 'carry-forward',
        confidence: (nameMatchHead || nameMatchWife) && pedOk ? 'high' : 'medium'
      };
      child.linkedFamilyNo = target.familyNo;
    });
  }

  for (const target of families) {
    if (target.parentLink) continue;
    const lp = linealPerson(target);
    if (!lp?.pedigree?.length) continue;
    const candidates = families.filter((p) => {
      if (p.section !== target.section || p.familyNo >= target.familyNo) return false;
      if (p.lineal !== 'head' || !p.head || p.head.surname !== 'Lane') return false;
      if (!namesAgree(lp.pedigree[0], p.head.given)) return false;
      if (lp.pedigree.length < 2) {
        return lp.pedigree.length - 1 === p.head.pedigree.length && p.children.some((c) => c.level === 1 && namesAgree(c.name, lp.given));
      }
      if (!p.head.pedigree.length) return false;
      return pedigreeAgrees(lp.pedigree.slice(1), p.head.pedigree);
    });
    if (candidates.length !== 1) continue;
    const parent = candidates[0];
    const childIndex = parent.children.findIndex((c) => c.level === 1 && namesAgree(c.name, lp.given));
    target.parentLink = {
      familyNo: parent.familyNo,
      childIndex: childIndex >= 0 ? childIndex : null,
      childOrder: childIndex >= 0 ? parent.children[childIndex].order : null,
      carryForwardNo: null,
      method: 'pedigree',
      confidence: childIndex >= 0 ? 'medium' : 'low'
    };
    if (childIndex >= 0) parent.children[childIndex].linkedFamilyNo = target.familyNo;
  }

  const sorted = [...families].sort((a, b) => a.familyNo - b.familyNo);
  for (const f of sorted) {
    if (f.parentLink) {
      const parent = bySection.get(f.section).get(f.parentLink.familyNo);
      if (parent?.generation) f.generation = parent.generation + 1;
    } else if (f.familyNo === 1) {
      f.generation = 1;
    }
    if (!f.generation) {
      const lp = linealPerson(f);
      if (lp?.pedigree?.length) f.generation = lp.pedigree.length + 1;
    }
  }
}

/* ------------------------------------------------------------------ */
/* Resolution against laneData                                         */
/* ------------------------------------------------------------------ */

const NODE_TITLE_PREFIX_RE =
  /^(?:(?:[ivx]{1,4}|no|lieutenant|lieut|lt|captain|capt|cornet|deacon|dea|colonel|col|major|maj|rev|dr|esq|hon|ensign|mrs|mr)\b[\s.\-]*)+/i;

function parseYearValue(value) {
  if (value == null || value === '') return null;
  const m = String(value).match(/(1[5-9]\d{2})/);
  return m ? Number.parseInt(m[1], 10) : null;
}

export function buildNodeIndex(laneData) {
  const nodes = Array.isArray(laneData?.nodes) ? laneData.nodes : [];
  const links = Array.isArray(laneData?.links) ? laneData.links : [];
  const degree = new Map();
  const spouses = new Map();
  const parents = new Map();
  for (const l of links) {
    degree.set(l.source, (degree.get(l.source) || 0) + 1);
    degree.set(l.target, (degree.get(l.target) || 0) + 1);
    if (l.relation === 'spouse') {
      if (!spouses.has(l.source)) spouses.set(l.source, new Set());
      if (!spouses.has(l.target)) spouses.set(l.target, new Set());
      spouses.get(l.source).add(l.target);
      spouses.get(l.target).add(l.source);
    } else if (l.relation === 'father' || l.relation === 'mother') {
      if (!parents.has(l.source)) parents.set(l.source, {});
      parents.get(l.source)[l.relation] = l.target;
    }
  }
  const entries = nodes.map((n) => {
    const name = String(n?.name || '');
    const parens = [...name.matchAll(/\(([^)]*)\)/g)].map((m) => squash(m[1]));
    const plain = name.replace(/\([^)]*\)/g, ' ').replace(NODE_TITLE_PREFIX_RE, '').trim();
    const sq = squash(plain);
    return {
      id: n.id,
      node: n,
      sq,
      sqWithParens: squash(name.replace(NODE_TITLE_PREFIX_RE, '')),
      parens,
      first: squash(plain.split(/\s+/)[0] || ''),
      birthYear: parseYearValue(n.birthYear),
      deathYear: parseYearValue(n.deathYear),
      gender: n.gender,
      degree: degree.get(n.id) || 0,
      spouseCount: spouses.get(n.id)?.size || 0
    };
  });
  const children = new Map();
  for (const [childId, p] of parents) {
    for (const pid of [p.father, p.mother]) {
      if (pid == null) continue;
      if (!children.has(pid)) children.set(pid, new Set());
      children.get(pid).add(childId);
    }
  }
  const givenSet = new Set(DEFAULT_GIVEN_NAMES);
  const counts = new Map();
  for (const e of entries) counts.set(e.first, (counts.get(e.first) || 0) + 1);
  for (const [k, c] of counts) if (k.length >= 3 && c >= 3) givenSet.add(k);
  return { entries, byId: new Map(entries.map((e) => [e.id, e])), spouses, parents, children, givenSet };
}

/** First name of a node's existing father/mother in laneData, or null. */
function existingParentFirst(index, id, role) {
  const pid = index.parents.get(id)?.[role];
  if (pid == null) return null;
  return index.byId.get(pid)?.first || null;
}

function nameLevel(entry, query) {
  const g = squash(query.given);
  const g1 = squash(String(query.given || '').split(/\s+/)[0]);
  const sur = squash(query.surname || '');
  const maiden = squash(query.maiden || '');
  if (!g1) return 0;
  const bareOk = !sur || sur === 'lane';
  const exact = new Set([g + sur, bareOk ? g : '', g + maiden + sur, g + maiden].filter(Boolean));
  if (exact.has(entry.sq) || exact.has(entry.sqWithParens)) return 3;
  const tail = entry.sqWithParens.slice(g.length);
  if (entry.sqWithParens.startsWith(g) && ((sur && tail.includes(sur)) || (maiden && tail.includes(maiden)))) return 2;
  if (entry.first === g1 && ((sur && entry.sqWithParens.includes(sur)) || (maiden && entry.sqWithParens.includes(maiden)))) return 1;
  if (entry.first === g1 && ((entry.sq === g1 && bareOk) || query.anySurname)) return 1;
  return 0;
}

/**
 * Best laneData node for a decoded person. Requires a birth-year agreement unless `allowNoYear`
 * (then only exact name matches qualify). Returns { id, score, alternates } or null.
 */
export function resolvePerson(index, query, options = {}) {
  if (!query || !query.given) return null;
  const preferIds = options.preferIds || new Set();
  const excludeIds = options.excludeIds || new Set();
  const maiden = squash(query.maiden || '');
  const bornLane = !maiden && squash(query.surname || '') === 'lane';
  let best = null;
  let alternates = 0;
  for (const e of index.entries) {
    if (excludeIds.has(e.id)) continue;
    const lvl = nameLevel(e, query);
    if (!lvl) continue;
    const preferred = preferIds.has(e.id);
    if (options.maidenGuard) {
      const otherMaiden = e.parens.find((p) => p.length >= 3 && p !== 'lane');
      if (otherMaiden && ((maiden && maiden !== 'lane' && !otherMaiden.startsWith(maiden.slice(0, 4))) || bornLane)) continue;
    }
    let score = lvl;
    if (query.birthYear) {
      if (e.birthYear == null) {
        if (!preferred || lvl < 2) continue;
      } else {
        const d = Math.abs(e.birthYear - query.birthYear);
        if (d > 1) continue;
        score += d === 0 ? 4 : 2;
      }
    } else {
      if (!options.allowNoYear && !preferred) continue;
      const bare = e.sq === squash(query.given) || e.sq === `${squash(query.given)}lane`;
      if (preferred) {
        if ((lvl < 2 || bare) && e.spouseCount > 1) continue;
      } else if (lvl < 2 || !maiden || maiden === 'lane' || !e.sqWithParens.includes(maiden)) {
        continue;
      } else if (lvl === 3) {
        score += 2;
      }
    }
    for (const [role, want] of [['father', query.fatherGiven], ['mother', query.motherGiven]]) {
      if (!want) continue;
      const have = existingParentFirst(index, e.id, role);
      if (!have) continue;
      if (namesAgree(have, want)) score += 3;
      else if (options.strictParents) score = -Infinity;
      else score -= 3;
    }
    if (score === -Infinity) continue;
    if (query.deathYear && e.deathYear) score += Math.abs(e.deathYear - query.deathYear) <= 1 ? 2 : -2;
    if (preferred) score += 5;
    if (query.gender && e.gender && e.gender !== 'U' && e.gender !== query.gender) score -= 3;
    if (e.id < 132) score += 1;
    score += Math.min(e.degree, 4) * 0.25;
    if (!best || score > best.score) {
      if (best && best.score >= score - 0.5) alternates += 1;
      best = { id: e.id, score };
    } else if (score >= best.score - 0.5) {
      alternates += 1;
    }
  }
  if (!best || best.score < (options.minScore ?? 4)) return null;
  return { ...best, alternates };
}

/* ------------------------------------------------------------------ */
/* Plan + apply                                                        */
/* ------------------------------------------------------------------ */

function familyLabel(family) {
  return `${family.section === 'boston' ? '' : `${SECTION_LABELS[family.section] || family.section} · `}No. ${family.familyKey}`;
}

/**
 * Resolve decoded families against laneData and propose relationship edges.
 * Never creates people; unresolved entries go to the review queue.
 */
export function buildGenealogyCodePlan(register, laneData) {
  const index = buildNodeIndex(laneData);
  const families = register?.families || [];
  const byKey = new Map(families.map((f) => [`${f.section}|${f.familyNo}`, f]));
  const edges = [];
  const codes = new Map();
  const review = [];
  const resolvedFamilies = [];

  const addCode = (id, patch) => {
    if (id == null) return;
    const cur = codes.get(id) || {};
    const merged = { ...cur };
    for (const [k, v] of Object.entries(patch)) {
      if (v == null || v === '' || (Array.isArray(v) && !v.length)) continue;
      if (k === 'wifeOfFamilies') merged[k] = [...new Set([...(cur[k] || []), ...v])];
      else if (merged[k] == null) merged[k] = v;
    }
    codes.set(id, merged);
  };

  const addEdge = (childId, parentId, relation, provenance) => {
    if (childId == null || parentId == null || childId === parentId) return;
    edges.push({ source: childId, target: parentId, relation, provenance });
  };

  const parentFamilyOf = (f) => (f.parentLink ? byKey.get(`${f.section}|${f.parentLink.familyNo}`) : null);
  const linealIdOf = (f) => (f.lineal === 'wife' ? f.resolved.wifeIds[0] : f.resolved.headId);
  /** Book birth year for a lineal person: own lifespan, else the "b." year on the parent family's child line. */
  const linealQuery = (f, person) => {
    const q = { ...person };
    const parent = parentFamilyOf(f);
    if (!q.birthYear && parent && f.parentLink.childIndex != null) q.birthYear = parent.children[f.parentLink.childIndex]?.birthYear || null;
    if (person.pedigree?.length) q.fatherGiven = person.pedigree[0];
    return q;
  };

  // Phase A — heads (unique across the register), then wives preferring the head's laneData spouses.
  for (const f of families) {
    let head = null;
    if (f.head) {
      const q = f.lineal === 'head' ? linealQuery(f, f.head) : { ...f.head };
      head = resolvePerson(index, { ...q, gender: 'M' }, { minScore: 6 });
    }
    f.resolved = { headId: head?.id ?? null, headScore: head?.score ?? null, headAlternates: head?.alternates ?? 0, headMethod: head ? 'name-year' : null, wifeIds: [] };
    resolvedFamilies.push(f);
  }
  const usedHeads = new Map();
  for (const f of [...families].sort((a, b) => (b.resolved.headScore ?? 0) - (a.resolved.headScore ?? 0))) {
    const id = f.resolved.headId;
    if (id == null) continue;
    if (usedHeads.has(id)) {
      f.resolved.headId = null;
      f.resolved.headMethod = null;
      f.resolved.duplicateOf = familyLabel(usedHeads.get(id));
    } else {
      usedHeads.set(id, f);
    }
  }
  const resolveWives = (f) => {
    const headId = f.resolved.headId;
    const headSpouses = headId != null ? index.spouses.get(headId) || new Set() : new Set();
    f.resolved.wifeIds = f.wives.map((w, i) => {
      const q = f.lineal === 'wife' && i === 0 ? linealQuery(f, w) : { ...w };
      const r = resolvePerson(index, { ...q, gender: 'F' }, { preferIds: headSpouses, allowNoYear: true, maidenGuard: true, minScore: q.birthYear ? 6 : 5 });
      return r?.id ?? null;
    });
  };
  families.forEach(resolveWives);

  // Pass A2 — parent-family & carry-forward propagation: when the header omits lifespan,
  // prefer children of a resolved parent family (and inherit the child's book birth year).
  for (const f of families) {
    if (!f.parentLink) continue;
    const parent = byKey.get(`${f.section}|${f.parentLink.familyNo}`);
    if (!parent?.resolved) continue;
    const preferIds = new Set();
    for (const pid of [parent.resolved.headId, ...(parent.resolved.wifeIds || [])]) {
      if (pid == null) continue;
      for (const cid of index.children.get(pid) || []) preferIds.add(cid);
    }
    let inheritedYear = null;
    if (f.parentLink.childIndex != null && parent.children[f.parentLink.childIndex]) {
      inheritedYear = parent.children[f.parentLink.childIndex].birthYear || null;
    } else {
      const cf = parent.children.find(
        (c) => c.linkedFamilyNo === f.familyNo || c.carryForward === f.familyNo
      );
      if (cf?.birthYear) inheritedYear = cf.birthYear;
    }
    if (f.head && f.resolved.headId == null && preferIds.size) {
      const q = linealQuery(f, f.head);
      if (!q.birthYear && inheritedYear) q.birthYear = inheritedYear;
      const head = resolvePerson(
        index,
        { ...q, gender: 'M' },
        { preferIds, allowNoYear: !q.birthYear, minScore: q.birthYear ? 5 : 4 }
      );
      if (head && !usedHeads.has(head.id)) {
        f.resolved.headId = head.id;
        f.resolved.headScore = head.score;
        f.resolved.headAlternates = head.alternates ?? 0;
        f.resolved.headMethod = 'parent-family';
        usedHeads.set(head.id, f);
        resolveWives(f);
      }
    } else if (f.lineal === 'wife' && f.wives[0] && (f.resolved.wifeIds[0] == null) && preferIds.size) {
      const q = linealQuery(f, f.wives[0]);
      if (!q.birthYear && inheritedYear) q.birthYear = inheritedYear;
      const wife = resolvePerson(
        index,
        { ...q, gender: 'F' },
        { preferIds, allowNoYear: !q.birthYear, maidenGuard: true, minScore: q.birthYear ? 5 : 4 }
      );
      if (wife) {
        f.resolved.wifeIds[0] = wife.id;
        f.resolved.headMethod = f.resolved.headMethod || 'parent-family-wife';
      }
    }
  }

  // Phase B1 — level-1 children by name + birth year; a laneData father/mother shared by >=2 of them
  // (and agreeing with the book's given name) replaces or fills the family head/wife.
  const resolveLevel1 = (f, childIds) => {
    const headId = f.resolved.headId;
    const preferIds = new Set();
    for (const pid of [headId, ...f.resolved.wifeIds]) {
      if (pid != null) for (const cid of index.children.get(pid) || []) preferIds.add(cid);
    }
    f.children.forEach((c, i) => {
      if (c.level !== 1 || !c.birthYear) return;
      const mother = f.wives[c.wifeIndex ?? 0];
      const r = resolvePerson(
        index,
        { given: c.name, surname: f.head?.surname || 'Lane', birthYear: c.birthYear, fatherGiven: f.head?.given, motherGiven: mother?.given },
        { preferIds, strictParents: true, minScore: 5 }
      );
      childIds[i] = r?.id ?? null;
    });
  };
  const inferParent = (role, currentId, person, childIds) => {
    if (!person) return currentId;
    const votes = new Map();
    for (const cid of childIds) {
      const pid = cid != null ? index.parents.get(cid)?.[role] : null;
      if (pid != null) votes.set(pid, (votes.get(pid) || 0) + 1);
    }
    let best = null;
    for (const [pid, n] of votes) if (!best || n > best.n) best = { pid, n };
    if (!best || best.n < 2 || best.pid === currentId) return currentId;
    if (currentId != null && (votes.get(currentId) || 0) >= best.n) return currentId;
    const pe = index.byId.get(best.pid);
    if (!pe || !namesAgree(pe.first, person.given)) return currentId;
    if (person.birthYear && pe.birthYear && Math.abs(pe.birthYear - person.birthYear) > 1) return currentId;
    return best.pid;
  };
  const childIdsByFamily = new Map();
  for (const f of resolvedFamilies) {
    const childIds = new Array(f.children.length).fill(null);
    resolveLevel1(f, childIds);
    const inferredHead = inferParent('father', f.resolved.headId, f.head, childIds);
    if (inferredHead !== f.resolved.headId && !usedHeads.has(inferredHead)) {
      if (f.resolved.headId != null) usedHeads.delete(f.resolved.headId);
      usedHeads.set(inferredHead, f);
      f.resolved.headId = inferredHead;
      f.resolved.headMethod = 'children-majority';
      resolveWives(f);
      resolveLevel1(f, childIds);
    }
    const firstWifeKids = childIds.filter((_, i) => (f.children[i].wifeIndex ?? 0) === 0);
    const inferredWife = inferParent('mother', f.resolved.wifeIds[0] ?? null, f.wives[0], firstWifeKids);
    if (f.wives[0] && inferredWife !== (f.resolved.wifeIds[0] ?? null)) f.resolved.wifeIds[0] = inferredWife;
    childIdsByFamily.set(f, childIds);
  }

  for (const f of resolvedFamilies) {
    if (f.head && f.resolved.headId == null) {
      review.push({
        type: 'family-head',
        family: familyLabel(f),
        pdfPage: f.pdfPage,
        name: f.head.displayName,
        birthYear: f.head.birthYear,
        reason: f.resolved.duplicateOf ? `Same laneData node already heads ${f.resolved.duplicateOf}` : 'No laneData match (name + birth year)'
      });
    }
    const headId = f.resolved.headId;
    const wifeIds = f.resolved.wifeIds;
    const lp = linealPerson(f);
    const linealId = f.lineal === 'wife' ? wifeIds[0] : headId;
    if (linealId != null) {
      addCode(linealId, {
        section: f.section,
        sectionLabel: f.sectionLabel,
        familyNo: f.familyNo,
        familyKey: f.familyKey,
        generation: f.generation,
        pedigree: lp?.pedigree,
        pedigreeText: lp?.pedigreeText,
        titles: lp?.titles,
        lifespan: lp?.birthYear ? `${lp.birthYear}-${lp.deathYear || ''}` : null,
        pdfPage: f.pdfPage
      });
    }
    const otherId = f.lineal === 'wife' ? headId : wifeIds[0];
    if (otherId != null) addCode(otherId, { section: f.section, sectionLabel: f.sectionLabel, wifeOfFamilies: [f.familyKey], pdfPage: f.pdfPage });

    wifeIds.forEach((wid, i) => {
      if (wid == null) {
        if (f.wives[i]) review.push({ type: 'family-wife', family: familyLabel(f), pdfPage: f.pdfPage, name: f.wives[i].displayName, reason: 'No laneData match for wife' });
        return;
      }
      if (headId == null) return;
      if (f.lineal === 'head' || i > 0) addCode(wid, { section: f.section, sectionLabel: f.sectionLabel, wifeOfFamilies: [f.familyKey], pdfPage: f.pdfPage });
      addEdge(headId, wid, 'spouse', { method: 'family-header', section: f.section, familyNo: f.familyNo, pdfPage: f.pdfPage, confidence: 'high', note: `${familyLabel(f)} head + wife (${i + 1})` });
    });
  }

  for (const f of resolvedFamilies) {
    // Phase B2 — carry-forward children take the identity of the family they head; deeper levels
    // resolve under their (already resolved) parent.
    const headId = f.resolved.headId;
    const childIds = childIdsByFamily.get(f);
    f.children.forEach((c, i) => {
      if (c.linkedFamilyNo) {
        const target = byKey.get(`${f.section}|${c.linkedFamilyNo}`);
        const tid = target ? linealIdOf(target) : null;
        if (tid != null) {
          childIds[i] = tid;
          return;
        }
      }
      if (c.level === 1 || !c.birthYear) return;
      const parentId = childIds[c.parentIndex];
      if (parentId == null) return;
      const parentGender = index.byId.get(parentId)?.gender;
      const parentGiven = f.children[c.parentIndex].name;
      const viaSon = parentGender === 'M';
      const r = resolvePerson(
        index,
        {
          given: c.name,
          surname: viaSon ? f.head?.surname || 'Lane' : null,
          anySurname: !viaSon,
          birthYear: c.birthYear,
          fatherGiven: viaSon ? parentGiven : null,
          motherGiven: parentGender === 'F' ? parentGiven : null
        },
        { preferIds: index.children.get(parentId) || new Set(), strictParents: true, minScore: viaSon ? 5 : 7 }
      );
      childIds[i] = r?.id ?? null;
    });

    f.children.forEach((c, i) => {
      const cid = childIds[i];
      if (cid == null) {
        if (c.birthYear && (c.level === 1 || childIds[c.parentIndex] != null)) {
          review.push({ type: 'child', family: familyLabel(f), pdfPage: c.pdfPage, order: c.order, name: c.name, birthYear: c.birthYear, reason: 'No laneData match (given name + birth year)' });
        }
        return;
      }
      const prov = {
        method: c.linkedFamilyNo ? 'carry-forward' : 'child-list',
        section: f.section,
        familyNo: f.familyNo,
        childOrder: c.order,
        carryForwardNo: c.carryForward || null,
        pdfPage: c.pdfPage,
        confidence: c.linkedFamilyNo ? 'high' : 'medium'
      };
      if (c.level === 1) {
        addCode(cid, {
          section: f.section,
          sectionLabel: f.sectionLabel,
          parentFamilyNo: f.familyNo,
          childOrder: c.order,
          carryForwardNo: c.linkedFamilyNo || null,
          pdfPage: c.pdfPage
        });
        if (headId != null) addEdge(cid, headId, 'father', { ...prov, note: `${familyLabel(f)} child ${c.order}` });
        const wid = c.wifeIndex != null ? f.resolved.wifeIds[c.wifeIndex] : f.resolved.wifeIds[0];
        if (wid != null) addEdge(cid, wid, 'mother', { ...prov, note: `${familyLabel(f)} child ${c.order}` });
      } else {
        const pid = childIds[c.parentIndex];
        const pEntry = pid != null ? index.byId.get(pid) : null;
        const rel = pEntry?.gender === 'M' ? 'father' : pEntry?.gender === 'F' ? 'mother' : null;
        if (pid != null && rel) {
          addEdge(cid, pid, rel, { ...prov, method: 'grandchild-list', confidence: 'medium', note: `${familyLabel(f)} ${f.children[c.parentIndex].order} → ${c.order}` });
        }
      }
    });
    f.resolved.childIds = childIds;
  }

  for (const f of resolvedFamilies) {
    if (!f.parentLink) continue;
    const parent = byKey.get(`${f.section}|${f.parentLink.familyNo}`);
    const childId = f.lineal === 'wife' ? f.resolved.wifeIds[0] : f.resolved.headId;
    if (!parent || childId == null) continue;
    const prov = {
      method: f.parentLink.method,
      section: f.section,
      familyNo: parent.familyNo,
      childOrder: f.parentLink.childOrder,
      carryForwardNo: f.parentLink.carryForwardNo,
      pdfPage: f.pdfPage,
      confidence: f.parentLink.confidence,
      note: `${familyLabel(f)} descends from ${familyLabel(parent)}`
    };
    addCode(childId, { parentFamilyNo: parent.familyNo, childOrder: f.parentLink.childOrder, carryForwardNo: f.parentLink.carryForwardNo });
    if (parent.resolved.headId != null) addEdge(childId, parent.resolved.headId, 'father', prov);
    if (f.parentLink.method === 'carry-forward' && f.parentLink.childIndex != null) {
      const pc = parent.children[f.parentLink.childIndex];
      const wid = pc?.wifeIndex != null ? parent.resolved.wifeIds[pc.wifeIndex] : parent.resolved.wifeIds[0];
      if (wid != null) addEdge(childId, wid, 'mother', prov);
    }
  }

  for (const [id, code] of codes) {
    const parts = [];
    if (code.familyKey) parts.push(`No. ${code.familyKey}`);
    if (code.childOrder) parts.push(`${code.carryForwardNo ? `(${code.carryForwardNo}) ` : ''}${code.childOrder} of No. ${code.parentFamilyNo}`);
    if (code.wifeOfFamilies?.length) parts.push(`wife in No. ${code.wifeOfFamilies.join(', ')}`);
    if (code.generation) parts.push(`Gen ${code.generation}`);
    code.label = `${code.section && code.section !== 'boston' ? `${SECTION_LABELS[code.section] || code.section} · ` : ''}${parts.join(' · ')}`;
    code.source = GENEALOGY_CODE_SOURCE;
    codes.set(id, code);
  }

  return { edges: dropAmbiguousParents(dedupeEdges(edges), review), codes, review, families: resolvedFamilies };
}

/** One child, one book father/mother: when families disagree, keep a lone high-confidence claim or send all to review. */
function dropAmbiguousParents(edges, review) {
  const groups = new Map();
  for (const e of edges) {
    if (e.relation !== 'father' && e.relation !== 'mother') continue;
    const k = `${e.relation}|${e.source}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const drop = new Set();
  for (const group of groups.values()) {
    if (new Set(group.map((e) => e.target)).size < 2) continue;
    const high = group.filter((e) => e.provenance.confidence === 'high');
    const keep = high.length === 1 ? high[0] : null;
    for (const e of group) {
      if (e === keep) continue;
      drop.add(e);
      review.push({
        type: 'ambiguous-parent',
        relation: e.relation,
        childId: e.source,
        parentId: e.target,
        pdfPage: e.provenance.pdfPage,
        family: e.provenance.note,
        reason: `Same laneData person claimed as ${e.relation === 'father' ? 'a son/daughter' : 'a child'} by more than one book family`
      });
    }
  }
  return edges.filter((e) => !drop.has(e));
}

function dedupeEdges(edges) {
  const seen = new Map();
  for (const e of edges) {
    const key = e.relation === 'spouse'
      ? `spouse|${Math.min(e.source, e.target)}|${Math.max(e.source, e.target)}`
      : `${e.relation}|${e.source}|${e.target}`;
    const prev = seen.get(key);
    if (!prev || (prev.provenance.confidence !== 'high' && e.provenance.confidence === 'high')) seen.set(key, e);
  }
  return [...seen.values()];
}

const REGISTER_JUNK_GIVENS = new Set([
  'in', 'of', 'and', 'the', 'his', 'her', 'was', 'had', 'son', 'dau', 'lane', 'by', 'to', 'or',
  'from', 'with', 'who', 'whom', 'this', 'that', 'they', 'she', 'him', 'for', 'not', 'but',
  'also', 'see', 'page', 'vol', 'same', 'above', 'below', 'note', 'item'
]);

/**
 * Guard against OCR fragments ("2. In", "of", glued page crumbs) becoming people.
 * Accepts known givens/nicknames, or alphabetic names with birth year / maiden / pedigree / Lane surname.
 */
export function isPlausibleRegisterPerson(person = {}) {
  const givenRaw = person.given || person.name || '';
  const given = squash(String(givenRaw).split(/\s+/)[0]);
  if (given.length < 3 || REGISTER_JUNK_GIVENS.has(given)) return false;
  if (!/^[a-z]+$/.test(given)) return false;
  if (DEFAULT_GIVEN_NAMES.includes(given) || NICKNAME_CANONICAL.has(given)) return true;
  if (person.birthYear || person.deathYear || person.maiden || (person.pedigree && person.pedigree.length)) return true;
  if (person.surname && squash(person.surname) === 'lane' && given.length >= 4) return true;
  return given.length >= 5;
}

function displayNameForRegisterPerson(person, role = 'person') {
  if (person.displayName) return person.displayName;
  const bits = [person.given || person.name];
  if (person.maiden) bits.push(`(${person.maiden})`);
  if (person.surname) bits.push(person.surname);
  else if (role !== 'wife' && !person.maiden) bits.push('Lane');
  return bits.filter(Boolean).join(' ');
}

/**
 * Create provenance-stamped people for unresolved but plausible register heads, wives, and
 * level-1 / carry-forward children. Does not invent OCR junk. Returns a deep-copied laneData
 * plus creation stats — caller should rebuild the genealogy-code plan afterward.
 */
export function enrichLaneDataFromRegister(laneData, register, options = {}) {
  const data = JSON.parse(JSON.stringify(laneData || { nodes: [], links: [] }));
  const nodes = Array.isArray(data.nodes) ? data.nodes : (data.nodes = []);
  if (!Array.isArray(data.links)) data.links = [];
  let nextId = nodes.reduce((m, n) => Math.max(m, Number(n.id) || 0), 0) + 1;
  const created = [];
  const index = buildNodeIndex(data);
  const plan = options.plan || buildGenealogyCodePlan(register, data);
  const byKey = new Map((plan.families || []).map((f) => [`${f.section}|${f.familyNo}`, f]));

  const createNode = (person, meta) => {
    if (!isPlausibleRegisterPerson(person)) return null;
    // Prefer an existing unresolved match with looser scoring before synthesizing.
    const soft = resolvePerson(
      index,
      {
        given: person.given || person.name,
        surname: person.surname || (meta.role === 'wife' && person.maiden ? null : 'Lane'),
        maiden: person.maiden,
        birthYear: person.birthYear,
        anySurname: meta.role === 'wife'
      },
      { allowNoYear: true, maidenGuard: meta.role === 'wife', minScore: 3 }
    );
    if (soft?.id != null) return soft.id;

    const id = nextId++;
    const gender = meta.gender || (meta.role === 'wife' ? 'F' : meta.role === 'head' ? 'M' : '');
    const name = displayNameForRegisterPerson(person, meta.role);
    const node = {
      id,
      name,
      gender: gender || 'U',
      birthYear: person.birthYear ?? null,
      deathYear: person.deathYear ?? null,
      generation: meta.generation ?? null,
      lastName: person.surname || (person.maiden ? person.maiden : 'Lane'),
      text: '',
      provenance: {
        source: options.source || GENEALOGY_CODE_SOURCE,
        by: GENEALOGY_CODE_METHOD,
        method: 'register-enrich',
        section: meta.section,
        familyNo: meta.familyNo,
        pdfPage: meta.pdfPage,
        role: meta.role,
        volume: meta.volume || 1
      }
    };
    nodes.push(node);
    created.push({ id, name, ...meta });
    // Keep index roughly current for subsequent soft matches in this pass.
    index.entries.push({
      id,
      node,
      sq: squash(name.replace(/\([^)]*\)/g, ' ')),
      sqWithParens: squash(name),
      parens: person.maiden ? [squash(person.maiden)] : [],
      first: squash(person.given || person.name || ''),
      birthYear: person.birthYear ?? null,
      deathYear: person.deathYear ?? null,
      gender: node.gender,
      degree: 0,
      spouseCount: 0
    });
    index.byId.set(id, index.entries[index.entries.length - 1]);
    return id;
  };

  for (const f of plan.families || []) {
    const volume = f.volume || register?.volume || 1;
    if (f.head && f.resolved?.headId == null) {
      const id = createNode(f.head, {
        role: 'head',
        gender: 'M',
        section: f.section,
        familyNo: f.familyNo,
        pdfPage: f.pdfPage,
        generation: f.generation,
        volume
      });
      if (id != null) f.resolved.headId = id;
    }
    (f.wives || []).forEach((w, i) => {
      if (!w || (f.resolved?.wifeIds && f.resolved.wifeIds[i] != null)) return;
      const id = createNode(w, {
        role: 'wife',
        gender: 'F',
        section: f.section,
        familyNo: f.familyNo,
        pdfPage: f.pdfPage,
        generation: f.generation,
        volume
      });
      if (id != null) {
        if (!f.resolved.wifeIds) f.resolved.wifeIds = [];
        f.resolved.wifeIds[i] = id;
      }
    });
    (f.children || []).forEach((c, i) => {
      if (!c || (f.resolved?.childIds && f.resolved.childIds[i] != null)) return;
      // Only synthesize level-1 children with a birth year or carry-forward (high-signal book rows).
      if (c.level !== 1) return;
      if (!c.birthYear && !c.linkedFamilyNo && !c.carryForward) return;
      // If this child heads another family that we already synthesized, reuse that head.
      const linkedNo = c.linkedFamilyNo || c.carryForward;
      if (linkedNo) {
        const target = byKey.get(`${f.section}|${linkedNo}`);
        const tid = target?.resolved?.headId ?? target?.resolved?.wifeIds?.[0];
        if (tid != null) {
          if (!f.resolved.childIds) f.resolved.childIds = new Array(f.children.length).fill(null);
          f.resolved.childIds[i] = tid;
          return;
        }
      }
      const id = createNode(
        {
          given: c.name,
          name: c.name,
          surname: 'Lane',
          birthYear: c.birthYear,
          displayName: `${c.name} Lane`
        },
        {
          role: 'child',
          gender: '',
          section: f.section,
          familyNo: f.familyNo,
          pdfPage: c.pdfPage || f.pdfPage,
          generation: (f.generation || 0) + 1,
          volume
        }
      );
      if (id != null) {
        if (!f.resolved.childIds) f.resolved.childIds = new Array(f.children.length).fill(null);
        f.resolved.childIds[i] = id;
      }
    });
  }

  return {
    laneData: data,
    created,
    stats: { created: created.length, nextId }
  };
}

/**
 * Apply a plan to laneData (mutates a deep copy). Existing edges gain `provenance` when the book code
 * confirms them; a parent edge that contradicts an existing parent of the same role is not written.
 */
export function applyGenealogyCodePlan(laneData, plan) {
  const data = JSON.parse(JSON.stringify(laneData || { nodes: [], links: [] }));
  const nodesById = new Map(data.nodes.map((n) => [n.id, n]));
  const linkKey = (l) =>
    l.relation === 'spouse'
      ? `spouse|${Math.min(l.source, l.target)}|${Math.max(l.source, l.target)}`
      : `${l.relation}|${l.source}|${l.target}`;
  const existing = new Map(data.links.map((l) => [linkKey(l), l]));
  const parentOf = new Map();
  for (const l of data.links) {
    if (l.relation === 'father' || l.relation === 'mother') parentOf.set(`${l.relation}|${l.source}`, l.target);
  }

  const stats = { added: { father: 0, mother: 0, spouse: 0 }, confirmed: 0, conflicts: [], codedPeople: 0 };
  const stamp = { source: GENEALOGY_CODE_SOURCE, by: GENEALOGY_CODE_METHOD };

  for (const e of plan.edges || []) {
    if (!nodesById.has(e.source) || !nodesById.has(e.target)) continue;
    const key = linkKey(e);
    const prev = existing.get(key);
    if (prev) {
      if (!prev.provenance) {
        prev.provenance = { ...stamp, ...e.provenance, confirmed: true };
        stats.confirmed += 1;
      }
      continue;
    }
    if (e.relation !== 'spouse') {
      const other = parentOf.get(`${e.relation}|${e.source}`);
      if (other != null && other !== e.target) {
        stats.conflicts.push({
          relation: e.relation,
          child: { id: e.source, name: nodesById.get(e.source)?.name },
          existingParent: { id: other, name: nodesById.get(other)?.name },
          bookParent: { id: e.target, name: nodesById.get(e.target)?.name },
          provenance: e.provenance
        });
        continue;
      }
      parentOf.set(`${e.relation}|${e.source}`, e.target);
    }
    const link = { source: e.source, target: e.target, color: RELATION_COLORS[e.relation], relation: e.relation, provenance: { ...stamp, ...e.provenance } };
    data.links.push(link);
    existing.set(key, link);
    stats.added[e.relation] += 1;
  }

  for (const [id, code] of plan.codes || []) {
    const node = nodesById.get(id);
    if (!node) continue;
    node.genealogyCode = code;
    stats.codedPeople += 1;
  }
  return { laneData: data, stats };
}

/** Compact register document (stored as data/lane-genealogy-codes.json → lane_dataset). */
export function summarizeRegister(plan, applyStats = null) {
  const families = (plan.families || []).map((f) => ({
    section: f.section,
    familyNo: f.familyNo,
    familyKey: f.familyKey,
    pdfPage: f.pdfPage,
    generation: f.generation,
    lineal: f.lineal,
    head: f.head ? { name: f.head.displayName, titles: f.head.titles, pedigree: f.head.pedigreeText, birthYear: f.head.birthYear, deathYear: f.head.deathYear, personId: f.resolved?.headId ?? null } : null,
    wives: f.wives.map((w, i) => ({ name: w.displayName, order: w.order, pedigree: w.pedigreeText, personId: f.resolved?.wifeIds?.[i] ?? null })),
    parentLink: f.parentLink,
    children: f.children.map((c, i) => ({
      level: c.level,
      order: c.order,
      name: c.name,
      birthYear: c.birthYear,
      carryForwardNo: c.linkedFamilyNo || null,
      pdfPage: c.pdfPage,
      personId: f.resolved?.childIds?.[i] ?? null
    }))
  }));
  const count = (pred) => families.filter(pred).length;
  return {
    source: GENEALOGY_CODE_SOURCE,
    generatedAt: new Date().toISOString(),
    legend: {
      familyNo: 'No. N — numbered family block in the 1891 register',
      carryForwardNo: '(N) before a child — that child heads family No. N later in the book',
      childOrder: 'Roman numeral = child of the family head; "1." = grandchild; "1.)" = great-grandchild',
      pedigree: 'Parenthetical chain after a name: father, grandfather, … with generation superscripts'
    },
    stats: {
      families: families.length,
      familiesWithResolvedHead: count((f) => f.head?.personId != null),
      familiesLinkedToParentFamily: count((f) => !!f.parentLink),
      children: families.reduce((a, f) => a + f.children.length, 0),
      childrenResolved: families.reduce((a, f) => a + f.children.filter((c) => c.personId != null).length, 0),
      proposedEdges: (plan.edges || []).length,
      reviewItems: (plan.review || []).length,
      ...(applyStats ? { added: applyStats.added, confirmed: applyStats.confirmed, conflicts: applyStats.conflicts.length, codedPeople: applyStats.codedPeople } : {})
    },
    families,
    conflicts: applyStats?.conflicts || [],
    review: plan.review || []
  };
}

export default {
  repairOcrDigits,
  repairSplitGivenName,
  namesAgree,
  parseFamilyNumber,
  normalizeCarryForward,
  parseOcrYear,
  parseLifespan,
  parsePedigree,
  parseHeaderPerson,
  parseFamilyHeader,
  extractChildren,
  stripRunningHeader,
  buildSectionStreams,
  splitFamilyBlocks,
  decodeGenealogyRegister,
  buildNodeIndex,
  resolvePerson,
  buildGenealogyCodePlan,
  enrichLaneDataFromRegister,
  isPlausibleRegisterPerson,
  applyGenealogyCodePlan,
  summarizeRegister
};
