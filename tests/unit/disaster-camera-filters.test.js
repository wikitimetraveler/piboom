/**
 * Development work by David Lane
 */
import vm from 'vm';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dcfPath = path.resolve(__dirname, '../../public/finance/js/disaster-camera-filters.js');
const dcfCode = fs.readFileSync(dcfPath, 'utf8');

function loadDisasterCameraFilters() {
  const sandbox = { window: {}, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.runInNewContext(dcfCode, sandbox);
  return sandbox.DisasterCameraFilters;
}

describe('DisasterCameraFilters lighthouse / WebCOOS helpers', () => {
  const DCF = loadDisasterCameraFilters();

  const walton = {
    source: 'webcoos',
    source_id: 'walton_lighthouse',
    title: 'Walton Lighthouse',
    name: 'Walton Lighthouse, Santa Cruz, CA',
  };

  test('isLighthouseWebcam matches display name and source_id', () => {
    expect(DCF.isLighthouseWebcam(walton)).toBe(true);
    expect(DCF.isLighthouseWebcam({ source_id: 'pier_cam', title: 'Pier East' })).toBe(false);
    expect(DCF.isLighthouseWebcam({ source_id: 'some_lighthouse_cam', title: 'Harbor' })).toBe(true);
  });

  test('getWebCoosPublicUrl builds per-camera page', () => {
    expect(DCF.getWebCoosPublicUrl(walton)).toBe('https://webcoos.org/cameras/walton_lighthouse/');
    expect(DCF.getWebCoosPublicUrl({ source: 'alertcalifornia', source_id: 'x' })).toBeNull();
    expect(DCF.getWebCoosPublicUrl({ source: 'webcoos', source_id: '' })).toBeNull();
  });

  test('findCameraByQuery matches slug and partial name', () => {
    const cameras = [
      walton,
      { source: 'webcoos', source_id: 'stinson', title: 'Stinson Beach' },
    ];
    expect(DCF.findCameraByQuery(cameras, 'walton_lighthouse')).toHaveLength(1);
    expect(DCF.findCameraByQuery(cameras, 'walton_lighthouse')[0].source_id).toBe('walton_lighthouse');
    expect(DCF.findCameraByQuery(cameras, 'lighthouse')).toHaveLength(1);
    expect(DCF.findCameraByQuery(cameras, 'stinson')).toHaveLength(1);
  });

  test('filterCamerasByNameQuery filters list', () => {
    const cameras = [
      walton,
      { source: 'webcoos', source_id: 'stinson', title: 'Stinson Beach' },
    ];
    const filtered = DCF.filterCamerasByNameQuery(cameras, 'lighthouse');
    expect(filtered).toHaveLength(1);
    expect(DCF.getCameraDisplayName(filtered[0])).toContain('Walton');
  });
});
