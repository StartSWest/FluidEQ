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
import openRemoteAudioPort from './openRemoteAudioPort';
import workletUrl from './workletUrl';

interface IAudioSink {
  srcObject: HTMLAudioElement['srcObject'];
  autoplay: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
  setSinkId?(sinkId: string): Promise<void>;
}

interface IRoutableAudioContext extends AudioContext {
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
  onPlaybackBlocked: (blocked: boolean) => void,
  onMeter: TRemoteAudioMeterListener,
): Promise<IPcmMixer> => {
  const context = new AudioContext({
    latencyHint: 'interactive',
  }) as IRoutableAudioContext;
  try {
    await context.audioWorklet.addModule(workletUrl().href);
  } catch (error) {
    await context.close();
    throw error;
  }
  const mixer = new AudioWorkletNode(context, PROCESSOR_NAME, {
    numberOfInputs: 0,
    numberOfOutputs: 1,
    outputChannelCount: [2],
  });
  const usesDirectOutput = typeof context.setSinkId === 'function';
  const destination = usesDirectOutput
    ? undefined
    : context.createMediaStreamDestination();
  const sink = usesDirectOutput ? undefined : createAudioSink();
  if (destination && sink) {
    mixer.connect(destination);
    sink.autoplay = true;
    sink.volume = 1;
    sink.srcObject = destination.stream;
  } else {
    // Chromium's direct sink path avoids the extra MediaStream + <audio>
    // playback queue. That queue was outside the measured network buffer and
    // kept Video visibly behind even when its packets arrived on time.
    mixer.connect(context.destination);
  }
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
        if (context.setSinkId) {
          await context.setSinkId(sinkId);
        } else if (sink?.setSinkId) {
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
      const resumed = context.resume();
      if (context.state === 'suspended') {
        onPlaybackBlocked(true);
      }
      await resumed;
      if (isClosed) {
        return;
      }
      await sink?.play();
      onPlaybackBlocked(false);
    } catch {
      playbackStarted = false;
      if (!isClosed) {
        onPlaybackBlocked(true);
      }
    }
  };

  try {
    const port = await openRemoteAudioPort('playback');
    mixer.port.postMessage({ kind: 'attach', port }, [port]);
    await switchOutput(currentSinkId);
    // A suspended context's resume promise can wait for a user gesture. Return
    // the mixer now so the listener can connect and expose its resume control.
    startPlayback().catch(() => onPlaybackBlocked(true));
  } catch (error) {
    mixer.disconnect();
    sink?.pause();
    destination?.stream.getTracks().forEach((track) => track.stop());
    await context.close();
    throw error;
  }

  return {
    push: (chunk) => {
      if (isClosed) {
        return;
      }
      mixer.port.postMessage({ kind: 'push', ...chunk }, [chunk.pcm]);
      startPlayback().catch(() => onPlaybackBlocked(true));
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
      mixer.port.postMessage({ kind: 'close' });
      await outputSwitch.catch(() => undefined);
      mixer.port.onmessage = null;
      mixer.disconnect();
      if (sink) {
        sink.pause();
        sink.srcObject = null;
      }
      destination?.stream.getTracks().forEach((track) => track.stop());
      await context.close();
    },
  };
};
