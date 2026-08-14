/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

async function loadCamBlur() {
  global.window = global;
  global.document = {
    readyState: 'complete',
    addEventListener: jest.fn(),
    createElement: jest.fn(() => ({
      getContext: () => ({
        fillRect: jest.fn(),
        clearRect: jest.fn(),
        drawImage: jest.fn(),
        fillStyle: '',
        filter: '',
        globalCompositeOperation: 'source-over',
      }),
      captureStream: () => ({ getVideoTracks: () => [{ contentHint: '' }] }),
      width: 0,
      height: 0,
      style: { cssText: '' },
      dataset: {},
      setAttribute: jest.fn(),
      addEventListener: jest.fn(),
    })),
    querySelector: jest.fn(() => null),
    head: { appendChild: jest.fn() },
    body: { appendChild: jest.fn(), removeChild: jest.fn() },
  };
  global.requestAnimationFrame = jest.fn(() => 0);
  global.cancelAnimationFrame = jest.fn();
  await import('../../public/watch-together/js/cam-blur.js');
  return global.WatchTogetherCamBlur;
}

describe('watch-together cam blur', () => {
  test('frameSize caps width at 480 and keeps aspect', async () => {
    const api = await loadCamBlur();
    expect(api.frameSize(960, 540)).toEqual({ width: 480, height: 270 });
    expect(api.frameSize(320, 240)).toEqual({ width: 320, height: 240 });
  });

  test('createProcessor exposes a LiveKit TrackProcessor', async () => {
    const api = await loadCamBlur();
    const processor = api.createProcessor();
    expect(processor.name).toBe('wt-background-blur');
    expect(typeof processor.init).toBe('function');
    expect(typeof processor.destroy).toBe('function');
  });
});
