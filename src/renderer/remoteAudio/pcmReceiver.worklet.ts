/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IRemoteAudioPlaybackProfile,
  REMOTE_AUDIO_PLAYBACK_PROFILES,
} from './remoteAudioPlaybackProfiles';
import {
  advanceStream,
  readStream,
  resamplerKernel,
  RESAMPLER_HALF,
  type IPcmStream,
} from './pcmResampler';

interface IPeerStream extends IPcmStream {
  channels: number;
  expectedSequence?: number;
  fadeDirection: -1 | 0 | 1;
  gain: number;
  meterFilledFrames: number;
  meterPeak: number;
  meterSamples: Float32Array;
  meterSquareSum: number;
  minimumBufferedFrames: number;
  primed: boolean;
  removing: boolean;
  sampleRate: number;
  skipFrames: number;
  skipBlend: number;
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

/**
 * How one source is buffered: a named network mode, or a profile spelled out.
 *
 * The network's two modes are sized for Wi-Fi. A source in the same machine —
 * the second output — has no link to absorb and brings its own, tighter
 * numbers rather than borrowing a reservoir meant for packet bursts.
 */
type TConfigureMessage = { kind: 'configure'; peerId: string } & (
  { mode: 'music' | 'video' } | { profile: IRemoteAudioPlaybackProfile }
);

const PROCESSOR_NAME = 'fluideq-remote-audio';
const METER_FRAMES = 1_024;
const FADE_SECONDS = 0.012;
const STARVATION_FADE_SECONDS = 0.003;
const MAX_DRIFT_CORRECTION = 0.001;
const DRIFT_RESPONSE = 0.01;
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

const isOptionalSeconds = (value: unknown): boolean =>
  value === undefined || (typeof value === 'number' && value >= 0);

const isPlaybackProfile = (
  value: unknown,
): value is IRemoteAudioPlaybackProfile => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const profile = value as Partial<IRemoteAudioPlaybackProfile>;
  return (
    typeof profile.deadbandSeconds === 'number' &&
    typeof profile.maximumBufferSeconds === 'number' &&
    typeof profile.recoveryStepSeconds === 'number' &&
    typeof profile.startBufferSeconds === 'number' &&
    profile.startBufferSeconds > 0 &&
    profile.maximumBufferSeconds >= profile.startBufferSeconds &&
    isOptionalSeconds(profile.catchupThresholdSeconds) &&
    isOptionalSeconds(profile.recoveryDecaySeconds)
  );
};

const isConfigureMessage = (value: unknown): value is TConfigureMessage => {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const message = value as { kind?: unknown; peerId?: unknown } & Partial<{
    mode: unknown;
    profile: unknown;
  }>;
  return (
    message.kind === 'configure' &&
    typeof message.peerId === 'string' &&
    (message.mode === 'music' ||
      message.mode === 'video' ||
      isPlaybackProfile(message.profile))
  );
};

const profileOf = (message: TConfigureMessage): IRemoteAudioPlaybackProfile =>
  'profile' in message
    ? message.profile
    : REMOTE_AUDIO_PLAYBACK_PROFILES[message.mode];

class RemoteAudioProcessor extends AudioWorkletProcessor {
  private readonly peers = new Map<string, IPeerStream>();

  private readonly peerProfiles = new Map<
    string,
    IRemoteAudioPlaybackProfile
  >();

  private audioPort?: MessagePort;

  constructor() {
    super();
    this.port.onmessage = (event: MessageEvent<unknown>) =>
      this.accept(event.data);
  }

