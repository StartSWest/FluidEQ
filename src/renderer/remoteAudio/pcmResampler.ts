/* FluidEQ — GPL-3.0-or-later */

interface IQueuedChunk {
  channels: number;
  frames: number;
  samples: Float32Array;
}

export interface IPcmStream {
  availableFrames: number;
  chunks: IQueuedChunk[];
  position: number;
  kernel: Float32Array;
}

const RESAMPLER_TAPS = 64;
export const RESAMPLER_HALF = RESAMPLER_TAPS / 2;
const RESAMPLER_PHASES = 256;
const KAISER_BETA = 8.6;
const MAX_CACHED_RESAMPLER_KERNELS = 16;
const KERNEL_CACHE = new Map<string, Float32Array>();
const besselI0 = (value: number): number => {
  let sum = 1;
  let term = 1;
  for (let index = 1; index < 20; index += 1) {
    term *= value / 2 / index;
    sum += term * term;
  }
  return sum;
};

const sinc = (value: number): number => {
  if (Math.abs(value) < 1e-12) {
    return 1;
  }
  const radians = Math.PI * value;
  return Math.sin(radians) / radians;
};

export const resamplerKernel = (
  sourceSampleRate: number,
  outputSampleRate: number,
): Float32Array => {
  const cacheKey = `${sourceSampleRate}:${outputSampleRate}`;
  const cached = KERNEL_CACHE.get(cacheKey);
  if (cached) {
    KERNEL_CACHE.delete(cacheKey);
    KERNEL_CACHE.set(cacheKey, cached);
    return cached;
  }
  const table = new Float32Array((RESAMPLER_PHASES + 1) * RESAMPLER_TAPS);
  const rateRatio = outputSampleRate / sourceSampleRate;
  const cutoff = Math.min(rateRatio, 1) * 0.94;
  const normalizer = besselI0(KAISER_BETA);
  for (let phase = 0; phase <= RESAMPLER_PHASES; phase += 1) {
    const offset = phase / RESAMPLER_PHASES;
    for (let tap = 0; tap < RESAMPLER_TAPS; tap += 1) {
      const distance = tap - RESAMPLER_HALF + 1 - offset;
      const windowAt = distance / RESAMPLER_HALF;
      const window =
        windowAt > -1 && windowAt < 1
          ? besselI0(KAISER_BETA * Math.sqrt(1 - windowAt * windowAt)) /
            normalizer
          : 0;
      table[phase * RESAMPLER_TAPS + tap] =
        cutoff * sinc(cutoff * distance) * window;
    }
  }
  if (KERNEL_CACHE.size >= MAX_CACHED_RESAMPLER_KERNELS) {
    const oldestKey = KERNEL_CACHE.keys().next().value;
    if (typeof oldestKey === 'string') {
      KERNEL_CACHE.delete(oldestKey);
    }
  }
  KERNEL_CACHE.set(cacheKey, table);
  return table;
};

const streamSample = (
  peer: IPcmStream,
  channel: number,
  frame: number,
): number => {
  if (frame < 0) {
    return 0;
  }
  let remaining = frame;
  for (let index = 0; index < peer.chunks.length; index += 1) {
    const chunk = peer.chunks[index];
    if (remaining < chunk.frames) {
      const sourceChannel = Math.min(channel, chunk.channels - 1);
      return chunk.samples[remaining * chunk.channels + sourceChannel] ?? 0;
    }
    remaining -= chunk.frames;
  }
  return 0;
};

export const advanceStream = (peer: IPcmStream, frames: number) => {
  peer.position += frames;
  peer.availableFrames = Math.max(0, peer.availableFrames - frames);
  // Retain half a sinc window behind the read head. Dropping a packet as soon
  // as it was consumed left fractional-rate conversion without its history
  // and made every packet boundary a new interpolation edge.
  while (
    peer.chunks.length > 1 &&
    peer.position >= peer.chunks[0].frames + RESAMPLER_HALF
  ) {
    peer.position -= peer.chunks[0].frames;
    peer.chunks.shift();
  }
};

export const readStream = (
  peer: IPcmStream,
  channel: number,
  position: number,
  exact: boolean,
): number => {
  const sourceFrame = Math.floor(position);
  if (exact) {
    return streamSample(peer, channel, sourceFrame);
  }
  const phase = (position - sourceFrame) * RESAMPLER_PHASES;
  const phaseIndex = Math.floor(phase);
  const blend = phase - phaseIndex;
  const low = phaseIndex * RESAMPLER_TAPS;
  const high = low + RESAMPLER_TAPS;
  let sum = 0;
  for (let tap = 0; tap < RESAMPLER_TAPS; tap += 1) {
    const coefficient =
      peer.kernel[low + tap] * (1 - blend) + peer.kernel[high + tap] * blend;
    sum +=
      streamSample(peer, channel, sourceFrame - RESAMPLER_HALF + 1 + tap) *
      coefficient;
  }
  return sum;
};
