/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type {
  ILanRemoteAudioChunk,
  TRemoteAudioStreamMode,
} from '../../common/remoteAudio';
import type { IRemoteAudioMeter, TRemoteAudioMeterListener } from './meter';

interface IAudioSink {
  srcObject: HTMLAudioElement['srcObject'];
  autoplay: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
  setSinkId?(sinkId: string): Promise<void>;
}

export interface IPcmMixer {
  push(chunk: ILanRemoteAudioChunk): void;
  removePeer(peerId: string): void;
  resume(): Promise<void>;
  setPeerMode(peerId: string, mode: TRemoteAudioStreamMode): void;
  setOutput(sinkId: string): Promise<void>;
  close(): Promise<void>;
}

const PROCESSOR_NAME = 'fluideq-remote-audio';

const workletUrl = (): URL =>
  new URL(
    process.env.NODE_ENV === 'production'
      ? './dsp-worklet.js'
      : '/dsp-worklet.dev.js',
    window.location.href,
  );

const createAudioSink = (): IAudioSink => new Audio();

/**
 * Keep every sender on one continuous audio-thread timeline.
 *
 * Creating one AudioBufferSourceNode per network packet restarted Chromium's
 * resampler at every packet boundary. Small delivery variation then became a
 * gap or overlap, heard as clicks and occasional pitch wobble. The worklet
 * owns a per-sender FIFO instead, so equal-rate samples remain byte-identical
 * and rate conversion, when the output hardware requires it, keeps one phase
 * across all packets.
 */
export const createPcmMixer = async (
  outputSinkId: string,
  onPlaybackBlocked: () => void,
  onMeter: TRemoteAudioMeterListener,
): Promise<IPcmMixer> => {
  const context = new AudioContext({ latencyHint: 'interactive' });
  await context.audioWorklet.addModule(workletUrl().href);
  const mixer = new AudioWorkletNode(context, PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const destination = context.createMediaStreamDestination();
  mixer.connect(destination);
  const sink = createAudioSink();
  sink.autoplay = true;
  sink.volume = 1;
  sink.srcObject = destination.stream;
  let currentSinkId = outputSinkId;
  let isClosed = false;
  let playbackStarted = false;
  let outputSwitch = Promise.resolve();

  const switchOutput = (sinkId: string): Promise<void> => {
    const nextSwitch = outputSwitch
      .catch(() => undefined)
      .then(async () => {
        if (isClosed) {
          return undefined;
        }
        if (sink.setSinkId) {
          await sink.setSinkId(sinkId);
        }
        currentSinkId = sinkId;
        return undefined;
      });
    outputSwitch = nextSwitch;
    return nextSwitch;
  };

  mixer.port.onmessage = ({ data }: MessageEvent<unknown>) => {
    if (typeof data !== 'object' || data === null) {
      return;
    }
    const meter = data as Partial<IRemoteAudioMeter> & { kind?: unknown };
    if (
      meter.kind === 'meter' &&
      typeof meter.bufferedMs === 'number' &&
      typeof meter.peak === 'number' &&
      typeof meter.rms === 'number' &&
      typeof meter.sourceId === 'string' &&
      meter.waveform instanceof Float32Array
    ) {
      onMeter({
        bufferedMs: meter.bufferedMs,
        peak: meter.peak,
        rms: meter.rms,
        sourceId: meter.sourceId,
        waveform: meter.waveform,
      });
    }
  };

  const startPlayback = async () => {
    if (playbackStarted || isClosed) {
      return;
    }
    playbackStarted = true;
    try {
      await switchOutput(currentSinkId);
      if (isClosed) {
        return;
      }
      await context.resume();
      await sink.play();
    } catch {
      playbackStarted = false;
      onPlaybackBlocked();
    }
  };

  return {
    push: (chunk) => {
      if (isClosed) {
        return;
      }
      mixer.port.postMessage({ kind: 'push', ...chunk }, [chunk.pcm]);
      startPlayback().catch(() => onPlaybackBlocked());
    },
    removePeer: (peerId) => {
      if (!isClosed) {
        mixer.port.postMessage({ kind: 'remove-peer', peerId });
      }
    },
    resume: async () => {
      playbackStarted = false;
      await startPlayback();
    },
    setPeerMode: (peerId, mode) => {
      if (!isClosed) {
        mixer.port.postMessage({ kind: 'configure', mode, peerId });
      }
    },
    setOutput: async (sinkId: string) => {
      await switchOutput(sinkId);
    },
    close: async () => {
      if (isClosed) {
        return;
      }
      isClosed = true;
      await outputSwitch.catch(() => undefined);
      mixer.port.onmessage = null;
      mixer.disconnect();
      sink.pause();
      sink.srcObject = null;
      destination.stream.getTracks().forEach((track) => track.stop());
      await context.close();
    },
  };
};
