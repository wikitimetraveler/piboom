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

  test('playlist also includes Neil Young Homegrown and Roll Another Number', () => {
    expect(MhmSong.TRACKS.map((t) => t.id)).toEqual(['panama-red', 'homegrown', 'roll-another']);
    expect(MhmSong.TRACKS[1]).toMatchObject({
      artist: 'Neil Young',
      title: 'Homegrown',
      videoId: '1eetrxNlR-M',
      year: 1977,
    });
    expect(MhmSong.TRACKS[2]).toMatchObject({
      artist: 'Neil Young',
      title: 'Roll Another Number',
      videoId: 'c8p04GHC8sY',
      year: 1975,
    });
  });
});
