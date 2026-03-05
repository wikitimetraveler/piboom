import { jest } from '@jest/globals';

const setupBrowserGlobals = () => {
  global.window = global;
  delete global.__ttsHelperInitialized;
  delete global.speakWithGoogle;
  delete global.stopSpeech;
  global.document = {
    readyState: 'complete',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  global.atob = (value) => Buffer.from(value, 'base64').toString('binary');
  global.Blob = class {
    constructor(parts, options) {
      this.parts = parts;
      this.type = options?.type;
    }
  };
  global.URL = {
    createObjectURL: jest.fn(() => 'blob:audio'),
    revokeObjectURL: jest.fn()
  };
  global.Audio = class {
    constructor() {
      this.volume = 1;
      this.onended = null;
    }
    async play() {
      return Promise.resolve();
    }
    pause() {}
  };
  global.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.rate = 1;
      this.pitch = 1;
      this.volume = 1;
    }
  };
  global.speechSynthesis = {
    cancel: jest.fn(),
    speak: jest.fn(),
    getVoices: jest.fn(() => [])
  };
};

describe('shared tts helper', () => {
  beforeEach(async () => {
    jest.resetModules();
    setupBrowserGlobals();
  });

  test('speakWithGoogle uses fetch and plays audio on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, audio: Buffer.from('a').toString('base64') })
    });

    await import('../../public/shared/tts.js');

    const result = await window.speakWithGoogle('hello');

    expect(global.fetch).toHaveBeenCalled();
    expect(result).toBe(true);
  });

  test('speakWithGoogle falls back to browser speech when API fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: false })
    });

    await import('../../public/shared/tts.js');

    const result = await window.speakWithGoogle('hello');

    expect(result).toBe(true);
    expect(global.speechSynthesis.speak).toHaveBeenCalled();
  });
});
