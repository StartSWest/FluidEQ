/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The signals a ported processor has to survive, generated the same way twice.
 *
 * Every one of these is deterministic. A parity suite whose input differs
 * between runs cannot tell a real divergence from a different random seed, and
 * the failure it produces is one nobody can reproduce — which is worse than no
 * suite, because it teaches people to re-run until it passes.
 *
 * The list is not arbitrary. Each entry is a place a DSP port has historically
 * gone wrong: denormals that cost a hundred cycles a sample, an impulse that
 * exposes a one-sample delay-line offset, a sine sitting exactly on a
 * crossover, a side-only signal through a mid/side transform, a DC offset that
 * a high-pass should remove and a shelf should not.
 */

export interface IParitySignal {
  name: string;
  /** Planar, one array per channel. Always stereo here. */
  channels: Float32Array[];
}

/**
 * xorshift32, written out rather than imported.
 *
 * `Math.random` cannot be seeded, and a dependency for eleven lines of integer
 * arithmetic is a dependency that eventually stops installing. The exact
 * sequence does not matter; that it is the same sequence every time does.
 */
const seeded = (seed: number) => {
  /* eslint-disable no-bitwise -- a shift register is bitwise by definition;
     there is no arithmetic spelling of xorshift, and the rule exists to catch
     `&` used where `&&` was meant rather than to ban integer maths. */
  let state = seed >>> 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state >>>= 0;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 0x100000000;
  };
  /* eslint-enable no-bitwise */
};

const stereo = (frames: number): Float32Array[] => [
  new Float32Array(frames),
  new Float32Array(frames),
];

const silence = (frames: number): IParitySignal => ({
  name: 'silence',
  channels: stereo(frames),
});

/**
 * Just above the denormal boundary, where the arithmetic is still correct and
 * suddenly costs a hundred times more. A processor that flushes to zero and
 * one that does not produce different output here, which is the point.
 */
const nearDenormal = (frames: number): IParitySignal => {
  const channels = stereo(frames);
  for (let at = 0; at < frames; at += 1) {
    channels[0][at] = 1e-38 * (at % 2 === 0 ? 1 : -1);
    channels[1][at] = 1e-40;
  }
  return { name: 'near-denormal', channels };
};

/**
 * Impulses away from the block edge as well as on it.
 *
 * One at sample zero passes a delay line that is off by one; one at 37 does
 * not, and one at the last sample catches a processor that flushes its state
 * before the block ends.
 */
const impulses = (frames: number): IParitySignal => {
  const channels = stereo(frames);
  [0, 1, 37, Math.floor(frames / 2), frames - 1].forEach((at) => {
    if (at >= 0 && at < frames) {
      channels[0][at] = 1;
      channels[1][frames - 1 - at] = -1;
    }
  });
  return { name: 'impulses', channels };
};

const sine = (
  frames: number,
  sampleRate: number,
  hz: number,
  amplitude = 0.5,
): IParitySignal => {
  const channels = stereo(frames);
  const step = (2 * Math.PI * hz) / sampleRate;
  for (let at = 0; at < frames; at += 1) {
    const value = amplitude * Math.sin(step * at);
    channels[0][at] = value;
    channels[1][at] = value;
  }
  return { name: `sine-${Math.round(hz)}hz`, channels };
};

/** Logarithmic 20 Hz to Nyquist, which is how a response is actually read. */
const sweep = (frames: number, sampleRate: number): IParitySignal => {
  const channels = stereo(frames);
  const start = 20;
  const end = sampleRate * 0.45;
  let phase = 0;
  for (let at = 0; at < frames; at += 1) {
    const progress = at / Math.max(1, frames - 1);
    const hz = start * (end / start) ** progress;
    phase += (2 * Math.PI * hz) / sampleRate;
    const value = 0.5 * Math.sin(phase);
    channels[0][at] = value;
    channels[1][at] = value;
  }
  return { name: 'sweep', channels };
};

const white = (frames: number, seed: number): IParitySignal => {
  const channels = stereo(frames);
  const next = seeded(seed);
  for (let at = 0; at < frames; at += 1) {
    channels[0][at] = next() * 2 - 1;
    channels[1][at] = next() * 2 - 1;
  }
  return { name: 'white-noise', channels };
};

/**
 * Pink, by Paul Kellett's filter. Broadband but weighted like programme
 * material, so a processor's behaviour here resembles what music does to it.
 */
