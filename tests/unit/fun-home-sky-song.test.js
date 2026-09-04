/**
 * Development work by David Lane
 */
import '../../public/shared/js/celestial-ambience.js';
import '../../public/shared/js/fun-home-sky-song.js';

const { CelestialAmbience, FunHomeSkySong } = globalThis;

describe('FunHomeSkySong', () => {
  test('credits Billy Thorpe Children of the Sun (1979) on the YouTube embed', () => {
    expect(FunHomeSkySong.ARTIST).toBe('Billy Thorpe');
    expect(FunHomeSkySong.TITLE).toBe('Children of the Sun');
    expect(FunHomeSkySong.YEAR).toBe(1979);
    expect(FunHomeSkySong.VIDEO_ID).toBe('voAR07ezBts');
  });

  test('song is on by default and starts on home page load', () => {
    expect(FunHomeSkySong.AUTOPLAY_ON_LOAD).toBe(true);
  });

  test('starts at the beginning of the track', () => {
    expect(FunHomeSkySong.SKIP_SECONDS).toBe(0);
    expect(FunHomeSkySong.needsIntroSkip(0)).toBe(false);
    expect(FunHomeSkySong.needsIntroSkip(12)).toBe(false);
  });

  test('default volume is high and clampVolume stays in 0–100', () => {
    expect(FunHomeSkySong.DEFAULT_VOLUME).toBe(100);
    expect(FunHomeSkySong.clampVolume(-20)).toBe(0);
    expect(FunHomeSkySong.clampVolume(150)).toBe(100);
    expect(FunHomeSkySong.clampVolume('92')).toBe(92);
    expect(FunHomeSkySong.clampVolume('nope')).toBe(FunHomeSkySong.DEFAULT_VOLUME);
  });

  test('applyPlayerVolume unmutes and sets YouTube volume', () => {
    const calls = [];
    const player = {
      getCurrentTime() {
        return 8;
      },
      setVolume(v) {
        calls.push(['setVolume', v]);
      },
      unMute() {
        calls.push(['unMute']);
      },
      mute() {
        calls.push(['mute']);
      },
    };
    FunHomeSkySong.skipIntro(player);
    calls.length = 0;
    const vol = FunHomeSkySong.applyPlayerVolume(player, 100);
    expect(vol).toBe(100);
    expect(calls).toEqual([
      ['setVolume', 100],
      ['unMute'],
    ]);
  });

  test('duckAmbience lowers the drone bed while the song is on', () => {
    FunHomeSkySong.duckAmbience(true);
    expect(CelestialAmbience.getDuck()).toBe(FunHomeSkySong.DUCK_WHILE_PLAYING);
    FunHomeSkySong.duckAmbience(false);
    expect(CelestialAmbience.getDuck()).toBe(1);
  });
});
