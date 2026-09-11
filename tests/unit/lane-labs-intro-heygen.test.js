/**
 * Development work by David Lane
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();

describe('Lane AI Labs intro HeyGen trio', () => {
  test('catalog has Zigzag, Summer, and Dave with short funny scripts', async () => {
    const catalog = JSON.parse(
      await readFile(path.join(root, 'data/lane-labs-intro-heygen.json'), 'utf8')
    );
    const ids = (catalog.clips || []).map((c) => c.id);
    expect(ids).toEqual(['zigzag', 'summer', 'dave']);
    expect(catalog.stitchOrder).toEqual(['zigzag', 'summer', 'dave']);
    expect(catalog.format).toBe('multi-avatar-chat');
    expect(catalog.chatLocalRel).toBe('/shared/assets/video/lane-labs-intro-chat.mp4');
    expect(catalog.videoAgentPrompt).toContain('Lane AI Labs');
    expect(catalog.videoAgentPrompt).toContain('PLAY MODE');
    expect(catalog.videoAgentPrompt).toMatch(/MULTI-PERSON CONVERSATION/i);
    expect(catalog.videoAgentPrompt).toMatch(/talk TO EACH OTHER/i);
    expect(catalog.videoAgentPrompt).not.toMatch(/take turns, MCU/i);
    expect(catalog.videoAgentPrompt).toMatch(/sunflower/i);
    expect(catalog.videoAgentPrompt).toMatch(/Never crop the top of her head/i);
    expect(catalog.videoAgentPrompt.length).toBeLessThan(10000);
    expect((catalog.portraits || []).map((p) => p.id)).toEqual(['zigzag', 'summer', 'dave']);
    for (const clip of catalog.clips) {
      const words = String(clip.script).trim().split(/\s+/).length;
      expect(words).toBeGreaterThan(20);
      expect(words).toBeLessThan(80);
      expect(clip.avatarId).toMatch(/^[a-f0-9]{32}$/i);
      expect(clip.voiceId).toBeTruthy();
    }
    const dave = catalog.clips.find((c) => c.id === 'dave');
    expect(dave.avatarId).toBe('af9577b8a46846c9abafc77ce0043b4b');
    expect(dave.script).toMatch(/Lane AI Labs/i);
  });

  test('home splash prefers the multi-avatar chat and keeps Close tappable', async () => {
    const src = await readFile(path.join(root, 'public/shared/js/fun-home-intro.js'), 'utf8');
    const html = await readFile(path.join(root, 'public/index.html'), 'utf8');
    const css = await readFile(path.join(root, 'public/shared/css/fun-home.css'), 'utf8');
    expect(src).toContain('/shared/assets/video/lane-labs-intro-chat.mp4');
    expect(src).toContain('showChat()');
    expect(src).toContain('function onVideoError');
    expect(src).toContain("closeBtn.textContent = 'Close'");
    expect(src).toContain('pointerdown');
    expect(src).toContain('video.muted = true');
    expect(html).toContain('fun-home-intro.js');
    expect(html).toContain('funIntroReplay');
    expect(html).toContain('lane_labs_intro_heard_v1');
    expect(css).toContain('object-fit: contain');
    expect(css).toContain('#funIntroClose');
  });

  test('chat generator does not lock a single avatar_id', async () => {
    const src = await readFile(
      path.join(root, 'scripts/tools/generate-lane-labs-intro-chat.mjs'),
      'utf8'
    );
    expect(src).toContain('listVideoAgentVideos');
    expect(src).toContain('createVideoAgent');
    expect(src).toContain('orientation: \'landscape\'');
    expect(src).not.toMatch(/avatarId:/);
    expect(src).toContain('uploadHeygenAsset');
  });
});
