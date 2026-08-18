/**
 * StarBand voice autotune — YIN pitch snap + overlap-add shift
 * Development work by David Lane
 * Guitar lanes stay dry. This is for sung voice only.
 */
(function (global) {
  const NOTE_NAMES = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
  const SCALES = {
    chromatic: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
    major: [0, 2, 4, 5, 7, 9, 11],
    minor: [0, 2, 3, 5, 7, 8, 10],
  };
  const KEYS = NOTE_NAMES.map((name, root) => ({ id: name, root, label: name }));

  function hzToMidi(hz) {
    if (!(hz > 0)) return 0;
    return 69 + 12 * Math.log2(hz / 440);
  }

  function midiToHz(midi) {
    return 440 * 2 ** ((midi - 69) / 12);
  }

  function snapMidi(midi, root = 0, scale = 'chromatic') {
    const intervals = SCALES[scale] || SCALES.chromatic;
    const from = Math.floor(midi) - 12;
    const to = Math.floor(midi) + 12;
    let best = Math.round(midi);
    let bestDist = Infinity;
    for (let n = from; n <= to; n += 1) {
      const pc = ((n - root) % 12 + 12) % 12;
      if (!intervals.includes(pc)) continue;
      const dist = Math.abs(midi - n);
      if (dist < bestDist) {
        bestDist = dist;
        best = n;
      }
    }
    return best;
  }

  function snapHz(hz, root = 0, scale = 'chromatic', amount = 1) {
    if (!(hz > 0)) return hz;
    const midi = hzToMidi(hz);
    const mixed = midi + Math.max(0, Math.min(1, amount)) * (snapMidi(midi, root, scale) - midi);
    return midiToHz(mixed);
  }

  function yinPitch(samples, sampleRate, tauMin, tauMax, threshold = 0.12) {
    const n = samples.length;
    const maxTau = Math.min(tauMax, Math.floor(n / 2) - 2);
    const minTau = Math.max(2, tauMin);
    if (maxTau <= minTau + 2) return 0;

    let running = 0;
    let bestTau = 0;
    let bestCmnd = 1;
    const diffAt = (tau) => {
      let sum = 0;
      const limit = n - tau;
      for (let i = 0; i < limit; i += 1) {
        const d = samples[i] - samples[i + tau];
        sum += d * d;
      }
      return sum;
    };

    for (let tau = minTau; tau <= maxTau; tau += 1) {
      const diff = diffAt(tau);
      running += diff;
      const cmnd = (diff * (tau - minTau + 1)) / (running || 1);
      if (cmnd < bestCmnd) {
        bestCmnd = cmnd;
        bestTau = tau;
      }
      if (bestTau && cmnd < threshold && tau > bestTau + 4 && cmnd > bestCmnd + 0.02) break;
    }
    if (!bestTau || bestCmnd > 0.28) return 0;

    const prev = diffAt(Math.max(minTau, bestTau - 1));
    const mid = diffAt(bestTau);
    const next = diffAt(Math.min(maxTau, bestTau + 1));
    const denom = 2 * mid - next - prev;
    const refined = denom ? bestTau + (next - prev) / (2 * denom) : bestTau;
    return sampleRate / refined;
  }

  function hann(size) {
    const w = new Float32Array(size);
    if (size < 2) {
      w[0] = 1;
      return w;
    }
    for (let i = 0; i < size; i += 1) {
      w[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / (size - 1));
    }
    return w;
  }

  function sampleAt(data, index) {
    if (index <= 0) return data[0] || 0;
    if (index >= data.length - 1) return data[data.length - 1] || 0;
    const i = index | 0;
    const f = index - i;
    return data[i] + (data[i + 1] - data[i]) * f;
  }

  function rms(frame) {
    let sum = 0;
    for (let i = 0; i < frame.length; i += 1) sum += frame[i] * frame[i];
    return Math.sqrt(sum / (frame.length || 1));
  }

  function correctChannel(input, sampleRate, opts) {
    const amount = Number.isFinite(opts.amount) ? opts.amount : 0.92;
    const root = Number.isFinite(opts.root) ? opts.root : 0;
    const scale = opts.scale || 'chromatic';
    const hard = opts.speed !== 'natural';
    const winSize = 1024;
    const hop = hard ? 256 : 512;
    const window = hann(winSize);
    const out = new Float32Array(input.length);
    const norm = new Float32Array(input.length);
    const detectHop = hard ? hop * 2 : hop * 4;
    const tauMin = Math.max(2, Math.floor(sampleRate / 1100));
    const tauMax = Math.floor(sampleRate / 70);
    let ratio = 1;
    const smooth = hard ? 0.72 : 0.28;
    const minRms = 0.008;

    for (let pos = 0; pos < input.length; pos += hop) {
      if (pos % detectHop === 0 || pos === 0) {
        const end = Math.min(input.length, pos + winSize);
        const frame = input.subarray(pos, end);
        if (rms(frame) < minRms) {
          ratio += (1 - ratio) * (hard ? 0.5 : 0.2);
        } else {
          const hz = yinPitch(frame, sampleRate, tauMin, Math.min(tauMax, Math.floor(frame.length / 2) - 2));
          if (hz >= 70 && hz <= 1100) {
            const target = snapHz(hz, root, scale, amount);
            const nextRatio = target / hz;
            const clamped = Math.max(0.5, Math.min(2, nextRatio));
            ratio += (clamped - ratio) * smooth;
          } else {
            ratio += (1 - ratio) * 0.4;
          }
        }
      }

      const half = winSize / 2;
      for (let i = 0; i < winSize; i += 1) {
        const dest = pos + i;
        if (dest >= out.length) break;
        const srcIndex = pos + (i - half) * ratio + half;
        const s = sampleAt(input, srcIndex) * window[i];
        out[dest] += s;
        norm[dest] += window[i];
      }
    }

    for (let i = 0; i < out.length; i += 1) {
      out[i] = norm[i] > 1e-4 ? out[i] / norm[i] : input[i];
    }
    return out;
  }

  function correctBuffer(audioBuffer, opts = {}) {
    if (!audioBuffer || typeof audioBuffer.getChannelData !== 'function') return audioBuffer;
    const rate = audioBuffer.sampleRate;
    const length = audioBuffer.length;
    const channels = audioBuffer.numberOfChannels;
    const out = new AudioBuffer({ length, numberOfChannels: channels, sampleRate: rate });
    for (let ch = 0; ch < channels; ch += 1) {
      out.copyToChannel(correctChannel(audioBuffer.getChannelData(ch), rate, opts), ch);
    }
    return out;
  }

  function isVoiceTrack(track) {
    if (!track) return false;
    if (track.kind === 'vocal') return true;
    return /vocal|harmony|voice|vox/i.test(String(track.name || ''));
  }

  global.StarBandAutotune = {
    NOTE_NAMES,
    KEYS,
    SCALES,
    hzToMidi,
    midiToHz,
    snapMidi,
    snapHz,
    yinPitch,
    correctBuffer,
    isVoiceTrack,
  };
})(typeof globalThis !== 'undefined' ? globalThis : window);
