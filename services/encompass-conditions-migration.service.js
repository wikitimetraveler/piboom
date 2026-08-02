/**
 * Development work by David Lane
 *
 * Converts the legacy `ConditionsTemplate.xml` Custom Data Object into the Encompass
 * Enhanced Conditions model (condition types + condition templates).
 *
 * The legacy CDO is flat: every condition carries its own copy of six detail fields and
 * eleven comma-delimited persona ACLs. Enhanced Conditions is tiered — a condition type
 * owns the option vocabularies and tracking milestones, templates reference the type.
 * Enhanced Conditions has no per-condition ACL at all; persona access is configured on
 * the persona. So the ACLs are collapsed into named profiles for admin configuration
 * rather than converted into payloads.
 */
import { gunzipSync, inflateSync } from 'node:zlib';

const DETAIL_TAGS = ['Code', 'Category', 'SubCategory', 'Description', 'Audience', 'Stage'];

/** The eleven `ConditionAccess` children, in CDO order. */
export const ACCESS_TAGS = [
  'Add',
  'EditDetails',
  'AddComments',
  'DeleteComments',
  'SetStatusOpened',
  'SetStatusFulfilled',
  'SetStatusRe-requested',
  'SetStatusReceived',
  'SetStatusNot-Fulfilled',
  'SetStatusDeactivated',
  'SetStatusWaived',
];

/** Status milestones implied by the `SetStatus*` ACL tags, for `trackingDefinitions`. */
export const TRACKING_STATUSES = [
  'Opened',
  'Fulfilled',
  'Re-requested',
  'Received',
  'Not-Fulfilled',
  'Deactivated',
  'Waived',
];

const STAGE_CANONICAL = { pre: 'Pre-Purchase', post: 'Post-Purchase' };

const RECIPIENT_EXTERNAL = 'Borrower / TPO';
const RECIPIENT_INTERNAL = 'Internal Only';

/** Encompass caps persona names at 20 characters, so anything at exactly 20 may be cut off. */
const PERSONA_NAME_MAX = 20;

/** Only a production persona list settles whether a persona really exists. */
const PRODUCTION_SOURCE = /^(prod|production)$/i;

const PERSONA_SOURCE_LABEL_MAX = 40;

const TITLE_MAX = 80;

/**
 * Property names that have been observed carrying the CDO body, across the Encompass
 * CDO endpoint itself and the various API clients people export it with.
 */
const CDO_CONTENT_KEYS = [
  'dataObject',
  'data',
  'value',
  'content',
  'body',
  'file',
  'fileData',
  'document',
  'attachment',
  'xml',
  'text',
  'base64',
];

const BASE64_CHARS = /^[A-Za-z0-9+/=_-]+$/;
const HEX_CHARS = /^(?:[0-9a-fA-F]{2})+$/;
const DATA_URI = /^data:[^,]*,/i;

/** Root check tolerant of attributes (`<Conditions xmlns="...">`) and stray whitespace. */
function hasConditionsRoot(text) {
  return typeof text === 'string' && /<Conditions[\s>]/.test(text);
}

function stripBom(text) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
}

/**
 * UTF-16 without a BOM still announces itself: an ASCII-heavy XML document puts a NUL in
 * every other byte. Which half holds the NULs gives the endianness.
 */
function detectUtf16(buf) {
  const span = Math.min(buf.length, 128) & ~1;
  if (span < 8) return null;
  let evenNul = 0;
  let oddNul = 0;
  for (let i = 0; i < span; i += 2) {
    if (buf[i] === 0) evenNul += 1;
    if (buf[i + 1] === 0) oddNul += 1;
  }
  const pairs = span / 2;
  if (!evenNul && oddNul > pairs * 0.7) return 'le';
  if (!oddNul && evenNul > pairs * 0.7) return 'be';
  return null;
}

/** Decodes a byte payload to text, unwrapping compression and honouring any BOM. */
function decodeBytes(buf, notes) {
  if (buf.length >= 2 && buf[0] === 0x1f && buf[1] === 0x8b) {
    notes.push('gzip');
    return decodeBytes(gunzipSync(buf), notes);
  }
  if (buf.length >= 2 && buf[0] === 0x78 && [0x01, 0x9c, 0xda].includes(buf[1])) {
    try {
      const inflated = inflateSync(buf);
      notes.push('zlib');
      return decodeBytes(inflated, notes);
    } catch {
      // The first two bytes only looked like a zlib header; fall through to text.
    }
  }
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    notes.push('UTF-16LE');
    return buf.subarray(2).toString('utf16le');
  }
  if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    notes.push('UTF-16BE');
    return Buffer.from(buf.subarray(2)).swap16().toString('utf16le');
  }
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.subarray(3).toString('utf8');
  }

  const utf16 = detectUtf16(buf);
  if (utf16 === 'le') {
    notes.push('UTF-16LE (no BOM)');
    return buf.toString('utf16le');
  }
  if (utf16 === 'be') {
    notes.push('UTF-16BE (no BOM)');
    return Buffer.from(buf).swap16().toString('utf16le');
  }
  return buf.toString('utf8');
}

