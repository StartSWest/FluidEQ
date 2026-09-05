/* FluidEQ — GPL-3.0-or-later */
import log from 'electron-log';
import type { ILanRemoteAudioChunk } from '../common/remoteAudio';
import {
  startNativeCaptureProcess,
  type INativeCaptureProcess,
} from './nativeCaptureProcess';

export interface IRemoteAudioCapture {
  close(): void;
}
interface IClient {
  audio?: (chunk: ILanRemoteAudioChunk) => void;
  failure(): void;
}
interface ISession {
  clients: Set<IClient>;
  mirrors: Map<number, () => void>;
  requests: Map<number, { resolve(): void; reject(error: Error): void }>;
  opening?: Promise<INativeCaptureProcess>;
  process?: INativeCaptureProcess;
}
let session: ISession | undefined;
let nextId = 0;
const allocateId = () => {
  nextId = nextId === 0xffff_ffff ? 1 : nextId + 1;
  return nextId;
};

const failSession = (current: ISession) => {
  if (session === current) {
    session = undefined;
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

const acquire = (client: IClient) => {
  session ??= { clients: new Set(), mirrors: new Map(), requests: new Map() };
  const current = session;
  current.clients.add(client);
  current.opening ??= startNativeCaptureProcess(
    'system',
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
      if (session === current) {
        session = undefined;
      }
    }
  };
  return { current, ready: current.opening, close };
};

/** LAN and every mirror share one excluded process, or LAN would recapture
 * the mirrors. Closing either feature releases only its own lease. */
export const startRemoteAudioCapture = async (
  peerId: string,
  onAudio: (chunk: ILanRemoteAudioChunk) => void,
  onFailure: () => void,
): Promise<IRemoteAudioCapture> => {
  const lease = acquire({
    audio: (chunk) => onAudio({ ...chunk, peerId }),
    failure: onFailure,
  });
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

export const startNativeOutputMirror = async (
  guid: string,
  mode: 'music' | 'video',
  volume: number,
  onFailure: () => void,
): Promise<INativeOutputMirror> => {
  const lease = acquire({ failure: onFailure });
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
