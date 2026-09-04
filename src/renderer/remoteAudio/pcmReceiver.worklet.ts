/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IRemoteAudioPlaybackProfile,
  REMOTE_AUDIO_PLAYBACK_PROFILES,
} from './remoteAudioPlaybackProfiles';

interface IQueuedChunk {
  channels: number;
  frames: number;
  samples: Float32Array;
}

interface IPeerStream {
  availableFrames: number;
  channels: number;
  chunks: IQueuedChunk[];
  expectedSequence?: number;
  fadeDirection: -1 | 0 | 1;
  gain: number;
  kernel: Float32Array;
  meterFilledFrames: number;
  meterPeak: number;
  meterSamples: Float32Array;
  meterSquareSum: number;
  position: number;
  primed: boolean;
  removing: boolean;
  sampleRate: number;
  stableFrames: number;
  targetBufferSeconds: number;
}

interface IPushMessage {
  kind: 'push';
  channels: number;
  frames: number;
  pcm: ArrayBuffer;
  peerId: string;
  sampleRate: number;
  sequence: number;
}

interface IRemoveMessage {
  kind: 'remove-peer';
  peerId: string;
}

interface IConfigureMessage {
  kind: 'configure';
  mode: 'music' | 'video';
  peerId: string;
}

const PROCESSOR_NAME = 'fluideq-remote-audio';
const METER_FRAMES = 1_024;
const FADE_SECONDS = 0.012;
const MAX_DRIFT_CORRECTION = 0.001;
const DRIFT_RESPONSE = 0.01;
const RESAMPLER_TAPS = 64;
const RESAMPLER_HALF = RESAMPLER_TAPS / 2;
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

const resamplerKernel = (
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

const isPushMessage = (value: unknown): value is IPushMessage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const message = value as Partial<IPushMessage>;
  return (
    message.kind === 'push' &&
    typeof message.peerId === 'string' &&
    Number.isInteger(message.sequence) &&
    typeof message.sampleRate === 'number' &&
    message.sampleRate >= 8_000 &&
    message.sampleRate <= 384_000 &&
    Number.isInteger(message.channels) &&
    (message.channels as number) >= 1 &&
    (message.channels as number) <= 8 &&
    Number.isInteger(message.frames) &&
    (message.frames as number) >= 1 &&
    (message.frames as number) <= 8_192 &&
    message.pcm instanceof ArrayBuffer &&
    message.pcm.byteLength ===
      (message.channels as number) * (message.frames as number) * 4
  );
};

const isRemoveMessage = (value: unknown): value is IRemoveMessage =>
  typeof value === 'object' &&
  value !== null &&
  (value as Partial<IRemoveMessage>).kind === 'remove-peer' &&
  typeof (value as Partial<IRemoveMessage>).peerId === 'string';

const isConfigureMessage = (value: unknown): value is IConfigureMessage =>
  typeof value === 'object' &&
  value !== null &&
  (value as Partial<IConfigureMessage>).kind === 'configure' &&
  typeof (value as Partial<IConfigureMessage>).peerId === 'string' &&
  ((value as Partial<IConfigureMessage>).mode === 'music' ||
    (value as Partial<IConfigureMessage>).mode === 'video');

