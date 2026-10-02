/* FluidEQ — GPL-3.0-or-later */
import log from 'electron-log';
import type { ILanRemoteAudioChunk } from '../common/remoteAudio';
import {
  startNativeCaptureProcess,
  type INativeCaptureProcess,
  type TCaptureMode,
} from './nativeCaptureProcess';

export interface IRemoteAudioCapture {
  close(): void;
}
interface IClient {
  audio?: (chunk: ILanRemoteAudioChunk) => void;
  failure(): void;
}
interface ISession {
  mode: TCaptureMode;
  clients: Set<IClient>;
  mirrors: Map<number, () => void>;
  requests: Map<number, { resolve(): void; reject(error: Error): void }>;
  opening?: Promise<INativeCaptureProcess>;
  process?: INativeCaptureProcess;
}
const sessions = new Map<TCaptureMode, ISession>();
let nextId = 0;
const allocateId = () => {
  nextId = nextId === 0xffff_ffff ? 1 : nextId + 1;
  return nextId;
};

const failSession = (current: ISession) => {
  if (sessions.get(current.mode) === current) {
    sessions.delete(current.mode);
  }
  current.process?.close();
  const error = new Error('The system audio capture stopped.');
  current.requests.forEach((request) => request.reject(error));
  current.requests.clear();
  const clients = [...current.clients];
  current.clients.clear();
  current.mirrors.clear();
  clients.forEach((client) => client.failure());
};

const acquire = (mode: TCaptureMode, client: IClient) => {
  const current: ISession = sessions.get(mode) ?? {
    mode,
    clients: new Set(),
    mirrors: new Map(),
    requests: new Map(),
  };
  sessions.set(mode, current);
  current.clients.add(client);
  current.opening ??= startNativeCaptureProcess(
    mode,
    (chunk) =>
      current.clients.forEach((subscriber) => subscriber.audio?.(chunk)),
    () => failSession(current),
    (kind, id, result) => {
      if (kind === 4) {
        current.mirrors.get(id)?.();
        current.mirrors.delete(id);
        return;
      }
      const request = current.requests.get(id);
      current.requests.delete(id);
      if (result >= 0x8000_0000) {
        request?.reject(
          new Error(
            `Windows could not open or update the second output (0x${result.toString(16)}).`,
          ),
        );
      } else {
        request?.resolve();
      }
    },
  ).then((process) => {
    current.process = process;
    if (current.clients.size === 0) {
      process.close();
    }
    return process;
  });
  const close = () => {
    current.clients.delete(client);
    if (current.clients.size === 0) {
      current.process?.close();
      if (sessions.get(mode) === current) {
        sessions.delete(mode);
      }
    }
  };
  return { current, ready: current.opening, close };
};

/**
 * This computer's sound for the network: everything it plays, and none of
 * what other computers send it or the second output mirrors — that is the
 * `lan` capture, which leaves the LAN audio helper's whole tree out. Shared
 * by every computer this one sends to; chunks carry no peer, the link
 * addresses each copy.
 */
export const startNetworkCapture = async (
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
): Promise<IRemoteAudioCapture> => {
  const lease = acquire('lan', { audio: onAudio, failure: onFailure });
  try {
    await lease.ready;
    return { close: lease.close };
  } catch (error) {
    lease.close();
    throw error;
  }
};

/**
 * The sound before FluidEQ touches it, for Smart EQ to measure.
 *
 * The same kind of process loopback the network's capture uses, and for the
 * same reason it exists there: Windows hands a process loopback the mix
 * BEFORE the endpoint's effects, so neither Equalizer APO nor the FluidEQ
 * Engine is in it. Measured on 2026-09-22 against the ordinary endpoint
 * loopback taken at the same moment, with the engine's whole rack running:
 * the two differed by the rack's own colouring, three to five decibels across
 * the band, and the endpoint peaked two decibels hotter — the process
 * loopback carried none of it. That is what makes a Smart EQ correction a
 * statement about the record rather than about whatever was already applied
 * to it.
 *
 * A lease on the `local` capture, the second output's, so it hears what other
 * computers share with this one too: that is part of what is playing here.
 * Chunks go to the window's `source` port and nowhere else. The Library keeps
 * its rack — `setDspHostRawSharing` is deliberately NOT asked for, because
 * putting the Library into pass-through to measure it would change what is
 * heard here for as long as the measurement ran; the Library's own input tap
 * is how the measurement hears that source instead (`rawSource.ts`).
 */
export const startRawSourceCapture = async (
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
): Promise<IRemoteAudioCapture> => {
  const lease = acquire('local', { audio: onAudio, failure: onFailure });
  try {
    await lease.ready;
    return { close: lease.close };
  } catch (error) {
    lease.close();
    throw error;
  }
};

export interface INativeOutputMirror extends IRemoteAudioCapture {
  close(): Promise<void>;
  setVolume(volume: number): Promise<void>;
}

/**
 * The second output: this computer's sound, the sound other computers share
 * with it included, played on another device. Rendered by the `local`
 * capture itself, which leaves itself out, so a mirror is never heard twice;
 * the network's capture leaves this one's tree out with it.
 */
export const startNativeOutputMirror = async (
  guid: string,
  mode: 'music' | 'video',
  volume: number,
  onFailure: () => void,
): Promise<INativeOutputMirror> => {
  const lease = acquire('local', { failure: onFailure });
  const id = allocateId();
  const { current } = lease;
  let closed = false;
  let closing: Promise<void> | undefined;
  const command = async (kind: string, args = '') => {
    const process = await lease.ready;
    return new Promise<void>((resolve, reject) => {
      const requestId = allocateId();
      current.requests.set(requestId, { resolve, reject });
      try {
        process.command(`${kind} ${requestId} ${id}${args ? ` ${args}` : ''}`);
      } catch (error) {
        current.requests.delete(requestId);
        reject(error);
      }
    });
  };
  try {
    current.mirrors.set(id, onFailure);
    await command('start', `${guid} ${mode} ${volume}`);
    return {
      setVolume: (value) =>
        closed ? Promise.resolve() : command('volume', String(value)),
      close: () => {
        if (closing) {
          return closing;
        }
        closed = true;
        current.mirrors.delete(id);
        closing = command('stop')
          .catch((error: unknown) => {
            log.error('Could not stop the second output', error);
            // A failed stop must never leave an unowned speaker playing.
            failSession(current);
          })
          .finally(lease.close);
        return closing;
      },
    };
  } catch (error) {
    current.mirrors.delete(id);
    lease.close();
    throw error;
  }
};
