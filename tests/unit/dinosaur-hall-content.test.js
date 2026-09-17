/**
 * @jest-environment node
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const CONTENT_PATH = path.join(process.cwd(), 'public/nature/data/dinosaur-content.json');
const REEL_PATH = path.join(process.cwd(), 'public/nature/data/dinosaur-story-reel.json');
const PAGE_PATH = path.join(process.cwd(), 'public/nature/dinosaur-hall.html');
const SCENE_JS_PATH = path.join(process.cwd(), 'public/nature/js/dinosaur-hall-scene.js');
const UI_JS_PATH = path.join(process.cwd(), 'public/nature/js/dinosaur-hall.js');
const REEL_JS_PATH = path.join(process.cwd(), 'public/nature/js/dinosaur-hall-reel.js');
const MENU_PATH = path.join(process.cwd(), 'public/shared/menu-config.js');
const SEARCH_PATH = path.join(process.cwd(), 'public/shared/tool-search-index.js');

let content;
let reel;
let page;
let sceneJs;
let uiJs;
let reelJs;
let menu;
let search;

beforeAll(async () => {
  content = JSON.parse(await readFile(CONTENT_PATH, 'utf8'));
  reel = JSON.parse(await readFile(REEL_PATH, 'utf8'));
  page = await readFile(PAGE_PATH, 'utf8');
  sceneJs = await readFile(SCENE_JS_PATH, 'utf8');
  uiJs = await readFile(UI_JS_PATH, 'utf8');
  reelJs = await readFile(REEL_JS_PATH, 'utf8');
  menu = await readFile(MENU_PATH, 'utf8');
  search = await readFile(SEARCH_PATH, 'utf8');
});

describe('Dinosaur Hall content', () => {
  test('has three Mesozoic eras with palettes', () => {
    expect(content.eras.map((e) => e.id)).toEqual(['triassic', 'jurassic', 'cretaceous']);
    for (const era of content.eras) {
      expect(era.label).toBeTruthy();
      expect(era.years).toBeTruthy();
      expect(era.summary.length).toBeGreaterThan(40);
      expect(era.palette.fog).toMatch(/^#/);
      expect(era.palette.sky).toMatch(/^#/);
      expect(era.palette.ground).toMatch(/^#/);
      expect(era.palette.water).toMatch(/^#/);
    }
  });

  test('species have unique ids, era, diet, length, and misconception/evidence', () => {
    const ids = new Set();
    expect(content.species.length).toBeGreaterThanOrEqual(14);
    for (const sp of content.species) {
      expect(sp.id).toBeTruthy();
      expect(ids.has(sp.id)).toBe(false);
      ids.add(sp.id);
      expect(['triassic', 'jurassic', 'cretaceous']).toContain(sp.era);
      expect(['carnivore', 'herbivore', 'omnivore']).toContain(sp.diet);
      expect(typeof sp.lengthM).toBe('number');
      expect(sp.lengthM).toBeGreaterThan(0);
      expect(sp.commonName.length).toBeGreaterThan(2);
      expect(sp.binomial.length).toBeGreaterThan(4);
      expect(sp.notable.length).toBeGreaterThan(20);
      expect(sp.misconception.length).toBeGreaterThan(10);
      expect(sp.evidence.length).toBeGreaterThan(20);
      expect(sp.bodyPlan).toBeTruthy();
      expect(typeof sp.isDinosaur).toBe('boolean');
      expect(String(sp.image || '')).toMatch(/^https:\/\//);
    }
  });

  test('labels non-dinosaurs clearly', () => {
    const nonDinos = content.species.filter((sp) => sp.isDinosaur === false);
    expect(nonDinos.map((s) => s.id).sort()).toEqual(['mosasaurus', 'pteranodon']);
  });

  test('quiz answers resolve to valid choice ids and species', () => {
    const speciesIds = new Set(content.species.map((s) => s.id));
    expect(content.quiz.length).toBeGreaterThanOrEqual(3);
    expect(content.quiz.length).toBeLessThanOrEqual(8);
    for (const q of content.quiz) {
      expect(q.id).toBeTruthy();
      expect(q.question.length).toBeGreaterThan(10);
      expect(q.choices.length).toBeGreaterThanOrEqual(2);
      const choiceIds = q.choices.map((c) => c.id);
      expect(choiceIds).toContain(q.answerId);
      for (const c of q.choices) {
        expect(c.label).toBeTruthy();
        if (c.speciesId) expect(speciesIds.has(c.speciesId)).toBe(true);
      }
      expect(q.explain.length).toBeGreaterThan(10);
    }
  });
});

describe('Dinosaur Hall page and scripts', () => {
  test('page mounts stage, era chips, quiz, and story controls', () => {
    expect(page).toContain('id="dhStage"');
    expect(page).toContain('id="dhCanvas"');
    expect(page).toContain('id="dhEraChips"');
    expect(page).toContain('id="dhSpeciesGrid"');
    expect(page).toContain('id="dhCompare"');
    expect(page).toContain('id="dhQuiz"');
    expect(page).toContain('id="dhStoryPlay"');
    expect(page).toContain('dinosaur-hall-scene.js');
    expect(page).toContain('dinosaur-hall.js');
    expect(page).toContain('dinosaur-hall-reel.js');
    expect(page).toContain('three@0.160.0');
    expect(page).toContain('gsap');
  });

  test('scene disposes renderer and supports era restage + spotlight', () => {
    expect(sceneJs).toContain('function dispose');
    expect(sceneJs).toContain('renderer.dispose');
    expect(sceneJs).toContain('IntersectionObserver');
    expect(sceneJs).toContain('prefersReducedMotion');
    expect(sceneJs).toContain('setEra');
    expect(sceneJs).toContain('spotlight');
    expect(sceneJs).toContain('DinosaurHallScene');
  });

  test('UI supports deep links and DinosaurHall API', () => {
    expect(uiJs).toContain("params.get('era')");
    expect(uiJs).toContain("params.get('dino')");
    expect(uiJs).toContain("params.get('quiz')");
    expect(uiJs).toContain('window.DinosaurHall');
    expect(uiJs).toContain('runCompare');
  });

  test('reel loads scenes and uses Google TTS first', () => {
    expect(reel.scenes.length).toBeGreaterThanOrEqual(5);
    expect(reelJs).toContain('speakWithGoogle');
    expect(reelJs).toContain("params.get('reel')");
    expect(reelJs).toContain('Escape');
    for (const scene of reel.scenes) {
      expect(scene.id).toBeTruthy();
      expect(scene.anchor).toBeTruthy();
      expect(scene.title).toBeTruthy();
      expect(scene.narration.length).toBeGreaterThan(20);
    }
  });

  test('is registered in Nature tools and search index', () => {
    expect(menu).toContain('/nature/dinosaur-hall.html');
    expect(menu).toContain('Dinosaur Hall');
    expect(search).toContain('/nature/dinosaur-hall.html');
    expect(search).toContain('Dinosaur Hall');
  });
});
