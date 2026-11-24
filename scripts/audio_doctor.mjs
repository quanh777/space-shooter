/**
 * Audio Doctor - offline sanity checker for our procedural WebAudio SFX.
 * Renders sounds at 44.1 kHz, runs them through the 28 Hz DC blocker + limiter,
 * and catches clicks, clipping, DC drift, or mud before they hit your ears.
 */

const SR = 44100;

function synthRecipe(def) {
  const n = Math.ceil(def.durSec * SR);
  const raw = new Float32Array(n);
  for (const voice of def.voices) {
    const startSample = Math.floor((voice.offsetSec || 0) * SR);
    const durSamples = Math.floor(voice.durSec * SR);
    const atkSamples = Math.max(Math.ceil(0.005 * SR), Math.floor(voice.attackSec * SR));
    let phase = 0;
    for (let i = 0; i < durSamples; i++) {
      const idx = startSample + i;
      if (idx >= n) break;
      const u = i / Math.max(1, durSamples - 1);
      const freq = voice.fStart * Math.pow(voice.fEnd / voice.fStart, u);
      phase += (2 * Math.PI * freq) / SR;

      let osc = 0;
      if (voice.type === 'sine') {
        osc = Math.sin(phase);
      } else if (voice.type === 'triangle') {
        osc = (2 / Math.PI) * Math.asin(Math.sin(phase));
      } else {
        // Band-limited saw wave (5 harmonics so it cuts through without aliasing)
        for (let h = 1; h <= 5; h++) {
          osc += (2 / Math.PI) * ((h % 2 === 1 ? 1 : -1) / h) * Math.sin(phase * h);
        }
      }

      let env;
      if (i < atkSamples) {
        env = voice.gain * (i / atkSamples);
      } else {
        const relU = (i - atkSamples) / Math.max(1, durSamples - atkSamples);
        env = voice.gain * Math.pow(0.0001 / Math.max(0.0005, voice.gain), relU);
      }
      // Soft 4ms cosine tail so cut waves never click at the boundary
      const tailLen = Math.min(durSamples, Math.floor(0.006 * SR));
      if (durSamples - 1 - i < tailLen) {
        const w = (durSamples - 1 - i) / Math.max(1, tailLen);
        env *= 0.5 - 0.5 * Math.cos(Math.PI * w);
      }
      raw[idx] += osc * env;
    }
  }

  // 28Hz rumble filter + gentle limiter (-10 dB knee, 8:1) so speakers survive
  const out = new Float32Array(n);
  const rc = 1 / (2 * Math.PI * 28);
  const dt = 1 / SR;
  const alpha = rc / (rc + dt);
  let prevX = 0;
  let prevY = 0;
  const thresh = Math.pow(10, -10 / 20);
  for (let i = 0; i < n; i++) {
    const y = alpha * (prevY + raw[i] - prevX);
    prevX = raw[i];
    prevY = y;
    const absY = Math.abs(y);
    if (absY > thresh) {
      const comp = thresh + (absY - thresh) / 8;
      out[i] = Math.sign(y) * comp * 0.85;
    } else {
      out[i] = y * 0.85;
    }
  }
  return out;
}

function measureMetrics(pcm) {
  let hasNan = false;
  let peak = 0;
  let sum = 0;
  let sumSq = 0;
  let maxDeriv = 0;
  let zcr = 0;
  for (let i = 0; i < pcm.length; i++) {
    const s = pcm[i];
    if (!Number.isFinite(s)) {
      hasNan = true;
      continue;
    }
    const a = Math.abs(s);
    if (a > peak) peak = a;
    sum += s;
    sumSq += s * s;
    if (i > 0) {
      const d = Math.abs(s - pcm[i - 1]);
      if (d > maxDeriv) maxDeriv = d;
      if ((pcm[i - 1] >= 0 && s < 0) || (pcm[i - 1] < 0 && s >= 0)) zcr++;
    }
  }
  const dc = Math.abs(sum / pcm.length);
  const rms = Math.sqrt(sumSq / pcm.length);
  const approxCentroidHz = ((zcr / 2) / (pcm.length / SR));
  return {
    hasNan,
    peak,
    dc,
    startAbs: Math.abs(pcm[0]),
    endAbs: Math.abs(pcm[pcm.length - 1]),
    maxDeriv,
    rms,
    approxCentroidHz,
  };
}

