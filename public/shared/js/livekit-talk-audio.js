/**
 * Talk-mic defaults for LiveKit rooms — echo-cancel so speakers/guitar do not loop.
 * Local DAW “music input” stays separate (studio-desk openMicStream).
 */
(function (global) {
  'use strict';

  const capture = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
  };

  /** Studio talk: keep echo-cancel, drop NS gating, keep AGC so quiet mics come up. */
  const captureHot = {
    echoCancellation: true,
    noiseSuppression: false,
    autoGainControl: true,
  };

  const captureSoft = {
    echoCancellation: true,
  };

  function roomOptions(extra) {
    return Object.assign(
      {
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: Object.assign({}, capture),
      },
      extra || {}
    );
  }

  function isLocalParticipant(participant) {
    return Boolean(participant && participant.isLocal);
  }

  function skipAttach(track, participant) {
    return Boolean(track && track.kind === 'audio' && isLocalParticipant(participant));
  }

  function prepareAttachedMedia(el, local) {
    if (!el) return el;
    el.playsInline = true;
    el.autoplay = true;
    if (local) {
      el.muted = true;
      el.volume = 0;
    }
    return el;
  }

  async function unmuteMicrophone(localParticipant) {
    const LK = global.LivekitClient;
    if (!localParticipant || !LK?.Track?.Source) return;
    const pub =
      typeof localParticipant.getTrackPublication === 'function'
        ? localParticipant.getTrackPublication(LK.Track.Source.Microphone)
        : null;
    try {
      if (pub?.isMuted && typeof pub.unmute === 'function') await pub.unmute();
    } catch (_) {
      /* ignore */
    }
    const media = pub?.track?.mediaStreamTrack;
    if (media) media.enabled = true;
  }

  function applyLocalMicGain(localParticipant, gain) {
    const LK = global.LivekitClient;
    if (!localParticipant || !LK?.Track?.Source) return;
    const pub =
      typeof localParticipant.getTrackPublication === 'function'
        ? localParticipant.getTrackPublication(LK.Track.Source.Microphone)
        : null;
    const track = pub?.track;
    if (!track || typeof track.setVolume !== 'function') return;
    const vol = Number(gain);
    if (!Number.isFinite(vol) || vol <= 0) return;
    try {
      track.setVolume(vol);
    } catch (_) {
      /* ignore */
    }
  }

  async function setTalkMic(localParticipant, enabled, opts) {
    if (!localParticipant || typeof localParticipant.setMicrophoneEnabled !== 'function') {
      throw new Error('No LiveKit participant');
    }
    if (!enabled) {
      await localParticipant.setMicrophoneEnabled(false);
      return false;
    }
    const preferred = opts && opts.hot ? captureHot : capture;
    const attempts = [preferred, captureSoft, undefined];
    let lastErr = null;
    for (let i = 0; i < attempts.length; i += 1) {
      try {
        if (attempts[i]) {
          await localParticipant.setMicrophoneEnabled(true, attempts[i]);
        } else {
          await localParticipant.setMicrophoneEnabled(true);
        }
        await unmuteMicrophone(localParticipant);
        if (opts && opts.gain != null) applyLocalMicGain(localParticipant, opts.gain);
        return true;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error('Mic failed');
  }

  global.LivekitTalkAudio = {
    capture,
    captureHot,
    roomOptions,
    isLocalParticipant,
    skipAttach,
    prepareAttachedMedia,
    unmuteMicrophone,
    applyLocalMicGain,
    setTalkMic,
  };
})(typeof window !== 'undefined' ? window : globalThis);
