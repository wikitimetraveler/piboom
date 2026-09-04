/**
 * Development work by David Lane
 */
import '../../public/shared/js/celestial-ambience.js';
import '../../public/mountain-high/js/mhm-song.js';

const { MhmSong } = globalThis;

describe('MhmSong', () => {
  test('credits New Riders of the Purple Sage Panama Red (1973) on the YouTube embed', () => {
    expect(MhmSong.ARTIST).toBe('New Riders of the Purple Sage');
    expect(MhmSong.TITLE).toBe('Panama Red');
    expect(MhmSong.YEAR).toBe(1973);
    expect(MhmSong.VIDEO_ID).toBe('Tt6Do5fo4k8');
  });

  test('song is on by default after the 21+ gate', () => {
    expect(MhmSong.AUTOPLAY_ON_LOAD).toBe(true);
  });

  test('starts at the beginning of the track', () => {
    expect(MhmSong.SKIP_SECONDS).toBe(0);
    expect(MhmSong.needsIntroSkip(0)).toBe(false);
    expect(MhmSong.needsIntroSkip(12)).toBe(false);
  });
});
