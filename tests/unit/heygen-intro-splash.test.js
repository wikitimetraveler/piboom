/**
 * Development work by David Lane
 */
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

async function expectFile(rel) {
  await access(path.join(root, rel));
}

describe('HeyGen intro splash', () => {
  test('Mountain High splash plays the full Bud Master clip at full speed', async () => {
    const src = await readFile(path.join(root, 'public/mountain-high/js/mhm-heygen.js'), 'utf8');
    const demo = JSON.parse(
      await readFile(path.join(root, 'data/mountain-high-heygen-demo.json'), 'utf8')
    );
    const face = JSON.parse(
      await readFile(path.join(root, 'data/mountain-high-heygen-face.json'), 'utf8')
    );
    expect(demo.heygenVideoLocalShort).toBe('/mountain-high/assets/video/hippie-botanist-intro.mp4');
    expect(face.introVideo).toBe('/mountain-high/assets/video/hippie-botanist-intro.mp4');
    expect(src).toContain("INTRO_FALLBACK = '/mountain-high/assets/video/hippie-botanist-intro.mp4'");
    expect(src).toContain('playIntro({ splash: true })');
    expect(src).toContain('mhm-heygen-demo-modal--splash');
    expect(src).toContain('playbackRate = 1');
    expect(src).not.toContain('SPLASH_CLIP');
    expect(src).not.toContain('bindSplashClip');
    expect(src).toMatch(/function stopIntro\([\s\S]*markHeard\(/);
    expect(src).toContain("closeBtn.textContent = 'Close'");
    expect(src).toContain('pointerdown');
    expect(src).toContain('video.muted = true');
    expect(src).not.toContain('planHeygenPlay');
    expect(src).not.toContain('mhmHeygenPlay');
    await expectFile('public/mountain-high/assets/video/hippie-botanist-intro.mp4');
  });

  test('Planetarium splash plays the full Zigzag clip at full speed', async () => {
    const src = await readFile(path.join(root, 'public/planetarium/js/planetarium-heygen.js'), 'utf8');
    const face = JSON.parse(
      await readFile(path.join(root, 'data/studio-heygen-face.json'), 'utf8')
    );
    expect(face.introVideo).toBe('/planetarium/assets/video/alienigena-zigzag-intro.mp4');
    expect(src).toContain("INTRO_FALLBACK = '/planetarium/assets/video/alienigena-zigzag-intro.mp4'");
    expect(src).toContain('playIntro({ splash: true })');
    expect(src).toContain('plan-heygen-demo-modal--splash');
    expect(src).toContain('playbackRate = 1');
    expect(src).not.toContain('SPLASH_CLIP');
    expect(src).not.toContain('bindSplashClip');
    expect(src).toMatch(/function stopIntro\([\s\S]*markHeard\(/);
    expect(src).toContain("closeBtn.textContent = 'Close'");
    expect(src).toContain('pointerdown');
    expect(src).toContain('video.muted = true');
    expect(src).not.toContain('planHeygenPlay');
    await expectFile('public/planetarium/assets/video/alienigena-zigzag-intro.mp4');
  });
});
