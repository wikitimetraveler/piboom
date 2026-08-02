/**
 * Development work by David Lane
 */
import { gzipSync } from 'node:zlib';
import { describe, expect, it } from '@jest/globals';
import {
  ACCESS_TAGS,
  TRACKING_STATUSES,
  buildAclProfiles,
  buildConditionTemplatePayloads,
  buildConditionTypePayloads,
  buildMigrationBundle,
  decodeConditionsCdo,
  describePersonaSource,
  normalizeConditions,
  parseConditionsXml,
  readConditionsCdo,
  reconcilePersonas,
  renderMigrationReport,
} from '../../services/encompass-conditions-migration.service.js';

function condition({
  code = 'ABC01',
  category = 'Ops',
  subCategory = 'Appraisal',
  description = 'Provide the notice of value.',
  audience = 'TRUE',
  stage = 'Pre-Purchase',
  access = {},
} = {}) {
  const accessXml = ACCESS_TAGS.map((tag) => `<${tag}>${access[tag] ?? 'Funder'}</${tag}>`).join('');
  return `<Condition><DefaultDetails><Code>${code}</Code><Category>${category}</Category>`
    + `<SubCategory>${subCategory}</SubCategory><Description>${description}</Description>`
    + `<Audience>${audience}</Audience><Stage>${stage}</Stage></DefaultDetails>`
    + `<ConditionAccess>${accessXml}</ConditionAccess></Condition>`;
}

const wrap = (...conditions) => `<?xml version="1.0" encoding="utf-8"?><Conditions>${conditions.join('')}</Conditions>`;

const parseFixture = (xml) => normalizeConditions(parseConditionsXml(xml));

