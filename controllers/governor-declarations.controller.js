/**
 * Governor / federal disaster declarations API
 * Development work by David Lane
 */
import {
  listGovernorDeclarations,
  getGovernorDeclaration,
  createGovernorDeclaration,
  updateGovernorDeclaration,
  deleteGovernorDeclaration,
  syncGovernorDeclarationsFromOpenFema,
  threeMonthsAgoIso,
} from '../services/governor-declarations.service.js';

function statusFor(code) {
  if (
    code === 'KIND_INVALID' ||
    code === 'STATE_INVALID' ||
    code === 'DATE_INVALID' ||
    code === 'TITLE_REQUIRED'
  ) {
    return 400;
  }
  return 500;
}

function messageFor(code) {
  switch (code) {
    case 'KIND_INVALID':
      return 'kind must be governor_order, federal_dr, federal_em, or federal_fm';
    case 'STATE_INVALID':
      return 'state must be a two-letter code';
    case 'DATE_INVALID':
      return 'Dates must be YYYY-MM-DD';
    case 'TITLE_REQUIRED':
      return 'incidentTitle is required';
    default:
      return 'Governor declarations request failed';
  }
}

export async function listDeclarations(req, res) {
  try {
    const sinceQuery = req.query.since;
    const declarations = await listGovernorDeclarations({
      since: sinceQuery === undefined ? undefined : sinceQuery,
      state: req.query.state,
      kind: req.query.kind,
    });
    return res.json({
      success: true,
      declarations,
      count: declarations.length,
      defaultSince: threeMonthsAgoIso(),
    });
  } catch (err) {
    const code = err?.code || 'LIST_FAILED';
    return res.status(statusFor(code)).json({
      success: false,
      error: messageFor(code),
      code,
    });
  }
}

export async function getDeclaration(req, res) {
  try {
    const declaration = await getGovernorDeclaration(req.params.id);
    if (!declaration) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, declaration });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Get failed' });
  }
}

export async function createDeclaration(req, res) {
  try {
    const declaration = await createGovernorDeclaration(req.body || {});
    return res.status(201).json({ success: true, declaration });
  } catch (err) {
    const code = err?.code || 'CREATE_FAILED';
    return res.status(statusFor(code)).json({
      success: false,
      error: messageFor(code),
      code,
    });
  }
}

export async function updateDeclaration(req, res) {
  try {
    const declaration = await updateGovernorDeclaration(req.params.id, req.body || {});
    if (!declaration) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, declaration });
  } catch (err) {
    const code = err?.code || 'UPDATE_FAILED';
    return res.status(statusFor(code)).json({
      success: false,
      error: messageFor(code),
      code,
    });
  }
}

export async function deleteDeclaration(req, res) {
  try {
    const ok = await deleteGovernorDeclaration(req.params.id);
    if (!ok) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Delete failed' });
  }
}

export async function syncFromOpenFema(req, res) {
  try {
    const since = req.body?.since || req.query?.since;
    const result = await syncGovernorDeclarationsFromOpenFema(since ? { since } : {});
    if (result.error) {
      return res.status(502).json({
        success: false,
        error: result.error,
        result,
      });
    }
    return res.json({ success: true, result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Sync failed' });
  }
}
