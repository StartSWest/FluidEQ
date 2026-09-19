/* FluidEQ — GPL-3.0-or-later */

import { spawn } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import type { ILanRemoteAudioChunk } from '../common/remoteAudio';
import type { IRemotePlaybackMeter } from '../common/remoteAudioPlayback';
import {
  playbackCommand,
  PlaybackReplyReader,
} from './nativeRemoteAudioPlaybackProtocol';

export interface INativeRemoteAudioPlayback {
  push(chunk: ILanRemoteAudioChunk): void;
  remove(peerId: string): void;
  reset(): void;
  setVolume(volume: number): void;
  setOutput(guid: string): Promise<void>;
  close(): Promise<void>;
}

export const findRemoteAudioPlaybackExecutable = (): string | undefined => {
  const resources = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;
  const name = 'FluidEQ-LAN-Playback.exe';
  return [
    ...(resources ? [path.join(resources, 'native', name)] : []),
    path.join(__dirname, '../../../native/.build/bin', name),
    path.join(__dirname, '../../native/.build/bin', name),
  ].find((candidate) => existsSync(candidate));
};

const outputGuid = (value: string): string => {
  if (value === '' || value === 'default') {
    return '';
  }
  if (
    !/^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/i.test(
      value,
    )
  ) {
    throw new Error('Invalid native playback output.');
  }
  return value;
};

