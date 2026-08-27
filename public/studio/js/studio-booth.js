/**
 * StarBand booth math — BPM, count-in, click pitch
 * Development work by David Lane
 */
(function (global) {
  'use strict';

  const BPM_MIN = 40;
  const BPM_MAX = 220;
  const BPM_DEFAULT = 92;
  const BEATS_PER_BAR = 4;

  function clampBpm(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return BPM_DEFAULT;
    return Math.max(BPM_MIN, Math.min(BPM_MAX, Math.round(n)));
  }

  function beatSec(bpm) {
    return 60 / clampBpm(bpm);
  }

  function countInBeats(bars) {
    const n = Number(bars);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.min(8, Math.round(n)) * BEATS_PER_BAR;
  }

  function clickHz(accent) {
    return accent ? 1320 : 880;
  }

  function isCountDownbeat(beatIndex) {
    return beatIndex % BEATS_PER_BAR === 0;
  }

  global.StarBandBooth = {
    BPM_MIN,
    BPM_MAX,
    BPM_DEFAULT,
    BEATS_PER_BAR,
    clampBpm,
    beatSec,
    countInBeats,
    clickHz,
    isCountDownbeat,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
