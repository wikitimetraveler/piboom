import { jest } from '@jest/globals';

let voiceServiceInstance;

await jest.unstable_mockModule('../../services/voice.service.js', () => {
  class MockVoiceService {
    constructor() {
      voiceServiceInstance = {
        init: jest.fn().mockResolvedValue(true),
        speak: jest.fn(),
        speakChunked: jest.fn(),
        speakWithGoogle: jest.fn(),
        stopSpeaking: jest.fn(),
        startListening: jest.fn(),
        stopListening: jest.fn(),
        processFrontendCommand: jest.fn(),
        setVoiceFeedback: jest.fn(),
        sayEnabled: true,
        isListening: false,
        voiceCommands: { play: [], stop: [] }
      };
      return voiceServiceInstance;
    }
  }

  return {
    default: MockVoiceService,
    __getInstance: () => voiceServiceInstance
  };
});

await jest.unstable_mockModule('axios', () => ({
  default: {
    post: jest.fn()
  }
}));

const { synthesizeSpeech, speakText } = await import('../../controllers/voice.controller.js');
const { __getInstance } = await import('../../services/voice.service.js');

const createRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('voice.controller', () => {
  test('synthesizeSpeech returns 400 when text is missing', async () => {
    const req = { body: {} };
    const res = createRes();

    await synthesizeSpeech(req, res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Text parameter is required'
    });
  });

  test('synthesizeSpeech returns audio when Google succeeds', async () => {
    const req = { body: { text: 'hello', voice: 'en-US-Standard-D' } };
    const res = createRes();
    const instance = __getInstance();
    instance.speakWithGoogle.mockResolvedValue('base64-audio');

    await synthesizeSpeech(req, res);

    expect(res.json).toHaveBeenCalledWith({
      success: true,
      audio: 'base64-audio',
      format: 'mp3',
      text: 'hello'
    });
  });

  test('synthesizeSpeech falls back when Google returns null', async () => {
    const req = { body: { text: 'hello' } };
    const res = createRes();
    const instance = __getInstance();
    instance.speakWithGoogle.mockResolvedValue(null);

    await synthesizeSpeech(req, res);

    expect(instance.speak).toHaveBeenCalledWith('hello');
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      message: 'Google TTS not available, using local TTS',
      fallback: true
    });
  });

  test('speakText uses chunked speech for long text', async () => {
    const longText = 'a'.repeat(250);
    const req = { body: { text: longText } };
    const res = createRes();
    const instance = __getInstance();

    await speakText(req, res);

    expect(instance.speakChunked).toHaveBeenCalledWith(longText);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({
        success: true,
        text: longText
      })
    );
  });
});