function toBuffer(input) {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  if (input instanceof ArrayBuffer) return Buffer.from(new Uint8Array(input));
  // A byte array that survived a JSON round trip arrives as `{ type: 'Buffer', data: [...] }`.
  if (Array.isArray(input?.data) && input.type === 'Buffer') return Buffer.from(input.data);
  if (Array.isArray(input) && input.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    return Buffer.from(input);
  }
  return null;
}

/** Digs the payload out of a response envelope, following the first key that holds one. */
function unwrapEnvelope(object, notes, seen) {
  if (seen.has(object)) return null;
  seen.add(object);

  if (Array.isArray(object)) {
    for (const entry of object) {
      const found = pickEnvelopeValue(entry, notes, seen);
      if (found != null) return found;
    }
    return null;
  }

  for (const key of CDO_CONTENT_KEYS) {
    if (!(key in object)) continue;
    const found = pickEnvelopeValue(object[key], notes, seen);
    if (found != null) {
      notes.push(`envelope.${key}`);
      return found;
    }
  }
  return null;
}

function pickEnvelopeValue(value, notes, seen) {
  if (typeof value === 'string' && value.trim()) return value;
  const bytes = toBuffer(value);
  if (bytes?.length) return bytes;
  if (value && typeof value === 'object') return unwrapEnvelope(value, notes, seen);
  return null;
}

/**
 * Plain text that happens to use only base64 characters will "decode" into noise, so a
 * layer is only believed if what came out still reads as text.
 */
function isProbablyText(text) {
  const sample = text.slice(0, 200);
  if (!sample) return false;
  let suspect = 0;
  for (const char of sample) {
    const code = char.charCodeAt(0);
    if (code === 0xfffd || (code < 0x20 && ![0x09, 0x0a, 0x0d].includes(code))) suspect += 1;
  }
  return suspect / sample.length < 0.05;
}

function previewOf(text) {
  const sample = String(text).replace(/\s+/g, ' ').trim().slice(0, 80);
  return sample || '(empty)';
}

/**
 * Unwraps a quoted, escaped string literal — what you get when the response body was
 * serialised as a JSON string instead of being written to a file.
 */
