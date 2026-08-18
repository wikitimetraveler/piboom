/**
 * Development work by David Lane
 */
import { jest, describe, expect, it, beforeEach } from '@jest/globals';

const invokeCatalogOperation = jest.fn();
const listCatalog = jest.fn();

await jest.unstable_mockModule('../../services/encompass-live-api.service.js', () => ({
  invokeCatalogOperation,
  listCatalog,
}));

await jest.unstable_mockModule('../../services/encompass-auth.service.js', () => ({
  encompassEnvStorage: { run: (_store, fn) => fn() },
}));

const {
  getCatalogHandler,
  postInvokeHandler,
  restPatchByAction,
} = await import('../../controllers/encompass-live-api.controller.js');

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

describe('encompass-live-api.controller', () => {
  beforeEach(() => {
    invokeCatalogOperation.mockReset();
    listCatalog.mockReset();
  });

  it('returns the Enhanced Conditions catalog', () => {
    listCatalog.mockReturnValue([{ id: 'ec.types.list' }]);
    const res = mockRes();
    getCatalogHandler('conditions')({}, res);
    expect(res.body).toEqual({ domain: 'conditions', operations: [{ id: 'ec.types.list' }] });
  });

  it('rejects invoke without operationId', async () => {
    const res = mockRes();
    await postInvokeHandler('conditions')({ body: {} }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/operationId/);
  });

  it('invokes a catalog operation and echoes ICE status', async () => {
    invokeCatalogOperation.mockResolvedValue({
      ok: true,
      status: 201,
      operationId: 'ec.types.create',
      data: { id: 'type-1' },
    });
    const res = mockRes();
    await postInvokeHandler('conditions')(
      { body: { operationId: 'ec.types.create', body: [{ title: 'Pre-Purchase' }] } },
      res,
    );
    expect(res.statusCode).toBe(201);
    expect(res.body.data).toEqual({ id: 'type-1' });
    expect(invokeCatalogOperation).toHaveBeenCalledWith('conditions', {
      operationId: 'ec.types.create',
      pathParams: undefined,
      query: undefined,
      body: [{ title: 'Pre-Purchase' }],
    });
  });

  it('maps ICE PATCH action query to the matching catalog operation', async () => {
    invokeCatalogOperation.mockResolvedValue({
      ok: true,
      status: 200,
      data: [{ id: 'type-1' }],
    });
    const res = mockRes();
    const handler = restPatchByAction('conditions', {
      add: 'ec.types.create',
      update: 'ec.types.update',
      delete: 'ec.types.delete',
    });
    await handler({ query: { action: 'add' }, params: {}, body: [{ title: 'Pre-Purchase' }] }, res);
    expect(invokeCatalogOperation).toHaveBeenCalledWith('conditions', expect.objectContaining({
      operationId: 'ec.types.create',
      body: [{ title: 'Pre-Purchase' }],
    }));
  });

  it('rejects an unknown PATCH action', async () => {
    const res = mockRes();
    const handler = restPatchByAction('conditions', { add: 'ec.types.create' });
    await handler({ query: { action: 'explode' }, params: {}, body: [] }, res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toMatch(/Unknown action/);
  });
});
