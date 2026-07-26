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

const TITLE_MAX = 80;

/**
 * Accepts the raw CDO GET response (`{ name, dataObject }`), a bare base64 string, or
 * XML that has already been decoded.
 */
export function decodeConditionsCdo(input) {
  if (typeof input !== 'string' && (!input || typeof input !== 'object')) {
    throw new TypeError('decodeConditionsCdo expects a CDO object, base64 string, or XML string');
  }

  const raw = typeof input === 'string' ? input : input.dataObject;
  if (typeof raw !== 'string' || !raw.trim()) {
    throw new Error('CDO payload has no dataObject content');
  }

  const trimmed = raw.trim();
  if (trimmed.startsWith('<')) return trimmed;

  const compact = trimmed.replace(/\s+/g, '');
  const aligned = compact.slice(0, compact.length - (compact.length % 4));
  const xml = Buffer.from(aligned, 'base64').toString('utf8');

  if (!xml.includes('<Conditions>')) {
    throw new Error('Decoded CDO does not contain a <Conditions> root element');
  }
  return xml;
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
  if (typeof xml !== 'string' || !xml.includes('<Conditions>')) {
    throw new Error('Expected Conditions XML');
  }

  const blocks = xml.split('<Condition>').slice(1);

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

/** Assembles the dry-run bundle: payloads to review, plus everything needing a decision. */
export function buildMigrationBundle(cdoInput, { personas = [] } = {}) {
  const xml = decodeConditionsCdo(cdoInput);
  const raw = parseConditionsXml(xml);
  const { conditions, issues } = normalizeConditions(raw);
  const { profiles, assignments } = buildAclProfiles(conditions);
  const personaReconciliation = reconcilePersonas(conditions, personas);

  const conditionTypes = buildConditionTypePayloads(conditions);
  const conditionTemplates = buildConditionTemplatePayloads(conditions);

  return {
    generatedAt: new Date().toISOString(),
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
