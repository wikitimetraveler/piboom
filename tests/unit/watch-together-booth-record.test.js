/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';
import fs from 'fs';
import path from 'path';

async function loadBooth() {
  global.window = global;
  global.document = {
    readyState: 'complete',
    addEventListener: jest.fn(),
    createElement: jest.fn(() => ({
      getContext: () => ({ fillRect: jest.fn(), drawImage: jest.fn() }),
      captureStream: () => ({ getTracks: () => [], getVideoTracks: () => [], getAudioTracks: () => [] }),
      width: 0,
      height: 0,
      style: { cssText: '' },
      setAttribute: jest.fn(),
    })),
    querySelectorAll: jest.fn(() => []),
    body: { appendChild: jest.fn(), removeChild: jest.fn() },
  };
  global.location = { search: '' };
  global.requestAnimationFrame = jest.fn(() => 0);
  global.cancelAnimationFrame = jest.fn();
  await import('../../public/watch-together/js/booth-record.js');
  return global.WatchTogetherBooth;
}

describe('watch-together booth record', () => {
  test('isAudioTrack ignores video publications', async () => {
    const api = await loadBooth();
    expect(api.isAudioTrack({ kind: 'audio' }, { kind: 'audio' })).toBe(true);
    expect(api.isAudioTrack({ kind: 'video' }, { kind: 'video' })).toBe(false);
    expect(api.isAudioTrack({ kind: 'video' }, { kind: 'audio' })).toBe(false);
    expect(api.isAudioTrack(null, { kind: 'audio' })).toBe(true);
  });

  test('mix graph attaches audio and ignores video', async () => {
    const api = await loadBooth();
    const graph = api.createMixGraph();
    expect(
      graph.attach({
        track: { kind: 'video', sid: 'v1' },
        publication: { kind: 'video', trackSid: 'v1' },
        participant: { identity: 'cam' },
      })
    ).toBe(false);
    expect(
      graph.attach({
        track: { kind: 'audio', sid: 'a1' },
        publication: { kind: 'audio', trackSid: 'TR_a1' },
        participant: { identity: 'couch-1' },
      })
    ).toBe(true);
    expect(graph.size()).toBe(1);
    expect(graph.has('TR_a1')).toBe(true);
    expect(
      graph.attach({
        track: { kind: 'audio', sid: 'a1' },
        publication: { kind: 'audio', trackSid: 'TR_a1' },
        participant: { identity: 'couch-1' },
      })
    ).toBe(false);
    expect(
      graph.detach({
        track: { kind: 'audio', sid: 'a1' },
        publication: { kind: 'audio', trackSid: 'TR_a1' },
      })
    ).toBe(true);
    expect(graph.size()).toBe(0);
  });

  test('wantsFaceVideo is opt-in via video=1', async () => {
    const api = await loadBooth();
    expect(api.wantsFaceVideo('')).toBe(false);
    expect(api.wantsFaceVideo('?booth=1')).toBe(false);
    expect(api.wantsFaceVideo('?video=1')).toBe(true);
    expect(api.wantsFaceVideo('code=couch&video=1')).toBe(true);
  });

  test('theater wires Record without a booth layout class', () => {
    const html = fs.readFileSync(
      path.join(process.cwd(), 'public/watch-together/theater.html'),
      'utf8'
    );
    expect(html).toContain('id="wtRecord"');
    expect(html).toContain('booth-record.js');
    const css = fs.readFileSync(
      path.join(process.cwd(), 'public/watch-together/css/watch-together.css'),
      'utf8'
    );
    expect(css).not.toContain('is-booth');
  });
});