const RECIPES = [
  {
    name: 'chrono_start',
    durSec: 0.45,
    voices: [
      { type: 'sine', fStart: 260, fEnd: 48, gain: 0.34, attackSec: 0.008, durSec: 0.42, offsetSec: 0 },
      { type: 'triangle', fStart: 1240, fEnd: 520, gain: 0.14, attackSec: 0.012, durSec: 0.34, offsetSec: 0.01 },
    ],
  },
  {
    name: 'chrono_end',
    durSec: 0.22,
    voices: [
      { type: 'sine', fStart: 160, fEnd: 620, gain: 0.2, attackSec: 0.008, durSec: 0.18, offsetSec: 0 },
      { type: 'triangle', fStart: 420, fEnd: 960, gain: 0.1, attackSec: 0.006, durSec: 0.15, offsetSec: 0.02 },
    ],
  },
  {
    name: 'sniper_lock',
    durSec: 0.16,
    voices: [
      { type: 'sine', fStart: 1320, fEnd: 1760, gain: 0.2, attackSec: 0.006, durSec: 0.085, offsetSec: 0 },
      { type: 'triangle', fStart: 1760, fEnd: 1980, gain: 0.14, attackSec: 0.005, durSec: 0.08, offsetSec: 0.065 },
    ],
  },
  {
    name: 'mutation_acquired',
    durSec: 0.36,
    voices: [
      { type: 'triangle', fStart: 440, fEnd: 554.37, gain: 0.16, attackSec: 0.008, durSec: 0.16, offsetSec: 0 },
      { type: 'triangle', fStart: 659.25, fEnd: 880, gain: 0.15, attackSec: 0.008, durSec: 0.2, offsetSec: 0.045 },
      { type: 'sine', fStart: 880, fEnd: 1318.5, gain: 0.12, attackSec: 0.01, durSec: 0.24, offsetSec: 0.09 },
    ],
  },
  {
    name: 'singularity_detonate',
    durSec: 0.4,
    voices: [
      { type: 'sawtooth', fStart: 95, fEnd: 34, gain: 0.28, attackSec: 0.007, durSec: 0.36, offsetSec: 0 },
      { type: 'sine', fStart: 380, fEnd: 110, gain: 0.22, attackSec: 0.006, durSec: 0.28, offsetSec: 0.015 },
    ],
  },
  {
    name: 'drone_shot',
    durSec: 0.08,
    voices: [
      { type: 'triangle', fStart: 920, fEnd: 420, gain: 0.16, attackSec: 0.005, durSec: 0.075, offsetSec: 0 },
    ],
  },
  {
    name: 'level_up',
    durSec: 0.36,
    voices: [
      { type: 'triangle', fStart: 523.25, fEnd: 659.25, gain: 0.16, attackSec: 0.007, durSec: 0.14, offsetSec: 0 },
      { type: 'sine', fStart: 783.99, fEnd: 1046.5, gain: 0.15, attackSec: 0.008, durSec: 0.18, offsetSec: 0.05 },
      { type: 'sine', fStart: 1046.5, fEnd: 1318.5, gain: 0.12, attackSec: 0.009, durSec: 0.22, offsetSec: 0.1 },
    ],
  },
  {
    name: 'warp_jump',
    durSec: 0.48,
    voices: [
      { type: 'sine', fStart: 190, fEnd: 42, gain: 0.3, attackSec: 0.009, durSec: 0.44, offsetSec: 0 },
      { type: 'triangle', fStart: 260, fEnd: 1420, gain: 0.15, attackSec: 0.014, durSec: 0.42, offsetSec: 0.03 },
      { type: 'sine', fStart: 520, fEnd: 1860, gain: 0.1, attackSec: 0.018, durSec: 0.36, offsetSec: 0.08 },
    ],
  },
];

let passed = 0;
const centroids = [];
for (const recipe of RECIPES) {
  const pcm = synthRecipe(recipe);
  const m = measureMetrics(pcm);
  const ok =
    !m.hasNan &&
    m.peak <= 0.98 &&
    m.dc < 0.005 &&
    m.startAbs < 0.002 &&
    m.endAbs < 0.002 &&
    m.maxDeriv < 0.38 &&
    m.rms >= 0.02 &&
    m.rms <= 0.45;
  centroids.push(m.approxCentroidHz);
  console.log(
    `[AUDIO_DOCTOR] ${recipe.name}: ok=${ok} peak=${m.peak.toFixed(3)} rms=${m.rms.toFixed(3)} dc=${m.dc.toFixed(5)} maxDeriv=${m.maxDeriv.toFixed(4)} centroidHz=${Math.round(m.approxCentroidHz)}`
  );
  if (ok) passed++;
}

const minC = Math.min(...centroids);
const maxC = Math.max(...centroids);
const diversityOk = maxC - minC > 400;
console.log(`[AUDIO_DOCTOR] centroid_spread_hz=${Math.round(maxC - minC)} diversity_ok=${diversityOk}`);
console.log(`AUDIO_DOCTOR_PASSED=${passed}/${RECIPES.length}`);
if (passed !== RECIPES.length || !diversityOk) {
  process.exit(1);
}