export const startNativeRemoteAudioPlayback = (
  onMeter: (meter: IRemotePlaybackMeter) => void,
  onFailure: () => void,
): Promise<INativeRemoteAudioPlayback> => {
  const executable = findRemoteAudioPlaybackExecutable();
  if (!executable) {
    return Promise.reject(
      new Error('Native shared-audio playback is unavailable.'),
    );
  }
  const child = spawn(executable, ['--parent-pid', String(process.pid)], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  return new Promise((resolve, reject) => {
    const peers = new Map<string, { id: number; waveform: Float32Array }>();
    const requests = new Map<
      number,
      { resolve(): void; reject(error: Error): void }
    >();
    const reader = new PlaybackReplyReader();
    let ready = false;
    let closed = false;
    let failed = false;
    let requestId = 0;
    let stderr = '';
    let closing: Promise<void> | undefined;

    const fail = (error: Error) => {
      if (closed || failed) {
        return;
      }
      failed = true;
      requests.forEach((request) => request.reject(error));
      requests.clear();
      if (ready) {
        onFailure();
      } else {
        reject(error);
      }
      child.kill();
    };
    const write = (packet: Buffer) => {
      if (closed || failed) {
        throw new Error('Native playback has stopped.');
      }
      // A stalled child must not turn a short network burst into minutes of
      // stale sound. The audio-device thread consumes a separate bounded queue.
      if (child.stdin.writableLength + packet.byteLength > 1_048_576) {
        const error = new Error('Native playback input is overloaded.');
        fail(error);
        throw error;
      }
      child.stdin.write(packet);
    };
    const player: INativeRemoteAudioPlayback = {
      push: (chunk) => {
        let peer = peers.get(chunk.peerId);
        if (!peer) {
          const used = new Set([...peers.values()].map((entry) => entry.id));
          const id = Array.from({ length: 8 }, (_, index) => index + 1).find(
            (candidate) => !used.has(candidate),
          );
          if (id === undefined) {
            throw new Error('Too many shared-audio sources.');
          }
          peer = { id, waveform: new Float32Array(64) };
          peers.set(chunk.peerId, peer);
        }
        peer.waveform.fill(0);
        const samples = new Float32Array(chunk.pcm);
        for (let frame = 0; frame < chunk.frames; frame += 1) {
          const point = Math.floor((frame * 64) / chunk.frames);
          const sample = samples[frame * chunk.channels];
          if (
            Number.isFinite(sample) &&
            Math.abs(sample) > Math.abs(peer.waveform[point])
          ) {
            peer.waveform[point] = sample;
          }
        }
        const sequence = Buffer.alloc(4);
        sequence.writeUInt32LE(chunk.sequence);
        write(
          playbackCommand(
            2,
            peer.id,
            Buffer.concat([sequence, Buffer.from(chunk.pcm)]),
            chunk.sampleRate,
            chunk.channels,
            chunk.frames,
          ),
        );
      },
      remove: (peerId) => {
        const peer = peers.get(peerId);
        if (peer) {
          write(playbackCommand(3, peer.id));
          peers.delete(peerId);
        }
      },
      reset: () => {
        write(playbackCommand(5));
        peers.clear();
      },
      setVolume: (volume) => {
        if (!Number.isFinite(volume) || volume < 0 || volume > 1) {
          throw new Error('Invalid shared-audio volume.');
        }
        const value = Buffer.alloc(4);
        value.writeFloatLE(volume);
        write(playbackCommand(4, 0, value));
      },
      setOutput: (guid) => {
        const name = outputGuid(guid);
        requestId = requestId === 0xffff_ffff ? 1 : requestId + 1;
        const id = requestId;
        return new Promise<void>((resolve, reject) => {
          requests.set(id, { resolve, reject });
          try {
            write(playbackCommand(1, id, Buffer.from(name, 'utf8')));
          } catch (error) {
            requests.delete(id);
            reject(error);
          }
        });
      },
      close: () => {
        if (closing) {
          return closing;
        }
        closed = true;
        requests.forEach((request) =>
          request.reject(new Error('Playback closed.')),
        );
        requests.clear();
        peers.clear();
        closing = new Promise<void>((resolve) => {
          if (child.exitCode !== null || child.signalCode !== null) {
            resolve();
          } else {
            child.once('close', () => resolve());
            child.kill();
          }
        });
        return closing;
      },
    };
    child.stdin.on('error', fail);
    child.once('error', fail);
    child.stderr.on('data', (bytes: Buffer) => {
      stderr = (stderr + bytes.toString('utf8')).slice(-4_096);
    });
    child.once('close', () =>
      fail(new Error(stderr.trim() || 'Native playback stopped.')),
    );
    child.stdout.on('data', (bytes: Buffer) => {
      if (closed || failed) {
        return;
      }
      try {
        reader.push(bytes, (reply) => {
          if (reply.kind === 1 && !ready && reply.payload.byteLength === 0) {
            ready = true;
            resolve(player);
          } else if (
            ready &&
            reply.kind === 3 &&
            reply.payload.byteLength === 0
          ) {
            const request = requests.get(reply.id);
            requests.delete(reply.id);
            if (reply.rate >= 0x8000_0000) {
              request?.reject(
                new Error(
                  `Output refused playback (0x${reply.rate.toString(16)}).`,
                ),
              );
            } else {
              request?.resolve();
            }
          } else if (
            ready &&
            reply.kind === 5 &&
            reply.payload.byteLength === 24
          ) {
            const found = [...peers.entries()].find(
              ([, peer]) => peer.id === reply.id,
            );
            const bufferedMs = reply.payload.readDoubleLE(0);
            const peak = reply.payload.readDoubleLE(8);
            const rms = reply.payload.readDoubleLE(16);
            if (
              found &&
              [bufferedMs, peak, rms].every(
                (value) => Number.isFinite(value) && value >= 0,
              )
            ) {
              onMeter({
                sourceId: found[0],
                bufferedMs,
                peak,
                rms,
                waveform: new Float32Array(found[1].waveform),
              });
            }
          } else if (
            ready &&
            reply.kind === 6 &&
            reply.payload.byteLength === 8
          ) {
            // Device-buffer telemetry is distinct from the processing delay.
            // It is intentionally not presented as measured acoustic latency.
          } else {
            throw new Error(
              'Native playback returned an invalid or failed reply.',
            );
          }
        });
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new Error('Invalid playback response.'),
        );
      }
    });
  });
};
