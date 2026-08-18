/**
 * Development work by David Lane
 */
import '../../public/studio/js/studio-autotune.js';
import { groundedReply } from '../../services/studio-assistant.service.js';

const { StarBandAutotune } = globalThis;

describe('StarBand autotune', () => {
  test('isVoiceTrack is true for Vocal and Harmony only', () => {
    expect(StarBandAutotune.isVoiceTrack({ kind: 'vocal', name: 'Vocal' })).toBe(true);
    expect(StarBandAutotune.isVoiceTrack({ kind: 'vocal', name: 'Harmony' })).toBe(true);
    expect(StarBandAutotune.isVoiceTrack({ kind: 'acoustic-guitar', name: 'Acoustic Guitar Neck' })).toBe(false);
    expect(StarBandAutotune.isVoiceTrack({ kind: 'acoustic-guitar', name: 'Acoustic Guitar Body' })).toBe(false);
  });

  test('snapHz pulls a sharp A toward 440 in chromatic mode', () => {
    const sharp = 452;
    const snapped = StarBandAutotune.snapHz(sharp, 0, 'chromatic', 1);
    expect(snapped).toBeCloseTo(440, 0);
  });

  test('C major does not snap to F#', () => {
    const fSharp = StarBandAutotune.midiToHz(66);
    const snapped = StarBandAutotune.snapHz(fSharp, 0, 'major', 1);
    const midi = Math.round(StarBandAutotune.hzToMidi(snapped));
    expect([65, 67]).toContain(midi);
  });
});

describe('studio-assistant autotune copy', () => {
  test('groundedReply says autotune is voice only', () => {
    const reply = groundedReply('can you add autotune');
    expect(reply.toLowerCase()).toMatch(/vocal|voice/);
    expect(reply.toLowerCase()).toMatch(/guitar/);
  });
});
