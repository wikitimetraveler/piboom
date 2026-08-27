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

  test('noteNameFromMidi names A4 at 69', () => {
    expect(StarBandAutotune.noteNameFromMidi(69)).toBe('A4');
  });

  test('centsOff marks a sharp A as voiced and sharp', () => {
    const reading = StarBandAutotune.centsOff(452, 0, 'chromatic');
    expect(reading.voiced).toBe(true);
    expect(reading.note).toBe('A4');
    expect(reading.cents).toBeGreaterThan(20);
    expect(reading.inTune).toBe(false);
  });

  test('centsOff marks 440 as in tune', () => {
    const reading = StarBandAutotune.centsOff(440, 0, 'chromatic');
    expect(reading.inTune).toBe(true);
    expect(Math.abs(reading.cents)).toBeLessThan(1);
  });

  test('readPitch is silent on zeros and finds 440 on a sine', () => {
    expect(StarBandAutotune.readPitch(new Float32Array(2048), 48000).voiced).toBe(false);
    const sine = new Float32Array(2048);
    for (let i = 0; i < sine.length; i += 1) {
      sine[i] = Math.sin((2 * Math.PI * 440 * i) / 48000);
    }
    const reading = StarBandAutotune.readPitch(sine, 48000, { scale: 'chromatic' });
    expect(reading.voiced).toBe(true);
    expect(reading.note).toBe('A4');
    expect(reading.hz).toBeGreaterThan(420);
    expect(reading.hz).toBeLessThan(460);
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

  test('groundedReply describes the tuner needle', () => {
    const reply = groundedReply('show me the tuner needle');
    expect(reply.toLowerCase()).toMatch(/needle/);
    expect(reply.toLowerCase()).toMatch(/guitar/);
  });
});
