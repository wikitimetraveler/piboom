/**
 * Talk-mic defaults for LiveKit rooms — always echo-cancel so speakers/guitar do not loop.
 * Local DAW “music input” stays separate (studio-desk openMicStream).
 */
(function (global) {
  'use strict';

  const capture = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    voiceIsolation: true,
    channelCount: 1,
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

  global.LivekitTalkAudio = {
    capture,
    roomOptions,
    isLocalParticipant,
    skipAttach,
    prepareAttachedMedia,
  };
})(typeof window !== 'undefined' ? window : globalThis);