const streamSample = (
  peer: IPeerStream,
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

const advanceStream = (peer: IPeerStream, frames: number) => {
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

class RemoteAudioProcessor extends AudioWorkletProcessor {
  private readonly peers = new Map<string, IPeerStream>();

  private readonly peerModes = new Map<string, 'music' | 'video'>();

  constructor() {
    super();
    this.port.onmessage = ({ data }: MessageEvent<unknown>) => {
      if (isConfigureMessage(data)) {
        this.peerModes.set(data.peerId, data.mode);
        const peer = this.peers.get(data.peerId);
        if (peer) {
          peer.targetBufferSeconds =
            REMOTE_AUDIO_PLAYBACK_PROFILES[data.mode].startBufferSeconds;
          peer.stableFrames = 0;
        }
      } else if (isRemoveMessage(data)) {
        const peer = this.peers.get(data.peerId);
        if (peer) {
          peer.removing = true;
          peer.fadeDirection = -1;
        }
      } else if (isPushMessage(data)) {
        this.push(data);
      }
    };
  }

  private profileFor(peerId: string): IRemoteAudioPlaybackProfile {
    return REMOTE_AUDIO_PLAYBACK_PROFILES[
      this.peerModes.get(peerId) ?? 'music'
    ];
  }

  private push(message: IPushMessage) {
    let peer = this.peers.get(message.peerId);
    const playbackProfile = this.profileFor(message.peerId);
    const streamChanged =
      peer &&
      (peer.sampleRate !== message.sampleRate ||
        peer.channels !== message.channels ||
        peer.expectedSequence !== message.sequence);
    if (!peer || streamChanged) {
      peer = {
        availableFrames: 0,
        channels: message.channels,
        chunks: [],
        fadeDirection: 1,
        gain: 0,
        kernel: resamplerKernel(message.sampleRate, sampleRate),
        meterFilledFrames: 0,
        meterPeak: 0,
        meterSamples: new Float32Array(METER_FRAMES),
        meterSquareSum: 0,
        position: 0,
        primed: false,
        removing: false,
        sampleRate: message.sampleRate,
        stableFrames: 0,
        targetBufferSeconds: this.profileFor(message.peerId).startBufferSeconds,
      };
      this.peers.set(message.peerId, peer);
    }
    const hardMaximumFrames =
      message.sampleRate *
      (playbackProfile.maximumBufferSeconds +
        Math.max(0.25, playbackProfile.startBufferSeconds));
    if (peer.availableFrames + message.frames > hardMaximumFrames) {
      // Falling many packets behind is worse than a controlled re-prime: it
      // makes video permanently late and lets memory grow without a bound.
      // This path only runs after transport backpressure has already failed.
      peer.availableFrames = 0;
      peer.chunks = [];
      peer.fadeDirection = 1;
      peer.gain = 0;
      peer.position = 0;
      peer.primed = false;
      peer.stableFrames = 0;
      peer.targetBufferSeconds = playbackProfile.startBufferSeconds;
    }
    peer.expectedSequence =
      message.sequence === 0xffff_ffff ? 0 : message.sequence + 1;
    peer.chunks.push({
      channels: message.channels,
      frames: message.frames,
      samples: new Float32Array(message.pcm),
    });
    peer.availableFrames += message.frames;
  }

  private publishMeter(peerId: string, peer: IPeerStream, mono: number) {
    peer.meterSamples[peer.meterFilledFrames] = mono;
    peer.meterPeak = Math.max(peer.meterPeak, Math.abs(mono));
    peer.meterSquareSum += mono * mono;
    peer.meterFilledFrames += 1;
    if (peer.meterFilledFrames !== METER_FRAMES) {
      return;
    }

    const waveform = new Float32Array(64);
    for (let index = 0; index < peer.meterSamples.length; index += 1) {
      const point = Math.floor(
        (index * waveform.length) / peer.meterSamples.length,
      );
      const value = peer.meterSamples[index];
      if (Math.abs(value) > Math.abs(waveform[point])) {
        waveform[point] = value;
      }
    }
    this.port.postMessage(
      {
        bufferedMs: (peer.availableFrames / peer.sampleRate) * 1_000,
        kind: 'meter',
        peak: peer.meterPeak,
        rms: Math.sqrt(peer.meterSquareSum / METER_FRAMES),
        sourceId: peerId,
        waveform,
      },
      [waveform.buffer],
    );
    peer.meterFilledFrames = 0;
    peer.meterPeak = 0;
    peer.meterSquareSum = 0;
  }

  private mixPeer(peerId: string, peer: IPeerStream, output: Float32Array[]) {
    const playbackProfile = this.profileFor(peerId);
    let renderedFrames = 0;
    const startFrames = peer.sampleRate * peer.targetBufferSeconds;
    if (!peer.primed) {
      if (peer.removing) {
        this.peers.delete(peerId);
        this.peerModes.delete(peerId);
        return;
      }
      if (peer.availableFrames < startFrames) {
        for (let frame = 0; frame < output[0].length; frame += 1) {
          this.publishMeter(peerId, peer, 0);
        }
        return;
      }
      peer.primed = true;
      peer.fadeDirection = 1;
    }

    if (!peer.removing) {
      const emergencyFrames =
        peer.sampleRate * FADE_SECONDS + RESAMPLER_HALF + 1;
      if (peer.availableFrames <= emergencyFrames) {
        peer.fadeDirection = -1;
      } else if (peer.fadeDirection < 0) {
        // A packet that arrives during the emergency fade reverses it without
        // a discontinuity. The old 120 ms cutoff forced a full rebuffer while
        // valid audio was still queued, which caused the reported micro-stops.
        peer.fadeDirection = 1;
      }
    }
    const targetFrames = peer.sampleRate * peer.targetBufferSeconds;
    const deadbandFrames = peer.sampleRate * playbackProfile.deadbandSeconds;
    const bufferError = peer.availableFrames - targetFrames;
    const correctedError =
      Math.abs(bufferError) <= deadbandFrames
        ? 0
        : bufferError - Math.sign(bufferError) * deadbandFrames;
    const driftCorrection = Math.max(
      -MAX_DRIFT_CORRECTION,
      Math.min(
        MAX_DRIFT_CORRECTION,
        (correctedError / peer.sampleRate) * DRIFT_RESPONSE,
      ),
    );
    const rateRatio = (peer.sampleRate / sampleRate) * (1 + driftCorrection);
    const fadeStep = 1 / (sampleRate * FADE_SECONDS);
    for (let frame = 0; frame < output[0].length; frame += 1) {
      const sourceFrame = Math.floor(peer.position);
      const fraction = peer.position - sourceFrame;
      const exactSample =
        peer.sampleRate === sampleRate &&
        driftCorrection === 0 &&
        fraction < 1e-12;
      // availableFrames is already relative to the fractional read head.
      // Counting sourceFrame again caused false underruns and periodic clicks.
      const requiredFrames = exactSample ? 1 : RESAMPLER_HALF + 1 - fraction;
      if (peer.availableFrames < requiredFrames) {
        peer.gain = 0;
        peer.primed = false;
        peer.stableFrames = 0;
        if (!peer.removing) {
          peer.targetBufferSeconds = Math.min(
            playbackProfile.maximumBufferSeconds,
            peer.targetBufferSeconds + playbackProfile.recoveryStepSeconds,
          );
        }
        for (
          let silentFrame = frame;
          silentFrame < output[0].length;
          silentFrame += 1
        ) {
          this.publishMeter(peerId, peer, 0);
        }
        break;
      }
      if (peer.fadeDirection > 0) {
        peer.gain = Math.min(1, peer.gain + fadeStep);
        if (peer.gain === 1) {
          peer.fadeDirection = 0;
        }
      } else if (peer.fadeDirection < 0) {
        peer.gain = Math.max(0, peer.gain - fadeStep);
      }
      let mono = 0;
      for (let channel = 0; channel < output.length; channel += 1) {
        let value: number;
        if (exactSample) {
          value = streamSample(peer, channel, sourceFrame);
        } else {
          const phase = fraction * RESAMPLER_PHASES;
          const phaseIndex = Math.floor(phase);
          const phaseBlend = phase - phaseIndex;
          const lowOffset = phaseIndex * RESAMPLER_TAPS;
          const highOffset = lowOffset + RESAMPLER_TAPS;
          let sum = 0;
          for (let tap = 0; tap < RESAMPLER_TAPS; tap += 1) {
            const coefficient =
              peer.kernel[lowOffset + tap] * (1 - phaseBlend) +
              peer.kernel[highOffset + tap] * phaseBlend;
            sum +=
              streamSample(
                peer,
                channel,
                sourceFrame - RESAMPLER_HALF + 1 + tap,
              ) * coefficient;
          }
          value = sum;
        }
        value *= peer.gain;
        output[channel][frame] += value;
        mono += value;
      }
      this.publishMeter(peerId, peer, mono / output.length);
      advanceStream(peer, rateRatio);
      renderedFrames += 1;
      if (peer.fadeDirection < 0 && peer.gain === 0) {
        peer.primed = false;
        peer.stableFrames = 0;
        if (!peer.removing) {
          // Increase protection only after a real starvation event. Stable LANs
          // keep the low lip-sync delay; bursty links earn more safety on the
          // next fill without changing or discarding a single audio sample.
          peer.targetBufferSeconds = Math.min(
            playbackProfile.maximumBufferSeconds,
            peer.targetBufferSeconds + playbackProfile.recoveryStepSeconds,
          );
        }
        for (
          let silentFrame = frame + 1;
          silentFrame < output[0].length;
          silentFrame += 1
        ) {
          this.publishMeter(peerId, peer, 0);
        }
        if (peer.removing) {
          this.peers.delete(peerId);
          this.peerModes.delete(peerId);
        }
        break;
      }
    }
    const decaySeconds = playbackProfile.recoveryDecaySeconds;
    if (
      decaySeconds &&
      peer.primed &&
      !peer.removing &&
      peer.targetBufferSeconds > playbackProfile.startBufferSeconds
    ) {
      peer.stableFrames += renderedFrames;
      if (peer.stableFrames >= sampleRate * decaySeconds) {
        peer.targetBufferSeconds = Math.max(
          playbackProfile.startBufferSeconds,
          peer.targetBufferSeconds - playbackProfile.recoveryStepSeconds,
        );
        peer.stableFrames = 0;
      }
    }
  }

  process(_inputs: Float32Array[][], outputs: Float32Array[][]): boolean {
    const output = outputs[0];
    if (!output || output.length === 0) {
      return true;
    }
    output.forEach((channel) => channel.fill(0));
    this.peers.forEach((peer, peerId) => this.mixPeer(peerId, peer, output));
    return true;
  }
}

registerProcessor(PROCESSOR_NAME, RemoteAudioProcessor);

export {};
