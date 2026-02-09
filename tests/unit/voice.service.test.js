import { jest } from '@jest/globals';

const spawnMock = jest.fn(() => ({
  on: jest.fn(),
  stdout: { pipe: jest.fn() },
  kill: jest.fn()
}));
const execMock = jest.fn((command, options, callback) => {
  if (typeof options === 'function') {
    options(null, '', '');
    return;
  }
  if (callback) {
    callback(null, '', '');
  }
});

await jest.unstable_mockModule('child_process', () => ({
  spawn: spawnMock,
  exec: execMock
}));

await jest.unstable_mockModule('@google-cloud/text-to-speech', () => ({
  default: {
    TextToSpeechClient: class {
      synthesizeSpeech = jest.fn();
    }
  }
}));

await jest.unstable_mockModule('@google-cloud/speech', () => ({
  SpeechClient: class {
    recognize = jest.fn();
  }
}));

await jest.unstable_mockModule('../../config/index.js', () => ({
  config: { mode: 'cloud' }
}));

const { VoiceService } = await import('../../services/voice.service.js');

describe('VoiceService', () => {
  test('speakWithGoogle returns base64 audio when successful', async () => {
    const service = new VoiceService();
    const synthesizeSpeech = jest.fn().mockResolvedValue([
      { audioContent: Buffer.from('audio') }
    ]);
    service.ttsClient = { synthesizeSpeech };

    const result = await service.speakWithGoogle('hello');

    expect(synthesizeSpeech).toHaveBeenCalled();
    expect(result).toBe(Buffer.from('audio').toString('base64'));
  });

  test('speak falls back to local methods when Google fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const service = new VoiceService();
    service.ttsClient = { synthesizeSpeech: jest.fn().mockRejectedValue(new Error('fail')) };
    service.isWindows = false;
    service.tryEspeakTTS = jest.fn();
    service.tryWebTTS = jest.fn();

    await service.speak('hello');

    expect(service.tryEspeakTTS).toHaveBeenCalled();
    expect(service.tryWebTTS).toHaveBeenCalled();
    if (service.speechTimeout) {
      clearTimeout(service.speechTimeout);
      service.speechTimeout = null;
    }
    consoleErrorSpy.mockRestore();
  });

  test('speak is skipped when voice feedback disabled', async () => {
    const service = new VoiceService();
    service.sayEnabled = false;
    service.ttsClient = { synthesizeSpeech: jest.fn() };

    await service.speak('hello');

    expect(service.ttsClient.synthesizeSpeech).not.toHaveBeenCalled();
  });
});
