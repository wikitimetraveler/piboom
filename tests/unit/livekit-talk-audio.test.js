/**
 * Development work by David Lane
 */
import { jest } from '@jest/globals';
import '../../public/shared/js/livekit-talk-audio.js';

const { LivekitTalkAudio } = globalThis;

describe('LivekitTalkAudio', () => {
  test('default talk capture echo-cancels, suppresses noise, and auto-gains', () => {
    expect(LivekitTalkAudio.capture.echoCancellation).toBe(true);
    expect(LivekitTalkAudio.capture.noiseSuppression).toBe(true);
    expect(LivekitTalkAudio.capture.autoGainControl).toBe(true);
  });

  test('hot capture keeps echo cancel but does not gate with noise suppression', () => {
    expect(LivekitTalkAudio.captureHot.echoCancellation).toBe(true);
    expect(LivekitTalkAudio.captureHot.autoGainControl).toBe(true);
    expect(LivekitTalkAudio.captureHot.noiseSuppression).toBe(false);
  });

  test('applyLocalMicGain calls setVolume on the microphone track', () => {
    const setVolume = jest.fn();
    globalThis.LivekitClient = {
      Track: { Source: { Microphone: 'microphone' } },
    };
    const localParticipant = {
      getTrackPublication: () => ({ track: { setVolume } }),
    };
    LivekitTalkAudio.applyLocalMicGain(localParticipant, 3.16);
    expect(setVolume).toHaveBeenCalledWith(3.16);
    delete globalThis.LivekitClient;
  });

  test('setTalkMic passes hot capture when requested', async () => {
    const setMicrophoneEnabled = jest.fn().mockResolvedValue(undefined);
    globalThis.LivekitClient = {
      Track: { Source: { Microphone: 'microphone' } },
    };
    const localParticipant = {
      setMicrophoneEnabled,
      getTrackPublication: () => null,
    };
    const ok = await LivekitTalkAudio.setTalkMic(localParticipant, true, { hot: true, gain: 2.5 });
    expect(ok).toBe(true);
    expect(setMicrophoneEnabled).toHaveBeenCalledWith(true, LivekitTalkAudio.captureHot);
    delete globalThis.LivekitClient;
  });
});
