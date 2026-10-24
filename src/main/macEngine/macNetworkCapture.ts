/* FluidEQ — GPL-3.0-or-later */
import log from 'electron-log';
import type { ILanRemoteAudioChunk } from '../../common/remoteAudio';
import { leaseLanAudioHelper, type ILanAudioLease } from '../lanAudioHelper';
import type { INativeCaptureProcess } from '../nativeCaptureProcess';

/**
 * The Mac helper owns both LAN playback and its unmuted Core Audio tap.
 * The tap excludes that process, plus the system engine's processed output:
 * received sound never goes back out and the other computer gets raw audio.
 */
export const startMacNetworkCapture = async (
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
): Promise<INativeCaptureProcess> => {
  let lease: ILanAudioLease | undefined;
  let closed = false;
  let ready = false;
  let captureId = 0;
  const fail = (error: Error) => {
    if (closed) {
      return;
    }
    closed = true;
    log.warn(`Share Audio capture stopped: ${error.message}`);
    lease?.release();
    if (ready) {
      onFailure();
    }
  };
  lease = await leaseLanAudioHelper({
    reply: (reply) => {
      if (closed) {
        return;
      }
      if (reply.kind === 9 && reply.id === captureId) {
        fail(new Error('The Mac system audio tap stopped.'));
      } else if (reply.kind === 10 && reply.channels !== undefined) {
        onAudio({
          channels: reply.channels,
          frames: reply.frames,
          pcm: Uint8Array.from(reply.payload).buffer,
          peerId: '',
          sampleRate: reply.rate,
          sequence: reply.id,
        });
      }
    },
    stopped: fail,
  });
  try {
    const request = lease.request(8, Buffer.from('lan'));
    captureId = request.id;
    await request.answered;
    if (closed) {
      throw new Error('The Mac system audio tap stopped while opening.');
    }
    ready = true;
  } catch (error) {
    closed = true;
    lease.release();
    throw error;
  }
  const activeLease = lease;
  return {
    command: () => {
      throw new Error('This capture does not provide Windows output mirrors.');
    },
    close: () => {
      if (closed) {
        return;
      }
      closed = true;
      activeLease
        .request(9)
        .answered.catch(() => undefined)
        .finally(activeLease.release);
    },
  };
};
