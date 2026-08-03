/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';

const setupBrowserGlobals = () => {
  global.window = global;
  delete global.__ttsHelperInitialized;
  delete global.speakWithGoogle;
  delete global.stopSpeech;
  delete global.speakNarrationAwaitEnd;
  global.document = {
    readyState: 'complete',
    addEventListener: jest.fn(),
    removeEventListener: jest.fn()
  };
  global.localStorage = {
    getItem: jest.fn(() => null),
    setItem: jest.fn()
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

  test('speakNarrationAwaitEnd awaits synthesized audio completion', async () => {
    global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', maxTouchPoints: 0 };

    global.Audio = class {
      constructor() {
        this.volume = 1;
        this.onended = null;
      }

      async play() {
        const cb = this.onended;
        queueMicrotask(() => {
          if (cb) cb();
        });
        return Promise.resolve();
      }

      pause() {}
    };

    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, audio: Buffer.from('z').toString('base64') })
    });

    await import('../../public/shared/tts.js');

    await window.speakNarrationAwaitEnd('Scene narration line.');

    expect(global.fetch).toHaveBeenCalled();
  });

  test('speakNarrationAwaitEnd keeps male browser voice when Google synth fails', async () => {
    global.navigator = { userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120', maxTouchPoints: 0 };
    const male = { name: 'Microsoft David', lang: 'en-US', voiceURI: 'david' };
    const female = { name: 'Microsoft Zira', lang: 'en-US', voiceURI: 'zira' };
    global.speechSynthesis.getVoices = jest.fn(() => [female, male]);
    global.speechSynthesis.speak = jest.fn((utterance) => {
      queueMicrotask(() => utterance.onend && utterance.onend());
    });
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: false })
    });

    await import('../../public/shared/tts.js');

    await window.speakNarrationAwaitEnd('Ahlan from Rami.', {
      voice: 'en-US-Neural2-D',
      lang: 'en-US',
      gender: 'male',
      preferFemale: false
    });

    expect(global.speechSynthesis.speak).toHaveBeenCalled();
    const uttered = global.speechSynthesis.speak.mock.calls[0][0];
    expect(uttered.voice).toBe(male);
  });

  test('Arabic narration prefers a male browser voice over the first ar-* voice', async () => {
    global.navigator = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', maxTouchPoints: 5 };
    const femaleAr = { name: 'Microsoft Hoda', lang: 'ar-SA', voiceURI: 'hoda' };
    const maleAr = { name: 'Microsoft Naayf', lang: 'ar-SA', voiceURI: 'naayf' };
    global.speechSynthesis.getVoices = jest.fn(() => [femaleAr, maleAr]);
    global.speechSynthesis.speak = jest.fn((utterance) => {
      queueMicrotask(() => utterance.onend && utterance.onend());
    });
    // Cloud synth attempted first for non-English on mobile; force browser fallback.
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: false })
    });

    await import('../../public/shared/tts.js');

    await window.speakNarrationAwaitEnd('أهلاً وسهلاً', {
      voice: 'ar-XA-Wavenet-B',
      lang: 'ar-XA',
      gender: 'male',
      preferFemale: false
    });

    expect(global.fetch).toHaveBeenCalled();
    expect(global.speechSynthesis.speak).toHaveBeenCalled();
    const uttered = global.speechSynthesis.speak.mock.calls[0][0];
    expect(uttered.voice).toBe(maleAr);
  });

  test('mobile Arabic narration tries Google cloud synth before browser voices', async () => {
    global.navigator = { userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)', maxTouchPoints: 5 };
    global.Audio = class {
      constructor() {
        this.volume = 1;
        this.onended = null;
      }
      async play() {
        const cb = this.onended;
        queueMicrotask(() => {
          if (cb) cb();
        });
        return Promise.resolve();
      }
      pause() {}
    };
    global.fetch = jest.fn().mockResolvedValue({
      json: async () => ({ success: true, audio: Buffer.from('a').toString('base64') })
    });

    await import('../../public/shared/tts.js');

    await window.speakNarrationAwaitEnd('مرحبا', {
      voice: 'ar-XA-Wavenet-B',
      lang: 'ar-XA',
      gender: 'male'
    });

    expect(global.fetch).toHaveBeenCalledWith(
      '/api/voice/synthesize',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('ar-XA-Wavenet-B')
      })
    );
  });
});
