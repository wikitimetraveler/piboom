/**
 * Development work by David Lane
 */
import { describe, expect, it } from '@jest/globals';
import {
  assertSafePathParam,
  buildUpstreamUrl,
  invokeCatalogOperation,
  listCatalog,
  pickQuery,
  substitutePath,
} from '../../services/encompass-live-api.service.js';
import { CONDITIONS_CATALOG } from '../../services/encompass-live-api.catalog.js';

describe('encompass-live-api.service', () => {
  it('lists unique Enhanced Conditions operations with CRUD coverage', () => {
    const conditions = listCatalog('conditions');
    const ecIds = conditions.map((op) => op.id);

    expect(new Set(ecIds).size).toBe(ecIds.length);
    expect(conditions.length).toBe(CONDITIONS_CATALOG.length);
    expect(() => listCatalog('tpo')).toThrow(/Unknown live API domain/);
    expect(ecIds).toEqual(expect.arrayContaining([
      'ec.types.list',
      'ec.types.create',
      'ec.types.update',
      'ec.types.delete',
      'ec.templates.list',
      'ec.templates.create',
      'ec.loan.list',
      'ec.loan.add',
      'ec.loan.remove',
    ]));
  });

  it('rejects an unknown catalog domain', () => {
    expect(() => listCatalog('nope')).toThrow(/Unknown live API domain/);
  });

  it('substitutes path params and rejects traversal', () => {
    const { icePath } = substitutePath(
      '/encompass/v3/settings/loan/conditions/types/{typeId}',
      { typeId: 'type-1' },
    );
    expect(icePath).toBe('/encompass/v3/settings/loan/conditions/types/type-1');

    expect(() => assertSafePathParam('typeId', '../secret')).toThrow(/Invalid path parameter/);
    expect(() => assertSafePathParam('typeId', 'a/b')).toThrow(/Invalid path parameter/);
    expect(() => substitutePath('/encompass/v3/loans/{loanId}/conditions', {})).toThrow(/Missing path parameter/);
  });

  it('only copies allowlisted query keys and keeps defaults', () => {
    const query = pickQuery(
      { queryKeys: ['action', 'view'], defaultQuery: { action: 'add', view: 'entity' } },
      { action: 'update', limit: '99', view: '' },
    );
    expect(query).toEqual({ action: 'update', view: 'entity' });
  });

  it('builds an ICE URL on the configured API server', () => {
    const url = buildUpstreamUrl('/encompass/v3/settings/loan/conditions/types', { view: 'entity' });
    expect(url).toMatch(/\/encompass\/v3\/settings\/loan\/conditions\/types\?view=entity$/);
  });

  it('invokes a catalog operation through the injected request function', async () => {
    const request = async (config) => {
      expect(config.method).toBe('get');
      expect(config.url).toMatch(/\/settings\/loan\/conditions\/types\/type-9$/);
      return { status: 200, data: { id: 'type-9' }, headers: {} };
    };
    const result = await invokeCatalogOperation(
      'conditions',
      { operationId: 'ec.types.get', pathParams: { typeId: 'type-9' } },
      { request },
    );
    expect(result).toMatchObject({
      ok: true,
      status: 200,
      operationId: 'ec.types.get',
      method: 'GET',
      data: { id: 'type-9' },
    });
  });

  it('rejects unknown operations without calling ICE', async () => {
    const request = async () => {
      throw new Error('should not run');
    };
    await expect(
      invokeCatalogOperation('conditions', { operationId: 'ec.not.real' }, { request }),
    ).rejects.toThrow(/Unknown operation/);
  });
});
