/**
 * Development work by David Lane
 */
/**
 * Canonical getUserMedia video constraints for discovery tools (same site = same permission).
 * Use on album, nature, finds, fish, bike, donuts pages so the browser reuses one camera grant.
 *
 * Mobile UX: stay silent on start/success — video/preview is self-evident.
 * Only surface errors; prefer getDiscoveryCameraUnavailableMessage().
 */
(function (global) {
  'use strict';

  var VIDEO_CONSTRAINTS = Object.freeze({
    video: {
      facingMode: { ideal: 'environment' },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    },
  });

  /** Default copy when live camera fails — pages may pass a local upload CTA. */
  var DEFAULT_UNAVAILABLE =
    'Camera unavailable — tap Upload photo instead.';

  global.DISCOVERY_CAMERA_VIDEO_CONSTRAINTS = VIDEO_CONSTRAINTS;

  function getDiscoveryCameraUnavailableMessage(uploadHint) {
    if (uploadHint && String(uploadHint).trim()) {
      return 'Camera unavailable — ' + String(uploadHint).trim();
    }
    return DEFAULT_UNAVAILABLE;
  }

  async function getDiscoveryCameraVideoStream() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== 'function') {
      var nx = new Error('Camera API not supported');
      nx.name = 'NotSupportedError';
      throw nx;
    }

    try {
      var q = navigator.permissions && navigator.permissions.query;
      if (typeof q === 'function') {
        var status = await q.call(navigator.permissions, { name: 'camera' });
        if (status && status.state === 'denied') {
          var denied = new Error('Camera permission denied');
          denied.name = 'NotAllowedError';
          throw denied;
        }
      }
    } catch (e) {
      if (e && e.name === 'NotAllowedError') throw e;
    }

    return navigator.mediaDevices.getUserMedia(VIDEO_CONSTRAINTS);
  }

  global.getDiscoveryCameraUnavailableMessage = getDiscoveryCameraUnavailableMessage;
  global.getDiscoveryCameraVideoStream = getDiscoveryCameraVideoStream;
})(typeof window !== 'undefined' ? window : globalThis);
