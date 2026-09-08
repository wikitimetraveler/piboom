/**
 * Development work by David Lane
 */
import '../../public/shared/js/celestial-ambience.js';
import '../../public/planetarium/js/planetarium-sky-song.js';

const { CelestialAmbience, PlanetariumSkySong } = globalThis;

describe('CelestialAmbience volume', () => {
  test('master gain is loud enough for the dome', () => {
    expect(CelestialAmbience.MASTER_GAIN).toBeGreaterThanOrEqual(0.32);
  });

  test('setDuck clamps and scales effective gain', () => {
    CelestialAmbience.setDuck(0.08);
    expect(CelestialAmbience.getDuck()).toBeCloseTo(0.08);
    expect(CelestialAmbience.effectiveGain()).toBeCloseTo(CelestialAmbience.MASTER_GAIN * 0.08);

    CelestialAmbience.setDuck(4);
    expect(CelestialAmbience.getDuck()).toBe(1);
    expect(CelestialAmbience.effectiveGain()).toBe(CelestialAmbience.MASTER_GAIN);

    CelestialAmbience.setDuck(-1);
    expect(CelestialAmbience.getDuck()).toBe(0);
    CelestialAmbience.setDuck(1);
  });
});

describe('PlanetariumSkySong', () => {
  test('credits Norman Greenbaum Spirit in the Sky (1969) on the official video', () => {
    expect(PlanetariumSkySong.ARTIST).toBe('Norman Greenbaum');
    expect(PlanetariumSkySong.TITLE).toBe('Spirit in the Sky');
    expect(PlanetariumSkySong.YEAR).toBe(1969);
    expect(PlanetariumSkySong.VIDEO_ID).toBe('YqYN-1vMM9k');
  });

  test('song stays off on load so Alienigena can intro', () => {
    expect(PlanetariumSkySong.AUTOPLAY_ON_LOAD).toBe(false);
  });

  test('default volume is high and clampVolume stays in 0–100', () => {
    expect(PlanetariumSkySong.DEFAULT_VOLUME).toBe(100);
    expect(PlanetariumSkySong.clampVolume(-20)).toBe(0);
    expect(PlanetariumSkySong.clampVolume(150)).toBe(100);
    expect(PlanetariumSkySong.clampVolume('92')).toBe(92);
    expect(PlanetariumSkySong.clampVolume('nope')).toBe(PlanetariumSkySong.DEFAULT_VOLUME);
  });

  test('applyPlayerVolume unmutes and sets YouTube volume', () => {
    const calls = [];
    const player = {
      getCurrentTime() {
        return 18;
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
    // Clear intro gate (past SKIP_SECONDS).
    PlanetariumSkySong.skipIntro(player);
    calls.length = 0;
    const vol = PlanetariumSkySong.applyPlayerVolume(player, 100);
    expect(vol).toBe(100);
    expect(calls).toEqual([
      ['setVolume', 100],
      ['unMute'],
    ]);
  });

  test('skipIntro seeks past the cold open to the guitar', () => {
    expect(PlanetariumSkySong.SKIP_SECONDS).toBe(15);
    expect(PlanetariumSkySong.needsIntroSkip(0)).toBe(true);
    expect(PlanetariumSkySong.needsIntroSkip(14.9)).toBe(true);
    expect(PlanetariumSkySong.needsIntroSkip(15)).toBe(false);
    const seeks = [];
    const early = {
      getCurrentTime() {
        return 0.4;
      },
      seekTo(t, allowSeekAhead) {
        seeks.push([t, allowSeekAhead]);
      },
      mute() {},
      setVolume() {},
    };
    expect(PlanetariumSkySong.skipIntro(early)).toBe(15);
    expect(seeks).toEqual([[15, true]]);

    const later = {
      getCurrentTime() {
        return 18;
      },
      seekTo() {
        throw new Error('should not seek after intro');
      },
    };
    expect(PlanetariumSkySong.skipIntro(later)).toBe(15);
  });

  test('applyPlayerVolume stays muted until past the intro skip', () => {
    const calls = [];
    const early = {
      getCurrentTime() {
        return 1;
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
    PlanetariumSkySong.applyPlayerVolume(early, 100);
    expect(calls).toEqual([
      ['mute'],
      ['setVolume', 0],
    ]);
  });

  test('duckAmbience lowers the drone bed while the song is on', () => {
    PlanetariumSkySong.duckAmbience(true);
    expect(CelestialAmbience.getDuck()).toBe(PlanetariumSkySong.DUCK_WHILE_PLAYING);
    PlanetariumSkySong.duckAmbience(false);
    expect(CelestialAmbience.getDuck()).toBe(1);
  });
});