  private accept(data: unknown) {
    if (typeof data === 'object' && data !== null && 'kind' in data) {
      if (data.kind === 'attach' && 'port' in data) {
        this.audioPort?.close();
        this.audioPort = data.port as MessagePort;
        this.audioPort.onmessage = (event: MessageEvent<unknown>) =>
          this.accept(event.data);
        return;
      }
      if (data.kind === 'reset' || data.kind === 'close') {
        this.peers.clear();
        this.peerProfiles.clear();
        if (data.kind === 'close') {
          this.audioPort?.close();
          this.audioPort = undefined;
        }
        return;
      }
    }
    if (isConfigureMessage(data)) {
      const profile = profileOf(data);
      this.peerProfiles.set(data.peerId, profile);
      const peer = this.peers.get(data.peerId);
      if (peer) {
        peer.targetBufferSeconds = profile.startBufferSeconds;
        peer.stableFrames = 0;
        peer.minimumBufferedFrames = Infinity;
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
  }

  private profileFor(peerId: string): IRemoteAudioPlaybackProfile {
    return (
      this.peerProfiles.get(peerId) ?? REMOTE_AUDIO_PLAYBACK_PROFILES.music
    );
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
        minimumBufferedFrames: Infinity,
        position: 0,
        primed: false,
        removing: false,
        sampleRate: message.sampleRate,
        skipFrames: 0,
        skipBlend: 0,
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
      peer.minimumBufferedFrames = Infinity;
      peer.targetBufferSeconds = playbackProfile.startBufferSeconds;
      peer.skipFrames = 0;
      peer.skipBlend = 0;
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
        this.peerProfiles.delete(peerId);
        return;
      }
      if (peer.availableFrames < startFrames) {
        for (let frame = 0; frame < output[0].length; frame += 1) {
          this.publishMeter(peerId, peer, 0);
        }
        return;
      }
      if (playbackProfile.catchupThresholdSeconds) {
        // Replaying everything that arrived during starvation added the whole
        // outage to lip-sync delay. While already silent, resume at the live
        // reservoir instead; music retains every buffered sample.
        advanceStream(
          peer,
          Math.max(0, Math.floor(peer.availableFrames - startFrames)),
        );
      }
      peer.primed = true;
      peer.fadeDirection = 1;
    }

    if (!peer.removing) {
      const emergencyFrames =
        peer.sampleRate * STARVATION_FADE_SECONDS + RESAMPLER_HALF + 1;
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
    const catchupThreshold = playbackProfile.catchupThresholdSeconds;
    if (
      catchupThreshold &&
      !peer.removing &&
      peer.gain === 1 &&
      peer.skipFrames === 0 &&
      peer.availableFrames > targetFrames + peer.sampleRate * catchupThreshold
    ) {
      // A 0.1% clock correction takes tens of seconds to shed one network burst.
      // Crossfade the stale prefix once, at the original pitch, instead of
      // speeding up the programme or stopping playback to empty the queue.
      peer.skipFrames = Math.floor(peer.availableFrames - targetFrames);
      peer.skipBlend = 0;
    }
    const deadbandFrames = peer.sampleRate * playbackProfile.deadbandSeconds;
    const bufferError = peer.availableFrames - peer.skipFrames - targetFrames;
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
      if (peer.availableFrames - peer.skipFrames < requiredFrames) {
        peer.gain = 0;
        peer.primed = false;
        peer.skipFrames = 0;
        peer.skipBlend = 0;
        peer.stableFrames = 0;
        peer.minimumBufferedFrames = Infinity;
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
        // Do not fade valid audio twelve milliseconds before it runs out:
        // normal packet jitter fits the reservoir and should stay at full gain.
        const release = peer.removing
          ? fadeStep
          : 1 / (sampleRate * STARVATION_FADE_SECONDS);
        peer.gain = Math.max(0, peer.gain - release);
      }
      let mono = 0;
      for (let channel = 0; channel < output.length; channel += 1) {
        let value = readStream(peer, channel, peer.position, exactSample);
        if (peer.skipFrames > 0) {
          value =
            value * (1 - peer.skipBlend) +
            readStream(
              peer,
              channel,
              peer.position + peer.skipFrames,
              exactSample,
            ) *
              peer.skipBlend;
        }
        value *= peer.gain;
        output[channel][frame] += value;
        mono += value;
      }
      this.publishMeter(peerId, peer, mono / output.length);
      advanceStream(peer, rateRatio);
      if (peer.skipFrames > 0) {
        peer.skipBlend = Math.min(1, peer.skipBlend + fadeStep);
        if (peer.skipBlend === 1) {
          advanceStream(peer, peer.skipFrames);
          peer.skipFrames = 0;
          peer.skipBlend = 0;
        }
      }
      renderedFrames += 1;
      if (peer.fadeDirection < 0 && peer.gain === 0) {
        peer.primed = false;
        peer.skipFrames = 0;
        peer.skipBlend = 0;
        peer.stableFrames = 0;
        peer.minimumBufferedFrames = Infinity;
        if (!peer.removing) {
          // Increase protection only after a real starvation event. Stable LANs
          // keep the low lip-sync delay; bursty links earn more safety on the
          // next fill. Video can then discard a stale prefix to restore sync.
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
          this.peerProfiles.delete(peerId);
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
      peer.minimumBufferedFrames = Math.min(
        peer.minimumBufferedFrames,
        peer.availableFrames - peer.skipFrames,
      );
      if (peer.stableFrames >= sampleRate * decaySeconds) {
        // "No underrun for two seconds" did not mean the link had improved:
        // recurring packet bursts still used all the protection. Shrinking it
        // unconditionally caused another dropout every recovery cycle. Only
        // remove a step that the lowest observed reservoir can spare, keeping
        // the starvation fade, resampler lookahead and one output quantum.
        const safeReductionFrames =
          peer.sampleRate *
            (playbackProfile.recoveryStepSeconds + STARVATION_FADE_SECONDS) +
          RESAMPLER_HALF +
          output[0].length * rateRatio;
        if (peer.minimumBufferedFrames > safeReductionFrames) {
          peer.targetBufferSeconds = Math.max(
            playbackProfile.startBufferSeconds,
            peer.targetBufferSeconds - playbackProfile.recoveryStepSeconds,
          );
        }
        peer.stableFrames = 0;
        peer.minimumBufferedFrames = Infinity;
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
