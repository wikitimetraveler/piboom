/**
 * @jest-environment node
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getRamiDemoShort,
  getRamiIntro,
  pickRamiVoice,
  RAMI_LANGS
} from '../../services/jordan-heygen.service.js';
import { getHeygenVideoLibrary } from '../../services/heygen-library.service.js';

const DEMO_PATH = path.join(process.cwd(), 'data/jordan-heygen-demo.json');
const ARABIC_RE = /[\u0600-\u06FF]/;

describe('jordan-heygen.service', () => {
  test('short demo script is authored in each page language', () => {
    const en = getRamiDemoShort('en');
    expect(en.lang).toBe('en');
    expect(en.script).toMatch(/Rami/);
    expect(ARABIC_RE.test(en.script)).toBe(false);
    expect(en.voiceLanguage).toBe('English');

    const ar = getRamiDemoShort('ar');
    expect(ar.lang).toBe('ar');
    expect(ARABIC_RE.test(ar.script)).toBe(true);
    expect(ar.voiceLanguage).toBe('Arabic');
    expect(ar.localPath).not.toBe(en.localPath);
  });

  test('unknown language codes fall back to English', () => {
    expect(getRamiDemoShort('fr').lang).toBe('en');
    expect(getRamiIntro().lang).toBe('en');
    expect(getRamiIntro('ar-JO').lang).toBe('ar');
  });

  test('full intro exists for every supported language', () => {
    for (const lang of RAMI_LANGS) {
      const intro = getRamiIntro(lang);
      expect(intro.script.length).toBeGreaterThan(120);
      expect(intro.aspectRatio).toBe('16:9');
    }
  });

  test('pickRamiVoice keeps the requested language and prefers a male read', () => {
    const voices = [
      { voice_id: 'en-f', name: 'Warm Hannah', gender: 'female', language: 'English' },
      { voice_id: 'en-m', name: 'Warm Marcus', gender: 'male', language: 'English' },
      { voice_id: 'ar-f', name: 'GHIZLANE', gender: 'female', language: 'Arabic' },
      { voice_id: 'ar-m', name: 'Moncellence', gender: 'male', language: 'Arabic' }
    ];
    expect(pickRamiVoice(voices, 'en').voiceId).toBe('en-m');
    expect(pickRamiVoice(voices, 'ar').voiceId).toBe('ar-m');
  });

  test('pickRamiVoice prefers a voice that shares the guide name', () => {
    const voices = [
      { voice_id: 'ar-m', name: 'Moncellence', gender: 'male', language: 'Arabic' },
      { voice_id: 'ar-rami', name: 'Rami Idris', gender: 'male', language: 'Arabic' }
    ];
    expect(pickRamiVoice(voices, 'ar').voiceId).toBe('ar-rami');
  });

  test('pickRamiVoice returns null when no voice matches the language', () => {
    expect(pickRamiVoice([{ voice_id: 'x', name: 'Ken', language: 'Japanese' }], 'ar')).toBeNull();
    expect(pickRamiVoice([], 'en')).toBeNull();
  });

  test('demo catalog carries per-language slots the page reads', async () => {
    const demo = JSON.parse(await readFile(DEMO_PATH, 'utf8'));
    for (const lang of RAMI_LANGS) {
      expect(demo.heygenScriptShort[lang]).toBeTruthy();
      expect(demo.heygenVoiceLanguage[lang]).toBeTruthy();
      expect(demo.heygenVideoLocalShort).toHaveProperty(lang);
    }
    expect(ARABIC_RE.test(demo.heygenScriptShort.ar)).toBe(true);
  });

  test('library exposes a jordan domain without requiring a rendered clip', async () => {
    const jordan = await getHeygenVideoLibrary({ domain: 'jordan' });
    expect(Array.isArray(jordan.videos)).toBe(true);
    expect(jordan.videos.every((v) => v.domain === 'jordan')).toBe(true);
    for (const video of jordan.videos) {
      expect(video.id).toMatch(/^jordan-rami-intro-(en|ar)$/);
      expect(video.sourcePage).toMatch(/^\/jordan\//);
    }
  });
});