const pink = (frames: number, seed: number): IParitySignal => {
  const channels = stereo(frames);
  const next = seeded(seed);
  channels.forEach((channel) => {
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let at = 0; at < frames; at += 1) {
      const value = next() * 2 - 1;
      b0 = 0.99765 * b0 + value * 0.099046;
      b1 = 0.963 * b1 + value * 0.2965164;
      b2 = 0.57 * b2 + value * 1.0526913;
      channel[at] = (b0 + b1 + b2 + value * 0.1848) * 0.2;
    }
  });
  return { name: 'pink-noise', channels };
};

/** The same content in both channels: a side-only processor must output zero. */
const monoAsStereo = (frames: number, seed: number): IParitySignal => {
  const source = pink(frames, seed);
  const channels = [
    Float32Array.from(source.channels[0]),
    Float32Array.from(source.channels[0]),
  ];
  return { name: 'mono-as-stereo', channels };
};

/** Equal and opposite: a mid-only processor must output zero. */
const antiPhase = (frames: number, seed: number): IParitySignal => {
  const source = pink(frames, seed);
  const channels = [
    Float32Array.from(source.channels[0]),
    Float32Array.from(source.channels[0]).map((value) => -value),
  ];
  return { name: 'anti-phase', channels };
};

const dcOffset = (frames: number): IParitySignal => {
  const channels = stereo(frames);
  channels[0].fill(0.35);
  channels[1].fill(-0.2);
  return { name: 'dc-offset', channels };
};

/**
 * NaN and both infinities, and neighbours that must survive untouched.
 *
 * One bad sample entering a filter's state makes every later sample NaN, so a
 * single frame from a broken decoder silences the rest of a track and reads as
 * the engine dying. The expected output here is defined by the engine contract
 * in `dsp.h` — repaired to silence and counted — not by any TypeScript
 * processor, because no TypeScript processor is what fixes it.
 */
const invalidSamples = (frames: number): IParitySignal => {
  const channels = stereo(frames);
  channels[0].fill(0.25);
  channels[1].fill(-0.25);
  channels[0][10] = Number.NaN;
  channels[0][11] = Number.POSITIVE_INFINITY;
  channels[1][12] = Number.NEGATIVE_INFINITY;
  return { name: 'invalid-samples', channels };
};

/**
 * A sine at a quarter of the sample rate, offset so no sample lands on the
 * crest. Its true peak is well above its sample peak, which is the whole
 * reason true-peak metering exists and the case a naive peak follower misses.
 */
const intersamplePeak = (frames: number, sampleRate: number): IParitySignal => {
  const channels = stereo(frames);
  const step = (2 * Math.PI * (sampleRate / 4)) / sampleRate;
  for (let at = 0; at < frames; at += 1) {
    const value = 0.95 * Math.sin(step * at + Math.PI / 4);
    channels[0][at] = value;
    channels[1][at] = value;
  }
  return { name: 'intersample-peak', channels };
};

/** Full scale, then nothing: the shape a release time is actually read from. */
const transientThenSilence = (frames: number): IParitySignal => {
  const channels = stereo(frames);
  const burst = Math.min(64, frames);
  for (let at = 0; at < burst; at += 1) {
    channels[0][at] = 0.9;
    channels[1][at] = 0.9;
  }
  return { name: 'transient-then-silence', channels };
};

/**
 * The crossover frequencies the chain actually splits at.
 *
 * A sine sitting exactly on a corner is where two bands both claim it, and
 * where a phase error between them cancels instead of summing.
 */
export const CROSSOVER_PROBES = [120, 250, 600, 2000, 3000, 8000];

/** Every rate the app can run at, not only the one the developer uses. */
export const PARITY_SAMPLE_RATES = [44100, 48000, 88200, 96000, 176400, 192000];

/**
 * The whole corpus for one sample rate.
 *
 * `frames` is deliberately not a multiple of 128: a processor that only ever
 * sees whole render quanta is a processor whose tail handling is untested, and
 * the device hands over partial blocks routinely.
 */
export const parityCorpus = (
  frames: number,
  sampleRate: number,
): IParitySignal[] => [
  silence(frames),
  nearDenormal(frames),
  impulses(frames),
  sweep(frames, sampleRate),
  ...CROSSOVER_PROBES.filter((hz) => hz < sampleRate / 2).map((hz) =>
    sine(frames, sampleRate, hz),
  ),
  white(frames, 0x51ed270b),
  pink(frames, 0x2545f491),
  monoAsStereo(frames, 0x9e3779b9),
  antiPhase(frames, 0x85ebca6b),
  dcOffset(frames),
  invalidSamples(frames),
  intersamplePeak(frames, sampleRate),
  transientThenSilence(frames),
];
