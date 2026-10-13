/**
 * Development work by David Lane
 */
import { describe, expect, it } from '@jest/globals';
import { postConvertConditionsCdo } from '../../controllers/encompass-conditions.controller.js';
import { ACCESS_TAGS } from '../../services/encompass-conditions-migration.service.js';

function conditionXml(code, role = 'Funder') {
  const access = ACCESS_TAGS.map((tag) => `<${tag}>${role}</${tag}>`).join('');
  return `<Condition><DefaultDetails><Code>${code}</Code><Category>Ops</Category>`
    + '<SubCategory>Appraisal</SubCategory><Description>Provide the notice of value.</Description>'
    + '<Audience>TRUE</Audience><Stage>Pre-Purchase</Stage></DefaultDetails>'
    + `<ConditionAccess>${access}</ConditionAccess></Condition>`;
}

const xml = `<?xml version="1.0" encoding="utf-8"?><Conditions>${conditionXml('ABC01')}${conditionXml('ABC02')}</Conditions>`;

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

async function convert(body) {
  const res = mockRes();
  await postConvertConditionsCdo({ body }, res);
  return res;
}

describe('encompass-conditions.controller', () => {
  it('converts a CDO response envelope into a bundle and report', async () => {
    const cdo = { name: 'ConditionsTemplate.xml', dataObject: Buffer.from(xml, 'utf8').toString('base64') };
    const res = await convert({ cdo });

    expect(res.statusCode).toBe(200);
    expect(res.body.bundle.summary.conditionsParsed).toBe(2);
    expect(res.body.bundle.conditionTemplates.map((t) => t.internalId)).toEqual(['ABC01', 'ABC02']);
    expect(res.body.reportMarkdown).toContain('Enhanced Conditions migration');
  });

  it('accepts already-decoded XML', async () => {
    const res = await convert({ cdo: xml });
    expect(res.statusCode).toBe(200);
    expect(res.body.bundle.summary.conditionsConverted).toBe(2);
  });

  it('reconciles roles supplied as a response object', async () => {
    const res = await convert({ cdo: xml, roles: { roles: [{ roleID: 1, roleName: 'Funder', roleAbbr: 'FND' }] } });
    expect(res.body.bundle.roleReconciliation.matched).toHaveLength(1);
    expect(res.body.bundle.summary.unresolvedRoles).toBe(0);
  });

  it('stamps the role source onto the bundle and the report', async () => {
    const res = await convert({ cdo: xml, roles: [{ roleID: 1, roleName: 'Funder' }], roleSource: 'UAT' });
    expect(res.body.bundle.roleSource).toMatchObject({ label: 'UAT', provisional: true });
    expect(res.body.reportMarkdown).toContain('Role source: UAT — provisional');
  });

  it('rejects a role source that is not a label', async () => {
    const res = await convert({ cdo: xml, roleSource: { env: 'UAT' } });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/roleSource/);
  });

  it('rejects a request with no CDO', async () => {
    const res = await convert({});
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/cdo/);
  });

  it('rejects a roles value that is not a list', async () => {
    const res = await convert({ cdo: xml, roles: 'Funder' });
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/roles/);
  });

  // A CDO that cannot be decoded is bad input, not a server fault.
  it('reports an undecodable CDO as a bad request', async () => {
    const res = await convert({ cdo: { dataObject: Buffer.from('<Other/>', 'utf8').toString('base64') } });
    expect(res.statusCode).toBe(400);
    expect(res.body.details).toMatch(/Conditions/);
  });
});
