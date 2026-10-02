/* FluidEQ — GPL-3.0-or-later */

import type { ILanRemoteAudioChunk } from '../common/remoteAudio';
import type { IRemotePlaybackMeter } from '../common/remoteAudioPlayback';
import { type ILanAudioLease, leaseLanAudioHelper } from './lanAudioHelper';
import { playbackCommand } from './nativeRemoteAudioPlaybackProtocol';

export interface INativeRemoteAudioPlayback {
  push(chunk: ILanRemoteAudioChunk): void;
  remove(peerId: string): void;
  reset(): void;
  setVolume(volume: number): void;
  setOutput(guid: string): Promise<void>;
  close(): Promise<void>;
}

export { findRemoteAudioPlaybackExecutable } from './lanAudioHelper';

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

/**
 * The sound other computers share with this one, played on a lease of the
 * LAN audio helper (`lanAudioHelper.ts`).
 *
 * Closing gives the output device back and the lease with it; the helper
 * itself may well carry on, because a capture holds it too. A device that
 * fails mid-song is the same failure as before — the receiver offers Resume —
 * but no longer the end of the process, so the captures under it, the second
 * output's among them, never stop with it.
 */
export const startNativeRemoteAudioPlayback = async (
  onMeter: (meter: IRemotePlaybackMeter) => void,
  onFailure: () => void,
): Promise<INativeRemoteAudioPlayback> => {
  const peers = new Map<string, { id: number; waveform: Float32Array }>();
  let closed = false;
  let failed = false;
  let closing: Promise<void> | undefined;
  const fail = () => {
    if (closed || failed) {
      return;
    }
    failed = true;
    onFailure();
  };
  const lease: ILanAudioLease = await leaseLanAudioHelper({
    reply: (reply) => {
      if (closed || failed) {
        return;
      }
      if (reply.kind === 4 && reply.id === 0) {
        fail();
        return;
      }
      if (reply.kind !== 5 || reply.payload.byteLength !== 24) {
        return;
      }
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
    },
    stopped: fail,
  });
  const write = (packet: Buffer) => {
    if (closed || failed) {
      throw new Error('Native playback has stopped.');
    }
    lease.send(packet);
  };
  // Whatever an earlier receiver left in the helper is not this one's.
  write(playbackCommand(5));
  return {
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
      if (closed || failed) {
        return Promise.reject(new Error('Native playback has stopped.'));
      }
      const name = outputGuid(guid);
      return lease.request(1, Buffer.from(name, 'utf8')).answered;
    },
    close: () => {
      if (closing) {
        return closing;
      }
      closed = true;
      peers.clear();
      const giveBack = async () => {
        try {
          lease.send(playbackCommand(5));
          await lease.request(7).answered;
        } catch {
          // The helper has gone: there is no device left to give back.
        } finally {
          lease.release();
        }
      };
      closing = giveBack();
      return closing;
    },
  };
};
