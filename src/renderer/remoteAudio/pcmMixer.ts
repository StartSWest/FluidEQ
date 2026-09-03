/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';

interface IAudioSink {
  srcObject: HTMLAudioElement['srcObject'];
  autoplay: boolean;
  volume: number;
  play(): Promise<void>;
  pause(): void;
  setSinkId?(sinkId: string): Promise<void>;
}

interface IPeerQueue {
  bufferedSeconds: number;
  nextTime?: number;
  pending: ILanRemoteAudioChunk[];
  scheduled: Set<AudioBufferSourceNode>;
}

export interface IPcmMixer {
  push(chunk: ILanRemoteAudioChunk): void;
  removePeer(peerId: string): void;
  resume(): Promise<void>;
  setOutput(sinkId: string): Promise<void>;
  close(): Promise<void>;
}

const INITIAL_BUFFER_SECONDS = 0.16;
const RECOVERY_LEAD_SECONDS = 0.08;

const createAudioSink = (): IAudioSink => new Audio();

/**
 * Mix every sender in one Web Audio graph and play that graph through the
 * selected headset. Chunks remain Float32 PCM; no encode/decode step exists.
 */
export const createPcmMixer = (
  outputSinkId: string,
  onPlaybackBlocked: () => void,
): IPcmMixer => {
  const context = new AudioContext({ latencyHint: 'interactive' });
  const destination = context.createMediaStreamDestination();
  const sink = createAudioSink();
  sink.autoplay = true;
  sink.volume = 1;
  sink.srcObject = destination.stream;
  const queues = new Map<string, IPeerQueue>();
  let currentSinkId = outputSinkId;
  let isClosed = false;
  let playbackStarted = false;

  const startPlayback = async () => {
    if (playbackStarted || isClosed) {
      return;
    }
    playbackStarted = true;
    try {
      if (currentSinkId && sink.setSinkId) {
        await sink.setSinkId(currentSinkId);
      }
      await context.resume();
      await sink.play();
    } catch {
      playbackStarted = false;
      onPlaybackBlocked();
    }
  };

  const schedule = (queue: IPeerQueue, chunk: ILanRemoteAudioChunk) => {
    const samples = new Float32Array(chunk.pcm);
    if (samples.length !== chunk.frames * chunk.channels) {
      return;
    }
    const buffer = context.createBuffer(
      chunk.channels,
      chunk.frames,
      chunk.sampleRate,
    );
    for (let channel = 0; channel < chunk.channels; channel += 1) {
      const channelSamples = buffer.getChannelData(channel);
      for (let frame = 0; frame < chunk.frames; frame += 1) {
        channelSamples[frame] = samples[frame * chunk.channels + channel];
      }
    }
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(destination);
    queue.scheduled.add(source);
    source.onended = () => {
      queue.scheduled.delete(source);
      source.disconnect();
    };
    const earliest = context.currentTime + RECOVERY_LEAD_SECONDS;
    const startAt = Math.max(queue.nextTime ?? earliest, earliest);
    source.start(startAt);
    queue.nextTime = startAt + chunk.frames / chunk.sampleRate;
  };

  const push = (chunk: ILanRemoteAudioChunk) => {
    if (isClosed) {
      return;
    }
    let queue = queues.get(chunk.peerId);
    if (!queue) {
      queue = {
        bufferedSeconds: 0,
        pending: [],
        scheduled: new Set<AudioBufferSourceNode>(),
      };
      queues.set(chunk.peerId, queue);
    }
    if (queue.nextTime === undefined) {
      queue.pending.push(chunk);
      queue.bufferedSeconds += chunk.frames / chunk.sampleRate;
      if (queue.bufferedSeconds < INITIAL_BUFFER_SECONDS) {
        return;
      }
      queue.pending.forEach((pending) =>
        schedule(queue as IPeerQueue, pending),
      );
      queue.pending = [];
    } else {
      schedule(queue, chunk);
    }
    startPlayback().catch(() => onPlaybackBlocked());
  };

  const removePeer = (peerId: string) => {
    const queue = queues.get(peerId);
    if (!queue) {
      return;
    }
    queue.scheduled.forEach((source) => {
      try {
        source.stop();
      } catch {
        // Already ended between reading the set and stopping the source.
      }
      source.disconnect();
    });
    queue.pending = [];
    queues.delete(peerId);
  };

  return {
    push,
    removePeer,
    resume: async () => {
      playbackStarted = false;
      await startPlayback();
    },
    setOutput: async (sinkId: string) => {
      currentSinkId = sinkId;
      if (sink.setSinkId) {
        await sink.setSinkId(sinkId);
      }
    },
    close: async () => {
      if (isClosed) {
        return;
      }
      isClosed = true;
      [...queues.keys()].forEach(removePeer);
      sink.pause();
      sink.srcObject = null;
      destination.stream.getTracks().forEach((track) => track.stop());
      await context.close();
    },
  };
};
