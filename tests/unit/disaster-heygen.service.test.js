/**
 * @jest-environment node
 */
import {
  SCHEMA_WALKTHROUGH_SCRIPT,
  buildDisasterBriefingScript,
  buildDisasterBriefingTitle,
  getSchemaWalkthrough,
  getDisasterBriefingPayload
} from '../../services/disaster-heygen.service.js';

describe('disaster-heygen.service', () => {
  test('getSchemaWalkthrough returns canonical script', () => {
    const payload = getSchemaWalkthrough();
    expect(payload.title).toBe('Unified Disasters Schema');
    expect(payload.script).toBe(SCHEMA_WALKTHROUGH_SCRIPT);
    expect(payload.script).toMatch(/Unified Disasters/);
    expect(payload.script).toMatch(/graph_nodes/);
  });

  test('buildDisasterBriefingScript uses disaster fields and counts', () => {
    const script = buildDisasterBriefingScript(
      {
        title: 'Wildfire — Sonoma County',
        source: 'firms',
        event_type: 'wildfire',
        county_name: 'Sonoma',
        state_abbr: 'CA',
        started_at: '2026-06-01T12:00:00.000Z'
      },
      { loanCount: 3, cameraCount: 2, radiusMiles: 50 }
    );
    expect(script).toMatch(/Wildfire — Sonoma County/);
    expect(script).toMatch(/FIRMS/);
    expect(script).toMatch(/3 pipeline loans/);
    expect(script).toMatch(/2 hazard webcams/);
    expect(script).toMatch(/50 miles/);
  });

  test('buildDisasterBriefingTitle includes state when present', () => {
    expect(
      buildDisasterBriefingTitle({ title: 'EQ M4.2', state_abbr: 'NV' })
    ).toBe('EQ M4.2 (NV)');
  });

  test('getDisasterBriefingPayload bundles title and script', () => {
    const payload = getDisasterBriefingPayload(
      { title: 'Flood watch', county_name: 'Harris', state_abbr: 'TX' },
      { loanCount: 0, cameraCount: 1 }
    );
    expect(payload.title).toBe('Flood watch (TX)');
    expect(payload.script).toMatch(/one hazard webcam/);
    expect(payload.aspectRatio).toBe('16:9');
  });
});
