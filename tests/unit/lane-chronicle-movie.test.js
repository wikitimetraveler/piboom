/**
 * Development work by David Lane
 * The Lane Chronicle featurette catalog, cinema page, and library registration.
 */
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function readJson(rel) {
  return JSON.parse(await readFile(path.join(root, rel), 'utf8'));
}

describe('Lane Chronicle movie', () => {
  test('catalog has 7 beats totaling 150s with required HeyGen ancestor videos', async () => {
    const catalog = await readJson('data/lane-chronicle-movie.json');
    expect(catalog.id).toBe('lane-chronicle');
    expect(catalog.aspectRatio).toBe('16:9');
    expect(catalog.targetDurationSec).toBe(150);
    expect(catalog.cinemaPage).toBe('/family/lane-cinema.html');
    expect(catalog.projectDir).toBe('video/lane-chronicle');
    expect(catalog.renderedMovieUrl).toBe('/family/assets/video/lane-chronicle-movie.mp4');

    const beats = catalog.beats || [];
    expect(beats).toHaveLength(7);
    expect(beats.map((b) => b.id)).toEqual([
      'hook',
      'william',
      'sarah',
      'cornet',
      'cosmos',
      'graph',
      'finale'
    ]);

    const durationSum = beats.reduce((n, b) => n + Number(b.durationSec || 0), 0);
    expect(durationSum).toBe(150);

    let cursor = 0;
    for (const beat of beats) {
      expect(beat.startSec).toBe(cursor);
      expect(beat.evidence).toBeTruthy();
      expect(beat.context).toBeTruthy();
      expect(String(beat.teleprompter || '').split(/\s+/).length).toBeGreaterThan(8);
      cursor += beat.durationSec;
    }

    const heygenBeats = beats.filter((b) => b.heygenVideoUrl);
    expect(heygenBeats.map((b) => b.id)).toEqual(['william', 'sarah', 'cornet', 'cosmos']);
    for (const beat of heygenBeats) {
      const rel = path.join(root, 'public', beat.heygenVideoUrl.replace(/^\//, ''));
      await access(rel);
    }
    const cosmos = beats.find((b) => b.id === 'cosmos');
    await access(path.join(root, 'public', cosmos.secondaryVideoUrl.replace(/^\//, '')));

    expect(catalog.stats).toEqual({
      numberedFamilies: 180,
      codedPeople: 650,
      bookVerifiedLinks: 567
    });
  });

  test('HyperFrames project mirrors catalog duration and beat ids', async () => {
    const scenes = await readJson('video/lane-chronicle/scenes.json');
    const html = await readFile(path.join(root, 'video/lane-chronicle/index.html'), 'utf8');
    const pkg = await readJson('video/lane-chronicle/package.json');

    expect(scenes.durationSec).toBe(150);
    expect(scenes.beats).toHaveLength(7);
    expect(scenes.publishTarget).toContain('lane-chronicle-movie.mp4');
    expect(pkg.scripts.narration).toContain('make-narration.mjs');
    expect(pkg.scripts.heygen).toContain('make-heygen-clips.mjs');

    expect(html).toContain('data-composition-id="lane-chronicle"');
    expect(html).toContain('data-duration="150"');
    expect(html).toContain('window.__timelines[\'lane-chronicle\']');
    expect(html).toContain('class="scene clip"');
    expect(html).toMatch(/william-e-lane-boston-heygen-short\.mp4/);
    expect(html).toMatch(/sarah-dickinson-lane-heygen-short\.mp4/);
    expect(html).toMatch(/cornet-john-lane-heygen\.mp4/);
    expect(html).toMatch(/jonathan-homer-lane-heygen\.mp4/);
    expect(html).toMatch(/george-g-lane-idiot-heygen-short\.mp4/);
  });

  test('cinema page wires live stage, chapters, and evidence inspector', async () => {
    const html = await readFile(path.join(root, 'public/family/lane-cinema.html'), 'utf8');
    const js = await readFile(path.join(root, 'public/family/js/lane-cinema.js'), 'utf8');
    const css = await readFile(path.join(root, 'public/family/css/lane-cinema.css'), 'utf8');
    const scriptDoc = await readFile(path.join(root, 'docs/LANE_CHRONICLE_MOVIE_SCRIPT.md'), 'utf8');

    expect(html).toContain('id="lcLiveStage"');
    expect(html).toContain('id="lcChapters"');
    expect(html).toContain('id="lcEvidence"');
    expect(html).toContain('id="lcContext"');
    expect(html).toContain('id="lcTeleprompter"');
    expect(html).toContain('lane-cinema.js');
    expect(js).toContain('/data/lane-chronicle-movie.json');
    expect(js).toContain('Evidence');
    expect(js).toContain('jumpToBeat');
    expect(css).toContain('.lane-cinema-stage');
    expect(scriptDoc).toMatch(/Beat sheet/i);
    expect(scriptDoc).toMatch(/Teleprompter/i);
    expect(scriptDoc).toMatch(/HeyGen v3/i);
  });

  test('hub, pill nav, genealogy, and libraries register the film', async () => {
    const pill = await readFile(path.join(root, 'public/family/js/lane-family-pill-nav.js'), 'utf8');
    const hub = await readFile(path.join(root, 'public/family/lane-family.html'), 'utf8');
    const genealogy = await readFile(path.join(root, 'public/family/genealogy.html'), 'utf8');
    const hf = await readJson('data/hyperframes-library.json');
    const lib = await readJson('data/heygen-video-library.json');

    expect(pill).toContain("/family/lane-cinema.html");
    expect(pill).toContain("label: 'Cinema'");
    expect(hub).toContain('/family/lane-cinema.html');
    expect(hub).toMatch(/Lane Cinema/i);
    expect(genealogy).toContain('/family/lane-cinema.html');

    const project = (hf.projects || []).find((p) => p.id === 'lane-chronicle');
    expect(project).toBeTruthy();
    expect(project.sourcePage).toBe('/family/lane-cinema.html');
    expect(project.projectDir).toBe('video/lane-chronicle');
    expect(project.videoUrl).toBe('/family/assets/video/lane-chronicle-movie.mp4');

    const entry = (lib.videos || []).find((v) => v.id === 'lane-chronicle-featurette');
    expect(entry).toBeTruthy();
    expect(entry.domain).toBe('lane');
    expect(entry.sourcePage).toBe('/family/lane-cinema.html');
    expect(entry.tags).toEqual(expect.arrayContaining(['lane', 'chronicle', 'hyperframes']));
  });
});