function unquoteJsonString(text, notes) {
  if (!/^["']/.test(text) || !/["']$/.test(text)) return null;
  try {
    const parsed = JSON.parse(text.replace(/^'|'$/g, '"'));
    if (typeof parsed !== 'string') return null;
    notes.push('JSON-escaped string');
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Walks one layer of wrapping off the payload. Raw downloads nest in every combination:
 * base64 inside a JSON envelope, a JSON-escaped XML string, a data URI, gzipped bytes.
 */
function unwrapOnce(value, notes, seen) {
  const bytes = toBuffer(value);
  if (bytes) return decodeBytes(bytes, notes);

  if (value && typeof value === 'object') return unwrapEnvelope(value, notes, seen);

  let text = stripBom(String(value)).trim();
  if (!text) return null;

  if (DATA_URI.test(text)) {
    notes.push('data URI');
    text = text.replace(DATA_URI, '').trim();
  }

  const unquoted = unquoteJsonString(text, notes);
  if (unquoted != null) return unquoted;

  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      const parsed = JSON.parse(text);
      notes.push('JSON envelope');
      return typeof parsed === 'string' ? parsed : unwrapEnvelope(parsed, notes, seen);
    } catch (error) {
      throw new Error(`Payload starts like JSON but does not parse: ${error.message}`);
    }
  }

  const compact = text.replace(/\s+/g, '');

  if (HEX_CHARS.test(compact) && compact.length >= 16) {
    notes.push('hex');
    return decodeBytes(Buffer.from(compact, 'hex'), notes);
  }

  if (BASE64_CHARS.test(compact) && compact.length >= 16) {
    notes.push('base64');
    // Pad rather than truncate: dropping the tail loses real bytes off the end of the XML.
    const normalized = compact.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
    const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
    return decodeBytes(Buffer.from(padded, 'base64'), notes);
  }

  return null;
}

/**
 * Reads whatever form the CDO arrived in and returns the Conditions XML plus the list of
 * wrappers that had to come off. Handles the CDO GET envelope (`{ name, dataObject }`),
 * bare base64 or hex, data URIs, JSON-escaped strings, gzipped or UTF-16 bytes, and XML
 * that is already plain text — including combinations of those, nested.
 */
export function readConditionsCdo(input) {
  if (input == null || (typeof input !== 'string' && typeof input !== 'object')) {
    throw new TypeError('readConditionsCdo expects a CDO object, byte payload, base64 string, or XML string');
  }

  const notes = [];
  const seen = new WeakSet();
  let current = input;

  for (let depth = 0; depth < 6; depth += 1) {
    if (typeof current === 'string') {
      const text = stripBom(current).trim();
      if (!text) throw new Error('CDO payload is empty');

      // Escaping comes off before the root check: the quoted form contains `<Conditions>`
      // too, and returning it as-is would hand back a document full of `\"`.
      const unquoted = unquoteJsonString(text, notes);
      if (unquoted != null) {
        current = unquoted;
        continue;
      }

      if (hasConditionsRoot(text)) return { xml: text, notes };

      // Namespace-prefixed exports (`<ns:Conditions>`) parse fine once the prefixes go.
      if (/<[A-Za-z0-9_.-]+:Conditions[\s>]/.test(text)) {
        notes.push('namespace prefixes stripped');
        return { xml: text.replace(/<(\/?)[A-Za-z0-9_.-]+:/g, '<$1'), notes };
      }
    }

    const mark = notes.length;
    const next = unwrapOnce(current, notes, seen);
    if (next == null) break;

    // A layer that decodes to noise was a misread, not a wrapper. Drop the note so the
    // error reports how far it genuinely got, and keep the readable value for the preview.
    if (typeof next === 'string' && !isProbablyText(next)) {
      notes.length = mark;
      break;
    }
    current = next;
  }

  const detected = notes.length ? ` Detected: ${notes.join(' → ')}.` : '';
  const preview = typeof current === 'string' ? previewOf(current) : `${typeof current} value`;
  throw new Error(
    `Could not find a <Conditions> root in the supplied CDO.${detected} Payload began: ${preview}`,
  );
}

/** Convenience wrapper for callers that only want the XML. */
export function decodeConditionsCdo(input) {
  return readConditionsCdo(input).xml;
}

function readTags(fragment) {
  const out = {};
  const re = /<([A-Za-z0-9._-]+)>([\s\S]*?)<\/\1>/g;
  let match;
  while ((match = re.exec(fragment)) !== null) out[match[1]] = decodeEntities(match[2]);
  return out;
}

function decodeEntities(value) {
  return value
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&amp;/g, '&');
}

/**
 * Parses the CDO XML into raw condition records. Deliberately regex-based rather than
 * DOM-based: the document is ~2MB of a rigidly uniform two-level shape with no attributes
 * or mixed content, and streaming through it avoids holding a parse tree for 826 nodes.
 */
export function parseConditionsXml(xml) {
  if (!hasConditionsRoot(xml)) {
    throw new Error('Expected Conditions XML');
  }

  // Attribute-tolerant, and `Conditions` cannot match because `s` follows the tag name.
  const blocks = xml.split(/<Condition(?:\s[^>]*)?>/).slice(1);

  return blocks.map((chunk, index) => {
    const block = chunk.split('</Condition>')[0];
    const details = readTags((block.match(/<DefaultDetails>([\s\S]*?)<\/DefaultDetails>/) || [, ''])[1]);
    const access = readTags((block.match(/<ConditionAccess>([\s\S]*?)<\/ConditionAccess>/) || [, ''])[1]);

    const record = { index, details: {}, access: {} };
    for (const tag of DETAIL_TAGS) record.details[tag] = (details[tag] ?? '').trim();
    for (const tag of ACCESS_TAGS) record.access[tag] = (access[tag] ?? '').trim();
    return record;
  });
}

function splitRoles(value) {
  return String(value || '')
    .split(',')
    .map((role) => role.trim())
    .filter(Boolean);
}

function foldKey(value) {
  return String(value || '').toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Picks the most frequent spelling within a set of case/whitespace variants. Ties break
 * alphabetically so the result is stable across runs.
 */
function canonicalSpellings(values) {
  const groups = new Map();
  for (const value of values) {
    const key = foldKey(value);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, new Map());
    const counts = groups.get(key);
    counts.set(value, (counts.get(value) || 0) + 1);
  }

  const canonical = new Map();
  const variants = [];
  for (const [key, counts] of groups) {
    const ranked = [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
    canonical.set(key, ranked[0][0]);
    if (ranked.length > 1) {
      variants.push({ canonical: ranked[0][0], collapsed: ranked.slice(1).map(([name, count]) => ({ name, count })) });
    }
  }
  return { canonical, variants };
}

/**
 * Strips artifacts that are unambiguously not part of a persona name: a leading `=`
 * (spreadsheet export), a trailing period, and stray internal whitespace.
 */
function cleanRoleName(role) {
  const cleaned = role.replace(/^[=\s]+/, '').replace(/\.\s*$/, '').replace(/\s+/g, ' ').trim();
  return cleaned || role.trim();
}

/**
 * Detects two persona names concatenated without a delimiter, e.g.
 * `Post Purchase MgrSr. Ops Manager`. Such an entry grants access to neither persona,
 * so it is a live defect rather than cosmetic drift.
 */
function looksMerged(role) {
  return /[a-z][A-Z]/.test(role) && !/^[A-Z]{2,}/.test(role);
}

function normalizeStage(stage) {
  const key = foldKey(stage).replace(/[^a-z]/g, '');
  if (key.startsWith('prepurc')) return STAGE_CANONICAL.pre;
  if (key.startsWith('postpurc')) return STAGE_CANONICAL.post;
  return null;
}

function normalizeAudience(audience) {
  const key = foldKey(audience);
  if (key === 'true') return true;
  if (key === 'false') return false;
  return null;
}

function cleanDescription(description) {
  return description.replace(/\r\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
}

/** Derives a human-readable template title from the condition text. */
function deriveTitle(description, code) {
  const firstSentence = cleanDescription(description).split(/(?<=[.!?])\s|\n/)[0].trim();
  if (!firstSentence) return code;
  if (firstSentence.length <= TITLE_MAX) return firstSentence;
  const clipped = firstSentence.slice(0, TITLE_MAX);
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 40 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
}

/**
 * Applies the cleanups that carry no interpretive risk (enum spellings, boolean coercion,
 * code casing, whitespace) and records everything else as a review item.
 */
export function normalizeConditions(rawConditions) {
  const issues = [];
  const addIssue = (severity, type, detail) => issues.push({ severity, type, ...detail });

  const { canonical: canonicalCategory, variants: categoryVariants } = canonicalSpellings(
    rawConditions.map((c) => c.details.Category),
  );
  const { canonical: canonicalSubCategory, variants: subCategoryVariants } = canonicalSpellings(
    rawConditions.map((c) => c.details.SubCategory),
  );

  const allRoleNames = [];
  for (const condition of rawConditions) {
    for (const tag of ACCESS_TAGS) allRoleNames.push(...splitRoles(condition.access[tag]).map(cleanRoleName));
  }
  const { canonical: canonicalRole, variants: roleVariants } = canonicalSpellings(allRoleNames);

  for (const variant of categoryVariants) {
    addIssue('auto_fixed', 'category_spelling', { canonical: variant.canonical, collapsed: variant.collapsed });
  }
  for (const variant of subCategoryVariants) {
    addIssue('auto_fixed', 'subcategory_spelling', { canonical: variant.canonical, collapsed: variant.collapsed });
  }
  for (const variant of roleVariants) {
    addIssue('auto_fixed', 'role_spelling', { canonical: variant.canonical, collapsed: variant.collapsed });
  }

  // Role defects repeat across every condition that references the name, so they are
  // accumulated here and emitted once per distinct name with an occurrence count.
  const roleDefects = new Map();
  const noteRoleDefect = (type, value, code, extra = {}) => {
    const key = `${type}:${value}`;
    if (!roleDefects.has(key)) {
      roleDefects.set(key, { type, value, ...extra, occurrences: 0, sampleCodes: [] });
    }
    const defect = roleDefects.get(key);
    defect.occurrences += 1;
    if (defect.sampleCodes.length < 5 && !defect.sampleCodes.includes(code)) defect.sampleCodes.push(code);
  };

  const seenCodes = new Map();
  const conditions = rawConditions.map((raw) => {
    const legacyCode = raw.details.Code.trim();
    const code = legacyCode.toUpperCase();
    if (code !== legacyCode) addIssue('auto_fixed', 'code_casing', { legacyCode, code });

    const priorCode = seenCodes.get(code);
    if (priorCode !== undefined) {
      addIssue('needs_review', 'duplicate_code_after_casing', { code, indexes: [priorCode, raw.index] });
    } else {
      seenCodes.set(code, raw.index);
    }

    const stage = normalizeStage(raw.details.Stage);
    if (!stage) {
      addIssue('needs_review', 'unrecognized_stage', { code, value: raw.details.Stage });
    } else if (stage !== raw.details.Stage) {
      addIssue('auto_fixed', 'stage_spelling', { code, from: raw.details.Stage, to: stage });
    }

    const audience = normalizeAudience(raw.details.Audience);
    if (audience === null) {
      addIssue('needs_review', 'unrecognized_audience', { code, value: raw.details.Audience });
    }

    const description = cleanDescription(raw.details.Description);
    if (description.includes('\uFFFD')) {
      addIssue('needs_review', 'corrupt_character', {
        code,
        context: description.slice(Math.max(0, description.indexOf('\uFFFD') - 40), description.indexOf('\uFFFD') + 40),
      });
    }
    if (!description) addIssue('needs_review', 'empty_description', { code });

    const access = {};
    for (const tag of ACCESS_TAGS) {
      const roles = [];
      for (const rawRole of splitRoles(raw.access[tag])) {
        const cleaned = cleanRoleName(rawRole);
        if (cleaned !== rawRole) noteRoleDefect('role_artifact', rawRole, code, { cleaned });
        if (looksMerged(cleaned)) noteRoleDefect('merged_role_names', cleaned, code);
        if (cleaned.length === PERSONA_NAME_MAX) noteRoleDefect('possible_truncated_role', cleaned, code);
        roles.push(canonicalRole.get(foldKey(cleaned)) || cleaned);
      }
      access[tag] = [...new Set(roles)].sort();
    }

    return {
      code,
      legacyCode,
      title: deriveTitle(description, code),
      description,
      source: canonicalCategory.get(foldKey(raw.details.Category)) || raw.details.Category,
      category: canonicalSubCategory.get(foldKey(raw.details.SubCategory)) || raw.details.SubCategory,
      stage,
      isExternal: audience === true,
      access,
    };
  });

  for (const defect of roleDefects.values()) {
    const { type, ...detail } = defect;
    addIssue(type === 'role_artifact' ? 'auto_fixed' : 'needs_review', type, detail);
  }

  flagDuplicateDescriptions(conditions, addIssue);
  flagAbbreviationPairs(conditions, addIssue);

  return { conditions, issues };
}

function flagDuplicateDescriptions(conditions, addIssue) {
  const byText = new Map();
  for (const condition of conditions) {
    const key = condition.description.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    if (!key) continue;
    if (!byText.has(key)) byText.set(key, []);
    byText.get(key).push(condition);
  }

  for (const group of byText.values()) {
    if (group.length < 2) continue;
    addIssue('needs_review', 'duplicate_description', {
      codes: group.map((c) => c.code),
      categories: [...new Set(group.map((c) => `${c.source}/${c.category}`))],
      description: group[0].description.slice(0, 160),
    });
  }
}

/**
 * Flags acronym/expansion pairs among the option vocabularies (e.g. `MISC` alongside
 * `Miscellaneous`). Restricted to all-caps short forms that prefix a single longer value:
 * a looser prefix rule matches unrelated siblings like `VA` and `VA Origination Fee`.
 * Whether a pair is really one option is a business call, so they are reported, not merged.
 */
function flagAbbreviationPairs(conditions, addIssue) {
  const values = [...new Set(conditions.map((c) => c.category).filter(Boolean))];

  for (const short of values) {
    if (short.length < 3 || short.length > 6 || short !== short.toUpperCase()) continue;
    const compact = short.toLowerCase().replace(/[^a-z]/g, '');

    const expansions = values.filter(
      (long) => long !== short && long.length > short.length && /^[A-Za-z]+$/.test(long)
        && long.toLowerCase().startsWith(compact),
    );
    if (expansions.length === 1) {
      addIssue('needs_review', 'possible_abbreviation', { short, long: expansions[0] });
    }
  }
}

function aclFingerprint(access) {
  return ACCESS_TAGS.map((tag) => `${tag}=${(access[tag] || []).join('|')}`).join('\n');
}

/**
 * Collapses the per-condition ACLs into distinct profiles. Enhanced Conditions cannot
 * store these, so the output is a configuration worksheet: each profile is a persona
 * access pattern an administrator applies once, rather than 826 times.
 */
export function buildAclProfiles(conditions) {
  const byFingerprint = new Map();

  for (const condition of conditions) {
    const fingerprint = aclFingerprint(condition.access);
    if (!byFingerprint.has(fingerprint)) {
      byFingerprint.set(fingerprint, { access: condition.access, codes: [] });
    }
    byFingerprint.get(fingerprint).codes.push(condition.code);
  }

  const ranked = [...byFingerprint.values()].sort(
    (a, b) => b.codes.length - a.codes.length || a.codes[0].localeCompare(b.codes[0]),
  );

  const profiles = ranked.map((entry, position) => {
    const dominantSource = mode(
      entry.codes.map((code) => conditions.find((c) => c.code === code)?.source).filter(Boolean),
    );
    return {
      profileId: `ACL-${String(position + 1).padStart(3, '0')}`,
      name: `${dominantSource || 'Mixed'} profile ${position + 1}`,
      conditionCount: entry.codes.length,
      singleUse: entry.codes.length === 1,
      permissions: entry.access,
      conditionCodes: entry.codes,
    };
  });

  const assignments = {};
  for (const profile of profiles) {
    for (const code of profile.conditionCodes) assignments[code] = profile.profileId;
  }

  return { profiles, assignments };
}

function mode(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
}

/**
 * Builds one condition type per stage. The type owns the option vocabularies, so the
 * values that repeated across 826 rows are declared once here.
 */
export function buildConditionTypePayloads(conditions) {
  const stages = [...new Set(conditions.map((c) => c.stage).filter(Boolean))].sort();

  return stages.map((stage) => {
    const inStage = conditions.filter((c) => c.stage === stage);
    const categories = [...new Set(inStage.map((c) => c.category).filter(Boolean))].sort();
    const sources = [...new Set(inStage.map((c) => c.source).filter(Boolean))].sort();
    const recipients = [...new Set(inStage.map((c) => (c.isExternal ? RECIPIENT_EXTERNAL : RECIPIENT_INTERNAL)))].sort();

    return {
      title: stage,
      definitions: {
        categoryDefinitions: categories.map((name) => ({ name })),
        recipientDefinitions: recipients.map((name) => ({ name })),
        sourceDefinitions: sources.map((name) => ({ name })),
        priorToDefinitions: [{ name: stage }],
        trackingDefinitions: TRACKING_STATUSES.map((name) => ({ name })),
      },
    };
  });
}

/**
 * Builds one condition template per legacy condition. `internalId` carries the legacy
 * code so migrated conditions remain traceable to the CDO they came from.
 */
export function buildConditionTemplatePayloads(conditions) {
  return conditions
    .filter((condition) => condition.stage)
    .map((condition) => ({
      title: condition.title,
      conditionType: condition.stage,
      internalId: condition.code,
      internalDescription: condition.description,
      category: condition.category,
      source: condition.source,
      priorTo: condition.stage,
      recipient: condition.isExternal ? RECIPIENT_EXTERNAL : RECIPIENT_INTERNAL,
      printDefinitions: condition.isExternal ? ['InternalPrint', 'ExternalPrint'] : ['InternalPrint'],
      ...(condition.isExternal
        ? { externalId: condition.code, externalDescription: condition.description }
        : {}),
    }));
}

/** Abbreviations the CDO uses where the persona list spells the word out. */
const ROLE_ABBREVIATIONS = new Map([
  ['mgr', 'manager'],
  ['mgrs', 'managers'],
  ['sr', 'senior'],
  ['uw', 'underwriter'],
  ['credt', 'credit'],
  ['accpount', 'account'],
  ['manger', 'manager'],
  ['purch', 'purchase'],
]);

function roleTokens(value) {
  return foldKey(value)
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .map((token) => ROLE_ABBREVIATIONS.get(token) || token);
}

/** Jaccard overlap on expanded tokens; tolerant of word order and abbreviation style. */
function tokenSimilarity(a, b) {
  const left = new Set(roleTokens(a));
  const right = new Set(roleTokens(b));
  if (!left.size || !right.size) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / (left.size + right.size - shared);
}

/**
 * Matches the role names found in the CDO against the personas that actually exist in
 * Encompass. Unmatched names cannot be configured and must be resolved by hand, so each
 * one is returned with ranked candidates and a probable cause.
 */
export function reconcilePersonas(conditions, personas = []) {
  const roleNames = new Set();
  for (const condition of conditions) {
    for (const tag of ACCESS_TAGS) for (const role of condition.access[tag]) roleNames.add(role);
  }

  const known = personas
    .map((persona) => (typeof persona === 'string' ? { name: persona } : persona))
    .filter((persona) => persona?.name);
  const byFold = new Map(known.map((persona) => [foldKey(persona.name), persona]));

  const matched = [];
  const unmatched = [];

  for (const role of [...roleNames].sort()) {
    const exact = byFold.get(foldKey(role));
    if (exact) {
      matched.push({ role, persona: { id: exact.id, name: exact.name } });
      continue;
    }

    const fold = foldKey(role);
    const candidates = known
      .map((persona) => {
        const personaFold = foldKey(persona.name);
        const prefix = personaFold.startsWith(fold) || fold.startsWith(personaFold);
        const score = Math.max(tokenSimilarity(role, persona.name), prefix ? 0.75 : 0);
        return { id: persona.id, name: persona.name, score: Number(score.toFixed(2)) };
      })
      .filter((candidate) => candidate.score >= 0.5)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    unmatched.push({
      role,
      likelyTruncated: role.length === PERSONA_NAME_MAX,
      likelyMerged: looksMerged(role),
      candidates,
    });
  }

  return {
    roleCount: roleNames.size,
    matched,
    unmatched,
    personaCount: byFold.size,
    impact: measureStaleness(conditions, new Set(unmatched.map((entry) => entry.role))),
  };
}

/**
 * Measures how much of the legacy ACL still refers to personas that exist. A permission
 * list whose every role is gone currently grants access to nobody, so it is a silent
 * lockout rather than a naming inconsistency.
 */
function measureStaleness(conditions, unresolvedRoles) {
  if (!unresolvedRoles.size) {
    return { conditionsWithUnresolvedRoles: 0, permissionLists: 0, permissionListsGrantingNobody: 0 };
  }

  let conditionsWithUnresolvedRoles = 0;
  let permissionLists = 0;
  let permissionListsGrantingNobody = 0;

  for (const condition of conditions) {
    let affected = false;
    for (const tag of ACCESS_TAGS) {
      const roles = condition.access[tag];
      if (!roles.length) continue;
      permissionLists += 1;
      const live = roles.filter((role) => !unresolvedRoles.has(role));
      if (!live.length) permissionListsGrantingNobody += 1;
      if (live.length !== roles.length) affected = true;
    }
    if (affected) conditionsWithUnresolvedRoles += 1;
  }

  return { conditionsWithUnresolvedRoles, permissionLists, permissionListsGrantingNobody };
}

/**
 * Records where the persona list came from. A reconciliation run against anything but
 * production is provisional: persona names drift between environments, so a clean match
 * in UAT does not prove the persona exists where the conditions will be configured.
 */
export function describePersonaSource(source, personaCount = 0) {
  const label = String(source ?? '').trim().slice(0, PERSONA_SOURCE_LABEL_MAX);
  const supplied = personaCount > 0;
  return {
    label: label || null,
    supplied,
    production: supplied && PRODUCTION_SOURCE.test(label),
    provisional: !supplied || !PRODUCTION_SOURCE.test(label),
  };
}

function personaSourceSentence(personaSource) {
  if (!personaSource.supplied) {
    return 'Persona source: none supplied — persona reconciliation was skipped.';
  }
  if (personaSource.production) {
    return `Persona source: ${personaSource.label} — authoritative.`;
  }
  const named = personaSource.label ? `${personaSource.label}` : 'unlabelled';
  return `Persona source: ${named} — provisional. Persona names drift between environments, `
    + 're-run against production before configuring anything.';
}

function groupIssues(issues) {
  const grouped = new Map();
  for (const issue of issues) {
    const key = `${issue.severity}:${issue.type}`;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key).push(issue);
  }
  return grouped;
}

/**
 * Renders the reviewer-facing Markdown report. Lives beside the conversion so the CLI
 * and the Condition Manager page hand out the same document.
 */
export function renderMigrationReport(bundle) {
  const { summary } = bundle;
  const lines = [];
  const push = (line = '') => lines.push(line);

  push('# Enhanced Conditions migration — dry run');
  push();
  push(`Generated ${bundle.generatedAt}`);
  push();
  push(personaSourceSentence(bundle.personaSource));
  push();
  push('| Metric | Value |');
  push('| --- | --- |');
  push(`| Conditions parsed from CDO | ${summary.conditionsParsed} |`);
  push(`| Condition templates generated | ${summary.conditionsConverted} |`);
  push(`| Condition types generated | ${summary.conditionTypes} |`);
  push(`| Distinct ACL profiles | ${summary.aclProfiles} |`);
  push(`| ACL profiles used by one condition | ${summary.singleUseAclProfiles} |`);
  push(`| Distinct persona names referenced | ${summary.distinctRoles} |`);
  push(`| Persona names not matched | ${summary.unresolvedRoles} |`);
  push(`| Conditions referencing a missing persona | ${summary.conditionsWithUnresolvedRoles} |`);
  push(`| Permission lists granting access to nobody | ${summary.permissionListsGrantingNobody} of ${bundle.personaReconciliation.impact.permissionLists} |`);
  push(`| Automatic fixes applied | ${summary.autoFixed} |`);
  push(`| Items needing a decision | ${summary.needsReview} |`);
  push();

  const grouped = groupIssues(bundle.issues);
  const review = [...grouped.entries()].filter(([key]) => key.startsWith('needs_review'));
  const fixed = [...grouped.entries()].filter(([key]) => key.startsWith('auto_fixed'));

  push('## Needs a decision');
  push();
  if (!review.length) push('_None._');
  for (const [key, items] of review.sort((a, b) => b[1].length - a[1].length)) {
    push(`### ${key.split(':')[1].replace(/_/g, ' ')} (${items.length})`);
    push();
    for (const item of items.slice(0, 40)) {
      const { severity, type, ...rest } = item;
      push(`- ${JSON.stringify(rest)}`);
    }
    if (items.length > 40) push(`- _...${items.length - 40} more, see data-quality-report.json_`);
    push();
  }

  push('## Applied automatically');
  push();
  if (!fixed.length) push('_None._');
  for (const [key, items] of fixed.sort((a, b) => b[1].length - a[1].length)) {
    push(`### ${key.split(':')[1].replace(/_/g, ' ')} (${items.length})`);
    push();
    for (const item of items.slice(0, 25)) {
      const { severity, type, ...rest } = item;
      push(`- ${JSON.stringify(rest)}`);
    }
    if (items.length > 25) push(`- _...${items.length - 25} more, see data-quality-report.json_`);
    push();
  }

  push('## ACL profiles');
  push();
  push('Enhanced Conditions has no per-condition ACL. Each profile below is a persona access');
  push('pattern to configure once in Encompass admin, replacing the per-condition role lists.');
  push();
  push('| Profile | Conditions | Add | Waive |');
  push('| --- | --- | --- | --- |');
  for (const profile of bundle.aclProfiles.slice(0, 25)) {
    push(
      `| ${profile.profileId} | ${profile.conditionCount} | ${profile.permissions.Add.length} personas | ${profile.permissions.SetStatusWaived.length} personas |`,
    );
  }
  if (bundle.aclProfiles.length > 25) push(`| _...${bundle.aclProfiles.length - 25} more_ | | | |`);
  push();

  if (bundle.personaReconciliation.personaCount === 0) {
    push('## Persona reconciliation');
    push();
    push('Skipped — no persona list supplied. Re-run with `--personas` once you have');
    push('`GET /encompass/v3/settings/personas` saved to disk.');
    push();
  } else {
    push('## Unresolved persona names');
    push();
    if (bundle.personaSource.provisional) {
      push(`_Matched against ${bundle.personaSource.label || 'an unlabelled list'}, not production._`);
      push();
    }
    push('| CDO role name | Likely cause | Candidates in Encompass |');
    push('| --- | --- | --- |');
    for (const entry of bundle.personaReconciliation.unmatched) {
      const cause = entry.likelyMerged
        ? 'two names merged'
        : entry.likelyTruncated
          ? 'truncated at 20 chars'
          : 'no match';
      const candidates = entry.candidates.map((c) => c.name || c).join(', ') || '—';
      push(`| ${entry.role} | ${cause} | ${candidates} |`);
    }
    push();
  }

  return `${lines.join('\n')}\n`;
}

/** Assembles the dry-run bundle: payloads to review, plus everything needing a decision. */
export function buildMigrationBundle(cdoInput, { personas = [], personaSource = null } = {}) {
  const xml = decodeConditionsCdo(cdoInput);
  const raw = parseConditionsXml(xml);
  const { conditions, issues } = normalizeConditions(raw);
  const { profiles, assignments } = buildAclProfiles(conditions);
  const personaReconciliation = reconcilePersonas(conditions, personas);
  const describedSource = describePersonaSource(personaSource, personaReconciliation.personaCount);

  const conditionTypes = buildConditionTypePayloads(conditions);
  const conditionTemplates = buildConditionTemplatePayloads(conditions);

  return {
    generatedAt: new Date().toISOString(),
    personaSource: describedSource,
    summary: {
      conditionsParsed: raw.length,
      conditionsConverted: conditionTemplates.length,
      conditionTypes: conditionTypes.length,
      aclProfiles: profiles.length,
      singleUseAclProfiles: profiles.filter((p) => p.singleUse).length,
      autoFixed: issues.filter((i) => i.severity === 'auto_fixed').length,
      needsReview: issues.filter((i) => i.severity === 'needs_review').length,
      distinctRoles: personaReconciliation.roleCount,
      unresolvedRoles: personaReconciliation.unmatched.length,
      conditionsWithUnresolvedRoles: personaReconciliation.impact.conditionsWithUnresolvedRoles,
      permissionListsGrantingNobody: personaReconciliation.impact.permissionListsGrantingNobody,
    },
    conditions,
    conditionTypes,
    conditionTemplates,
    aclProfiles: profiles,
    aclAssignments: assignments,
    personaReconciliation,
    issues,
  };
}
