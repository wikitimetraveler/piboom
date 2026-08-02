/**
 * @jest-environment node
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  getNiqulaDemoShort,
  getNiqulaIntro,
  pickNiqulaVoice,
  NIQULA_LANGS
} from '../../services/syria-heygen.service.js';
import { getHeygenVideoLibrary } from '../../services/heygen-library.service.js';

const DEMO_PATH = path.join(process.cwd(), 'data/syria-heygen-demo.json');
const ARABIC_RE = /[\u0600-\u06FF]/;

describe('syria-heygen.service', () => {
  test('short demo script is authored in each page language', () => {
    const en = getNiqulaDemoShort('en');
    expect(en.lang).toBe('en');
    expect(en.script).toMatch(/Niqula/);
    expect(ARABIC_RE.test(en.script)).toBe(false);
    expect(en.voiceLanguage).toBe('English');

    const ar = getNiqulaDemoShort('ar');
    expect(ar.lang).toBe('ar');
    expect(ARABIC_RE.test(ar.script)).toBe(true);
    expect(ar.voiceLanguage).toBe('Arabic');
    expect(ar.localPath).not.toBe(en.localPath);
  });

  test('unknown language codes fall back to English', () => {
    expect(getNiqulaDemoShort('fr').lang).toBe('en');
    expect(getNiqulaIntro().lang).toBe('en');
    expect(getNiqulaIntro('ar-SY').lang).toBe('ar');
  });

  test('full intro exists for every supported language', () => {
    for (const lang of NIQULA_LANGS) {
      const intro = getNiqulaIntro(lang);
      expect(intro.script.length).toBeGreaterThan(80);
      expect(intro.localPath || intro.voiceLanguage).toBeTruthy();
    }
  });

  test('pickNiqulaVoice prefers male voices in the requested language', () => {
    const voices = [
      { voice_id: 'f1', name: 'Sara', gender: 'female', language: 'English' },
      { voice_id: 'm1', name: 'Warm Guide', gender: 'male', language: 'English' },
      { voice_id: 'm2', name: 'Niqula Arabic', gender: 'male', language: 'Arabic' }
    ];
    expect(pickNiqulaVoice(voices, 'en')?.voiceId).toBe('m1');
    expect(pickNiqulaVoice(voices, 'ar')?.voiceId).toBe('m2');
    expect(pickNiqulaVoice(voices, 'en')?.voiceId).not.toBe('f1');
  });

  test('demo catalog keeps per-language slots without cross-language fill', async () => {
    const demo = JSON.parse(await readFile(DEMO_PATH, 'utf8'));
    expect(demo.heygenScriptShort.en).toMatch(/Niqula/);
    expect(ARABIC_RE.test(demo.heygenScriptShort.ar)).toBe(true);
    expect(demo.heygenVideoLocalShort.en).toContain('syria-niqula-intro.mp4');
    expect(demo.heygenVideoLocalShort.ar).toContain('syria-niqula-intro-ar.mp4');
    expect(demo.qrLandingPath).toBe('/syria/?demo=heygen');
  });

  test('heygen library exposes syria domain when clips exist', async () => {
    const lib = await getHeygenVideoLibrary({ domain: 'syria' });
    expect(lib).toBeTruthy();
    const ids = (lib.videos || []).map((v) => v.id);
    expect(ids).toEqual(expect.arrayContaining(['syria-niqula-intro-en', 'syria-niqula-intro-ar']));
  });
});
