import { resolveTrack, TRACK_RELATIVE_PATHS } from '../../lib/disaster-mood-music.js';
import { resolveSafeMusicPath } from '../../lib/audio-path.js';
import path from 'path';

describe('disaster-mood-music resolveTrack', () => {
  test('maps FIRMS source to fire track', () => {
    expect(resolveTrack({ source: 'firms', title: 'Active fire' }).relativePath).toBe(
      TRACK_RELATIVE_PATHS.fire
    );
  });

  test('maps ALERTCalifornia source to fire track', () => {
    expect(resolveTrack({ source: 'alertcalifornia' }).mood).toBe('fire');
  });

  test('maps wildfire in title to fire track', () => {
    expect(resolveTrack({ source: 'fema', title: 'County wildfire DR-1234' }).mood).toBe('fire');
  });

  test('maps flood zones and flood text to flood track', () => {
    expect(resolveTrack({ source: 'floodzones' }).relativePath).toBe(TRACK_RELATIVE_PATHS.flood);
    expect(resolveTrack({ incidentType: 'Flash Flood' }).mood).toBe('flood');
  });

  test('maps NHC and hurricane text to hurricane track', () => {
    expect(resolveTrack({ source: 'nhc' }).mood).toBe('hurricane');
    expect(resolveTrack({ title: 'Tropical Storm Warning' }).mood).toBe('hurricane');
  });

  test('maps USGS and earthquake text to earthquake track', () => {
    expect(resolveTrack({ source: 'usgs' }).mood).toBe('earthquake');
    expect(resolveTrack({ event_type: 'Earthquake M4.2' }).mood).toBe('earthquake');
  });

  test('maps NWS and storm text to storm track', () => {
    expect(resolveTrack({ source: 'nws' }).mood).toBe('storm');
    expect(resolveTrack({ title: 'Severe Thunderstorm Warning' }).mood).toBe('storm');
  });

  test('falls back to default for unknown disasters', () => {
    expect(resolveTrack(null).relativePath).toBe(TRACK_RELATIVE_PATHS.default);
    expect(resolveTrack({ source: 'fema', title: 'DR-4721' }).mood).toBe('default');
  });
});

describe('resolveSafeMusicPath', () => {
  const musicDir = path.resolve('/app/music');

  test('allows disasters subfolder paths', () => {
    const full = resolveSafeMusicPath(musicDir, 'disasters%2Ffire.mp3');
    expect(full).toBe(path.resolve(musicDir, 'disasters/fire.mp3'));
  });

  test('rejects path traversal', () => {
    expect(resolveSafeMusicPath(musicDir, '..%2F..%2Fetc%2Fpasswd')).toBeNull();
    expect(resolveSafeMusicPath(musicDir, '../secret.mp3')).toBeNull();
  });
});
