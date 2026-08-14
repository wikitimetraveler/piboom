/**
 * Development work by David Lane
 */
/**
 * Local-camera background blur for Watch together.
 * Implements LiveKit's TrackProcessor: the published track is already blurred,
 * so every couch sees the effect — not only the local tile.
 */
(function (global) {
  'use strict';

  const MP_VERSION = '0.1.1675465747';
  const MP_BASE =
    'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation@' + MP_VERSION + '/';
  const MAX_WIDTH = 480;

  let segmenterPromise = null;

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      if (global.SelfieSegmentation) {
        resolve();
        return;
      }
      const existing = document.querySelector('script[data-wt-selfie-seg]');
      if (existing) {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', () => reject(new Error('selfie-seg')));
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.crossOrigin = 'anonymous';
      script.dataset.wtSelfieSeg = '1';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('selfie-seg'));
      document.head.appendChild(script);
    });
  }

  function ensure() {
    if (segmenterPromise) return segmenterPromise;
    segmenterPromise = (async () => {
      await loadScript(MP_BASE + 'selfie_segmentation.js');
      const Ctor = global.SelfieSegmentation;
      if (typeof Ctor !== 'function') throw new Error('selfie-seg-missing');
      const segmenter = new Ctor({
        locateFile: (file) => MP_BASE + file,
      });
      segmenter.setOptions({
        modelSelection: 1,
        selfieMode: false,
      });
      if (typeof segmenter.initialize === 'function') {
        await segmenter.initialize();
      }
      return segmenter;
    })().catch((err) => {
      segmenterPromise = null;
      throw err;
    });
    return segmenterPromise;
  }

  function fitCanvas(canvas, width, height) {
    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
    }
  }

  function frameSize(videoWidth, videoHeight) {
    const w = videoWidth || 640;
    const h = videoHeight || 360;
    if (w <= MAX_WIDTH) return { width: w, height: h };
    const scale = MAX_WIDTH / w;
    return { width: Math.round(w * scale), height: Math.round(h * scale) };
  }

  function createProcessor(options) {
    const onFail = typeof options?.onFail === 'function' ? options.onFail : null;
    const person = document.createElement('canvas');
    const mask = document.createElement('canvas');
    const canvas = document.createElement('canvas');
    const personCtx = person.getContext('2d');
    const maskCtx = mask.getContext('2d');
    const ctx = canvas.getContext('2d');
    canvas.width = 640;
    canvas.height = 360;
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const processor = {
      name: 'wt-background-blur',
      processedTrack: undefined,
      video: null,
      running: false,
      busy: false,
      failed: false,
      raf: 0,
      segmenter: null,
      stream: null,
    };

    function sizeFromVideo() {
      const video = processor.video;
      if (!video || !video.videoWidth) return null;
      const next = frameSize(video.videoWidth, video.videoHeight);
      fitCanvas(canvas, next.width, next.height);
      fitCanvas(person, next.width, next.height);
      fitCanvas(mask, next.width, next.height);
      return next;
    }

    function drawFullBlur() {
      const video = processor.video;
      if (!sizeFromVideo() || !video) return;
      const w = canvas.width;
      const h = canvas.height;
      const blurPx = Math.max(14, Math.round(w * 0.045));
      ctx.filter = 'blur(' + blurPx + 'px)';
      ctx.drawImage(video, -12, -12, w + 24, h + 24);
      ctx.filter = 'none';
    }

    function drawMasked(image, segmentationMask) {
      if (!sizeFromVideo()) return;
      const w = canvas.width;
      const h = canvas.height;
      const blurPx = Math.max(12, Math.round(w * 0.04));

      maskCtx.clearRect(0, 0, w, h);
      maskCtx.filter = 'blur(5px)';
      maskCtx.drawImage(segmentationMask, 0, 0, w, h);
      maskCtx.filter = 'none';

      personCtx.clearRect(0, 0, w, h);
      personCtx.drawImage(image, 0, 0, w, h);
      personCtx.globalCompositeOperation = 'destination-in';
      personCtx.drawImage(mask, 0, 0, w, h);
      personCtx.globalCompositeOperation = 'source-over';

      ctx.filter = 'blur(' + blurPx + 'px)';
      ctx.drawImage(image, -blurPx, -blurPx, w + blurPx * 2, h + blurPx * 2);
      ctx.filter = 'none';
      ctx.drawImage(person, 0, 0, w, h);
    }

    function onResults(results) {
      if (!processor.running) return;
      if (results?.segmentationMask && results.image) {
        drawMasked(results.image, results.segmentationMask);
      } else {
        drawFullBlur();
      }
    }

    async function tick() {
      if (!processor.running) return;
      const video = processor.video;
      const segmenter = processor.segmenter;
      if (video && video.readyState >= 2 && video.videoWidth) {
        if (segmenter && !processor.busy) {
          processor.busy = true;
          try {
            await segmenter.send({ image: video });
          } catch (err) {
            console.warn('Watch together blur frame failed', err);
            drawFullBlur();
          }
          processor.busy = false;
        } else if (processor.failed) {
          if (sizeFromVideo()) {
            ctx.filter = 'none';
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        } else if (!segmenter) {
          drawFullBlur();
        }
      }
      processor.raf = requestAnimationFrame(tick);
    }

    processor.init = async function init(opts) {
      processor.video = opts?.element || null;
      processor.running = true;
      processor.busy = false;
      processor.failed = false;
      canvas.setAttribute('aria-hidden', 'true');
      canvas.className = 'wt-blur-canvas';
      canvas.style.cssText =
        'position:fixed;left:-9999px;top:0;width:2px;height:2px;opacity:0;pointer-events:none';
      if (canvas.parentNode !== document.body && document.body) {
        document.body.appendChild(canvas);
      }
      processor.stream = canvas.captureStream(24);
      processor.processedTrack = processor.stream.getVideoTracks()[0];
      if (processor.processedTrack && typeof processor.processedTrack.contentHint === 'string') {
        processor.processedTrack.contentHint = 'motion';
      }
      ensure()
        .then((segmenter) => {
          if (!processor.running) return;
          processor.segmenter = segmenter;
          segmenter.onResults(onResults);
        })
        .catch((err) => {
          console.warn('Watch together blur model failed', err);
          processor.failed = true;
          if (onFail) onFail();
        });
      processor.raf = requestAnimationFrame(tick);
    };

    processor.restart = async function restart(opts) {
      await processor.destroy();
      await processor.init(opts);
    };

    processor.destroy = async function destroy() {
      processor.running = false;
      if (processor.raf) cancelAnimationFrame(processor.raf);
      processor.raf = 0;
      processor.segmenter = null;
      processor.video = null;
      processor.busy = false;
      processor.processedTrack = undefined;
      processor.stream = null;
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    };

    return processor;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ensure().catch(() => {});
    });
  } else {
    ensure().catch(() => {});
  }

  global.WatchTogetherCamBlur = {
    ensure,
    createProcessor,
    frameSize,
  };
})(window);
