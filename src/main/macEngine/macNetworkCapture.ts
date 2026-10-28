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
interface IMacCaptureProcess extends INativeCaptureProcess {
  close(): Promise<void>;
}

interface ICaptureCommands {
  start: number;
  stop: number;
  audio: number;
  payload?: Buffer;
}

const startMacCapture = async (
  commands: ICaptureCommands,
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
): Promise<IMacCaptureProcess> => {
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
      if (reply.kind === commands.stop && reply.id === captureId) {
        fail(new Error('The Mac system audio tap stopped.'));
      } else if (
        reply.kind === commands.audio &&
        reply.channels !== undefined
      ) {
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
    const request = lease.request(commands.start, commands.payload);
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
  let closing: Promise<void> | undefined;
  return {
    command: () => {
      throw new Error('This capture does not provide Windows output mirrors.');
    },
    close: () => {
      if (closing) {
        return closing;
      }
      if (closed) {
        return Promise.resolve();
      }
      closed = true;
      closing = activeLease
        .request(commands.stop)
        .answered.catch(() => undefined)
        .finally(activeLease.release);
      return closing;
    },
  };
};

export const startMacNetworkCapture = (
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
): Promise<INativeCaptureProcess> =>
  startMacCapture(
    { start: 8, stop: 9, audio: 10, payload: Buffer.from('lan') },
    onAudio,
    onFailure,
  );

/** Its own tap: closing the analyser never stops outgoing Share Audio. */
export const startMacMonitorCapture = (
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
): Promise<IMacCaptureProcess> =>
  startMacCapture({ start: 11, stop: 12, audio: 11 }, onAudio, onFailure);
