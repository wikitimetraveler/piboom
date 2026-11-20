/**
 * Disaster Policy Desk API
 * Development work by David Lane
 */
import {
  createPolicyEvent,
  listPolicyEvents,
  getPolicyEvent,
  appendPolicyAreas,
  setPolicyStatus,
  findImpactedLoans,
} from '../services/disaster-policy.service.js';

function statusFor(code) {
  if (
    code === 'KIND_INVALID' ||
    code === 'STATUS_INVALID' ||
    code === 'EVENT_NAME_REQUIRED' ||
    code === 'AREAS_REQUIRED' ||
    code === 'AREA_INVALID'
  ) {
    return 400;
  }
  return 500;
}

function messageFor(code) {
  switch (code) {
    case 'KIND_INVALID':
      return 'kind must be declared or pending';
    case 'STATUS_INVALID':
      return 'status must be draft, active, or ended';
    case 'EVENT_NAME_REQUIRED':
      return 'eventName is required';
    case 'AREAS_REQUIRED':
      return 'Select at least one county (or ZIP) area';
    case 'AREA_INVALID':
      return 'Each area needs state, countyCode (FIPS), and countyName';
    default:
      return 'Disaster policy request failed';
  }
}

export async function createEvent(req, res) {
  try {
    const event = await createPolicyEvent(req.body || {});
    return res.status(201).json({ success: true, event });
  } catch (err) {
    const code = err?.code || 'CREATE_FAILED';
    return res.status(statusFor(code)).json({
      success: false,
      error: messageFor(code),
      code,
    });
  }
}

export async function listEvents(req, res) {
  try {
    const events = await listPolicyEvents({
      kind: req.query.kind,
      status: req.query.status,
    });
    return res.json({ success: true, events, count: events.length });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'List failed' });
  }
}

export async function getEvent(req, res) {
  try {
    const event = await getPolicyEvent(req.params.id);
    if (!event) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, event });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Get failed' });
  }
}

export async function appendAreas(req, res) {
  try {
    const event = await appendPolicyAreas(req.params.id, req.body?.areas || []);
    if (!event) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, event });
  } catch (err) {
    const code = err?.code || 'APPEND_FAILED';
    return res.status(statusFor(code)).json({
      success: false,
      error: messageFor(code),
      code,
    });
  }
}

export async function patchStatus(req, res) {
  try {
    const event = await setPolicyStatus(req.params.id, req.body?.status);
    if (!event) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, event });
  } catch (err) {
    const code = err?.code || 'STATUS_FAILED';
    return res.status(statusFor(code)).json({
      success: false,
      error: messageFor(code),
      code,
    });
  }
}

export async function impactedLoans(req, res) {
  try {
    const result = await findImpactedLoans(req.params.id);
    if (!result.event) return res.status(404).json({ success: false, error: 'Not found' });
    return res.json({ success: true, ...result });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message || 'Impact query failed' });
  }
}