describe('encompass-conditions-migration.service', () => {
  describe('decodeConditionsCdo', () => {
    it('decodes the base64 dataObject from a CDO response envelope', () => {
      const xml = wrap(condition());
      const cdo = { name: 'ConditionsTemplate.xml', dataObject: Buffer.from(xml, 'utf8').toString('base64') };
      expect(decodeConditionsCdo(cdo)).toBe(xml);
    });

    it('decodes the envelope saved straight out of Postman, pretty-printed', () => {
      const xml = wrap(condition());
      const saved = JSON.stringify(
        { name: 'ConditionsTemplate.xml', dataObject: Buffer.from(xml, 'utf8').toString('base64') },
        null,
        4,
      );
      expect(decodeConditionsCdo(saved)).toBe(xml);
    });

    it('passes through XML that has already been decoded', () => {
      const xml = wrap(condition());
      expect(decodeConditionsCdo(xml)).toBe(xml);
    });

    it('ignores line breaks inserted into the base64 body', () => {
      const xml = wrap(condition());
      const wrapped = Buffer.from(xml, 'utf8').toString('base64').replace(/(.{40})/g, '$1\n');
      expect(decodeConditionsCdo({ dataObject: wrapped })).toBe(xml);
    });

    it('pads base64 that lost its trailing "=" rather than truncating the tail', () => {
      const xml = wrap(condition());
      const stripped = Buffer.from(xml, 'utf8').toString('base64').replace(/=+$/, '');
      expect(decodeConditionsCdo(stripped)).toBe(xml);
    });

    it('unescapes XML that was serialised as a JSON string', () => {
      const xml = wrap(condition());
      expect(decodeConditionsCdo(JSON.stringify(xml))).toBe(xml);
    });

    it('reads a gzipped byte payload', () => {
      const xml = wrap(condition());
      expect(decodeConditionsCdo(gzipSync(Buffer.from(xml, 'utf8')))).toBe(xml);
    });

    it('reads UTF-16LE bytes, with and without a byte order mark', () => {
      const xml = wrap(condition());
      const bom = Buffer.concat([Buffer.from([0xff, 0xfe]), Buffer.from(xml, 'utf16le')]);
      expect(decodeConditionsCdo(bom)).toBe(xml);
      expect(decodeConditionsCdo(Buffer.from(xml, 'utf16le'))).toBe(xml);
    });

    it('strips a data URI prefix', () => {
      const xml = wrap(condition());
      const uri = `data:text/xml;base64,${Buffer.from(xml, 'utf8').toString('base64')}`;
      expect(decodeConditionsCdo(uri)).toBe(xml);
    });

    it('accepts a root element carrying attributes', () => {
      const xml = `<Conditions xmlns="urn:elli">${condition()}</Conditions>`;
      expect(parseConditionsXml(decodeConditionsCdo(xml))).toHaveLength(1);
    });

    it('reports the wrappers it peeled off when no Conditions root turns up', () => {
      const cdo = { dataObject: Buffer.from('<Other>not it</Other>', 'utf8').toString('base64') };
      expect(() => decodeConditionsCdo(cdo)).toThrow(/Conditions/);
      expect(() => decodeConditionsCdo(cdo)).toThrow(/base64/);
    });

    it('stops at the last readable layer instead of re-decoding text into noise', () => {
      const cdo = Buffer.from('not a conditions document at all', 'utf8').toString('base64');
      expect(() => decodeConditionsCdo(cdo)).toThrow(/not a conditions document at all/);
      expect(() => decodeConditionsCdo(cdo)).toThrow(/Detected: base64\./);
    });

    it('names the layers it unwrapped on the way to the XML', () => {
      const xml = wrap(condition());
      const cdo = { name: 'ConditionsTemplate.xml', dataObject: Buffer.from(xml, 'utf8').toString('base64') };
      expect(readConditionsCdo(cdo).notes).toEqual(['envelope.dataObject', 'base64']);
    });
  });

  describe('parseConditionsXml', () => {
    it('extracts every detail and access tag for each condition', () => {
      const parsed = parseConditionsXml(wrap(condition({ code: 'A1' }), condition({ code: 'A2' })));
      expect(parsed).toHaveLength(2);
      expect(parsed[0].details.Code).toBe('A1');
      expect(Object.keys(parsed[1].access)).toEqual(ACCESS_TAGS);
    });

    it('decodes XML entities in descriptions', () => {
      const { conditions } = parseFixture(wrap(condition({ description: 'Taxes &amp; insurance' })));
      expect(conditions[0].description).toBe('Taxes & insurance');
    });
  });

  describe('normalizeConditions', () => {
    it('collapses stage spelling variants onto the canonical value', () => {
      const { conditions, issues } = parseFixture(
        wrap(condition({ code: 'A1', stage: 'Pre Purchase' }), condition({ code: 'A2', stage: 'Pre Purc' })),
      );
      expect(conditions.map((c) => c.stage)).toEqual(['Pre-Purchase', 'Pre-Purchase']);
      expect(issues.filter((i) => i.type === 'stage_spelling')).toHaveLength(2);
    });

    it('coerces the Audience string into a boolean', () => {
      const { conditions } = parseFixture(
        wrap(condition({ code: 'A1', audience: 'TRUE' }), condition({ code: 'A2', audience: 'FALSE' })),
      );
      expect(conditions.map((c) => c.isExternal)).toEqual([true, false]);
    });

    it('uppercases mixed-case codes while retaining the original', () => {
      const { conditions } = parseFixture(wrap(condition({ code: 'Borr002' })));
      expect(conditions[0]).toMatchObject({ code: 'BORR002', legacyCode: 'Borr002' });
    });

    it('strips spreadsheet artifacts from role names', () => {
      const { conditions } = parseFixture(wrap(condition({ access: { Add: '=Task Manager, Funder.' } })));
      expect(conditions[0].access.Add).toEqual(['Funder', 'Task Manager']);
    });

    it('flags two role names concatenated without a delimiter', () => {
      const { issues } = parseFixture(wrap(condition({ access: { Add: 'Post Purchase MgrSr. Ops Manager' } })));
      expect(issues).toContainEqual(
        expect.objectContaining({ type: 'merged_role_names', value: 'Post Purchase MgrSr. Ops Manager' }),
      );
    });

    it('reports a repeated role defect once, with an occurrence count', () => {
      const truncated = 'Business Intelligenc';
      const { issues } = parseFixture(
        wrap(condition({ code: 'A1', access: { Add: truncated } }), condition({ code: 'A2', access: { Add: truncated } })),
      );
      const flagged = issues.filter((i) => i.type === 'possible_truncated_role');
      expect(flagged).toHaveLength(1);
      expect(flagged[0]).toMatchObject({ value: truncated, occurrences: 2, sampleCodes: ['A1', 'A2'] });
    });

    it('flags conditions that share an identical description', () => {
      const { issues } = parseFixture(
        wrap(condition({ code: 'A1', description: 'Provide title.' }), condition({ code: 'A2', description: 'Provide title.' })),
      );
      expect(issues).toContainEqual(
        expect.objectContaining({ type: 'duplicate_description', codes: ['A1', 'A2'] }),
      );
    });

    it('flags the stored replacement character rather than guessing the original', () => {
      const { issues } = parseFixture(wrap(condition({ description: 'Based on the loan\uFFFDs timing.' })));
      expect(issues).toContainEqual(expect.objectContaining({ type: 'corrupt_character' }));
    });
  });

  describe('buildAclProfiles', () => {
    it('collapses conditions that share an access pattern into one profile', () => {
      const { conditions } = parseFixture(
        wrap(
          condition({ code: 'A1', access: { Add: 'Funder' } }),
          condition({ code: 'A2', access: { Add: 'Funder' } }),
          condition({ code: 'A3', access: { Add: 'OAR' } }),
        ),
      );
      const { profiles, assignments } = buildAclProfiles(conditions);

      expect(profiles).toHaveLength(2);
      expect(profiles[0].conditionCodes).toEqual(['A1', 'A2']);
      expect(profiles[1].singleUse).toBe(true);
      expect(assignments.A2).toBe(profiles[0].profileId);
    });

    it('treats role order as insignificant', () => {
      const { conditions } = parseFixture(
        wrap(
          condition({ code: 'A1', access: { Add: 'Funder, OAR' } }),
          condition({ code: 'A2', access: { Add: 'OAR, Funder' } }),
        ),
      );
      expect(buildAclProfiles(conditions).profiles).toHaveLength(1);
    });
  });

  describe('payload builders', () => {
    it('creates one condition type per stage carrying the shared vocabularies', () => {
      const { conditions } = parseFixture(
        wrap(
          condition({ code: 'A1', stage: 'Pre-Purchase', subCategory: 'Appraisal' }),
          condition({ code: 'A2', stage: 'Post-Purchase', subCategory: 'Title' }),
        ),
      );
      const types = buildConditionTypePayloads(conditions);

      expect(types.map((t) => t.title).sort()).toEqual(['Post-Purchase', 'Pre-Purchase']);
      const prePurchase = types.find((t) => t.title === 'Pre-Purchase');
      expect(prePurchase.definitions.categoryDefinitions).toEqual([{ name: 'Appraisal' }]);
      expect(prePurchase.definitions.trackingDefinitions).toHaveLength(TRACKING_STATUSES.length);
    });

    it('carries the legacy code through as internalId', () => {
      const { conditions } = parseFixture(wrap(condition({ code: 'GSE001' })));
      expect(buildConditionTemplatePayloads(conditions)[0]).toMatchObject({
        internalId: 'GSE001',
        conditionType: 'Pre-Purchase',
      });
    });

    it('marks borrower-facing conditions for external print and internal-only ones for internal', () => {
      const { conditions } = parseFixture(
        wrap(condition({ code: 'A1', audience: 'TRUE' }), condition({ code: 'A2', audience: 'FALSE' })),
      );
      const [external, internal] = buildConditionTemplatePayloads(conditions);

      expect(external.printDefinitions).toEqual(['InternalPrint', 'ExternalPrint']);
      expect(external.externalId).toBe('A1');
      expect(internal.printDefinitions).toEqual(['InternalPrint']);
      expect(internal).not.toHaveProperty('externalId');
    });

    it('derives a readable title from the first sentence', () => {
      const { conditions } = parseFixture(
        wrap(condition({ description: 'Provide the notice of value. Upload it to the eFolder.' })),
      );
      expect(conditions[0].title).toBe('Provide the notice of value.');
    });
  });

  describe('reconcilePersonas', () => {
    const personas = [
      { id: '15', name: 'Funder' },
      { id: '133', name: 'ND Underwriter 1' },
      { id: '115', name: 'Business Intelligence' },
    ];

    it('matches role names that exist verbatim', () => {
      const { conditions } = parseFixture(wrap(condition({ access: { Add: 'Funder' } })));
      const { matched } = reconcilePersonas(conditions, personas);
      expect(matched).toContainEqual({ role: 'Funder', persona: { id: '15', name: 'Funder' } });
    });

    it('suggests the spelled-out persona for an abbreviated role name', () => {
      const { conditions } = parseFixture(wrap(condition({ access: { Add: 'ND UW 1' } })));
      const entry = reconcilePersonas(conditions, personas).unmatched.find((u) => u.role === 'ND UW 1');
      expect(entry.candidates[0]).toMatchObject({ name: 'ND Underwriter 1' });
    });

    it('marks a name cut off at the persona length limit as truncated', () => {
      const { conditions } = parseFixture(wrap(condition({ access: { Add: 'Business Intelligenc' } })));
      const entry = reconcilePersonas(conditions, personas).unmatched.find((u) => u.role === 'Business Intelligenc');
      expect(entry.likelyTruncated).toBe(true);
      expect(entry.candidates[0]).toMatchObject({ name: 'Business Intelligence' });
    });

    it('returns no candidates for a role with no plausible counterpart', () => {
      const { conditions } = parseFixture(wrap(condition({ access: { Add: 'Head of Credit' } })));
      const entry = reconcilePersonas(conditions, personas).unmatched.find((u) => u.role === 'Head of Credit');
      expect(entry.candidates).toEqual([]);
    });
  });

  describe('buildMigrationBundle', () => {
    it('summarises the conversion without contacting Encompass', () => {
      const xml = wrap(
        condition({ code: 'A1', stage: 'Pre Purchase' }),
        condition({ code: 'A2', stage: 'Post-Purchase' }),
      );
      const bundle = buildMigrationBundle(xml, { personas: [{ id: '15', name: 'Funder' }] });

      expect(bundle.summary).toMatchObject({
        conditionsParsed: 2,
        conditionsConverted: 2,
        conditionTypes: 2,
        distinctRoles: 1,
        unresolvedRoles: 0,
      });
      expect(bundle.conditionTemplates).toHaveLength(2);
    });
  });

  describe('persona source', () => {
    const personas = [{ id: '15', name: 'Funder' }];
    const xml = wrap(condition());

    it('treats a production list as authoritative', () => {
      const source = describePersonaSource('Production', 1);
      expect(source).toMatchObject({ label: 'Production', supplied: true, production: true, provisional: false });
    });

    it('treats any other environment as provisional', () => {
      expect(describePersonaSource('UAT', 1)).toMatchObject({ production: false, provisional: true });
    });

    it('treats a supplied list with no label as provisional', () => {
      expect(describePersonaSource('', 1)).toMatchObject({ label: null, supplied: true, provisional: true });
    });

    it('reports no persona list as unsupplied', () => {
      expect(describePersonaSource('UAT', 0)).toMatchObject({ supplied: false, provisional: true });
    });

    it('carries the source through the bundle', () => {
      const bundle = buildMigrationBundle(xml, { personas, personaSource: 'UAT' });
      expect(bundle.personaSource).toMatchObject({ label: 'UAT', supplied: true, provisional: true });
    });

    it('warns in the report when the personas did not come from production', () => {
      const report = renderMigrationReport(buildMigrationBundle(xml, { personas, personaSource: 'UAT' }));
      expect(report).toContain('Persona source: UAT — provisional');
      expect(report).toContain('not production');
    });

    it('does not warn when the personas came from production', () => {
      const report = renderMigrationReport(buildMigrationBundle(xml, { personas, personaSource: 'Production' }));
      expect(report).toContain('Persona source: Production — authoritative.');
      expect(report).not.toContain('provisional');
    });

    it('records that reconciliation was skipped when no personas were supplied', () => {
      const report = renderMigrationReport(buildMigrationBundle(xml));
      expect(report).toContain('Persona source: none supplied');
    });
  });
});
