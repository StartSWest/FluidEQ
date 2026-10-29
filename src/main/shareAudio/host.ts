/* FluidEQ — GPL-3.0-or-later */
import fs from 'fs';
import path from 'path';
import { isMainThread, Worker } from 'worker_threads';
import { createAudioProcess } from './processHost';
import type {
  IAudioMethods,
  TAudioEvent,
  TAudioMethod,
  TAudioRequest,
  TAudioResponse,
} from './protocol';

export interface IAudioWorkerTransport {
  on(event: 'message', listener: (message: TAudioResponse) => void): unknown;
  on(event: 'error', listener: (error: Error) => void): unknown;
  on(event: 'exit', listener: (code: number) => void): unknown;
  postMessage(message: unknown): void;
  ref(): void;
  unref(): void;
  terminate(): Promise<number>;
}
export const createAudioWorkerHost = (
  entry: string,
  resourcesPath?: string,
  spawn: (entry: string, resourcesPath?: string) => IAudioWorkerTransport = (
    file,
    resources,
  ) => new Worker(file, { workerData: { resourcesPath: resources } }),
) => {
  const worker = spawn(entry, resourcesPath);
  const pending = new Map<
    number,
    {
      method: TAudioMethod;
      resolve(value: unknown): void;
      reject(error: Error): void;
    }
  >();
  const listeners = new Set<(event: TAudioEvent) => void>();
  const failures = new Set<() => void>();
  let nextId = 0;
  let ended = false;
  let helperPid: number | undefined;
  const stop = () => {
    if (ended) {
      return;
    }
    ended = true;
    pending.forEach(({ reject }) =>
      reject(new Error('Share Audio worker stopped.')),
    );
    pending.clear();
    const clients = [...failures];
    failures.clear();
    listeners.clear();
    clients.forEach((failed) => {
      try {
        failed();
      } catch {
        /* A failed consumer cannot prevent worker cleanup. */
      }
    });
    worker.terminate().catch(() => undefined);
  };
  worker.on('error', stop);
  worker.on('exit', stop);
  worker.on('message', (message: TAudioResponse) => {
    if (ended) {
      return;
    }
    if (message.type === 'answer') {
      const request = pending.get(message.id);
      pending.delete(message.id);
      if (pending.size === 0) {
        worker.unref();
      }
      if (message.error) {
        // The failure as main knew it before the link moved out of it: the
        // system's code on the error, which the port fallback reads, and the
        // step and code in its text, where the log said "operation failed".
        const { code, syscall } = message;
        const system = [code, syscall].filter(Boolean).join(' ');
        const detail = [request?.method, system && `(${system})`]
          .filter(Boolean)
          .join(' ');
        request?.reject(
          Object.assign(
            new Error(detail ? `${message.error} ${detail}` : message.error),
            code ? { code } : {},
            syscall ? { syscall } : {},
          ),
        );
      } else {
        request?.resolve(message.value);
      }
    } else {
      if (message.event.type === 'helper-pid') {
        helperPid = message.event.pid;
      }
      try {
        [...listeners].forEach((listener) => listener(message.event));
      } catch {
        // A failed persistence/control callback cannot leave an unowned link
        // running with state that the next launch will not remember.
        stop();
      } finally {
        if (!ended && message.credit) {
          try {
            worker.postMessage({ type: 'credit', key: message.credit });
          } catch {
            stop();
          }
        }
      }
    }
  });
  worker.unref();
  return {
    helperPid: () => helperPid,
    request<K extends TAudioMethod>(
      method: K,
      ...args: IAudioMethods[K]['args']
    ): Promise<IAudioMethods[K]['result']> {
      if (ended) {
        return Promise.reject(new Error('Share Audio worker stopped.'));
      }
      if (pending.size >= 128) {
        return Promise.reject(new Error('Share Audio control queue is full.'));
      }
      nextId += 1;
      const id = nextId;
      worker.ref();
      return new Promise<IAudioMethods[K]['result']>((resolve, reject) => {
        pending.set(id, {
          method,
          resolve: (value) => resolve(value as IAudioMethods[K]['result']),
          reject,
        });
        try {
          worker.postMessage({
            type: 'request',
            id,
            method,
            args,
          } as TAudioRequest);
        } catch {
          pending.delete(id);
          reject(new Error('Share Audio control could not be sent.'));
          stop();
        }
      });
    },
    listen(listener: (event: TAudioEvent) => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    onFailure(listener: () => void) {
      failures.add(listener);
      return () => {
        failures.delete(listener);
      };
    },
    stop,
  };
};
export type TAudioWorkerHost = ReturnType<typeof createAudioWorkerHost>;
let enabled = false;
let decided = false;
let current: TAudioWorkerHost | undefined;
const workerListeners = new Set<(event: TAudioEvent) => void>();
export const listenAudioWorker = (listener: (event: TAudioEvent) => void) => {
  workerListeners.add(listener);
  return () => {
    workerListeners.delete(listener);
  };
};
export const audioWorkerHelperPid = () => current?.helperPid();

// Set by Electron's IPC registration. Node fixtures and platform branches keep
// using their existing adapters until they explicitly enable this owner.
const workerEntry = (): string | undefined =>
  [
    path.join(__dirname, 'share-audio-worker.js'),
    path.join(__dirname, '../../../.erb/dll/share-audio-worker.js'),
    path.join(__dirname, '../share-audio-worker.js'),
  ].find((candidate) => fs.existsSync(candidate));

export const enableAudioWorker = () => {
  if (!isMainThread || decided) {
    return;
  }
  decided = true;
  // A running dev compiler may predate a new entry. Until its bundle exists,
  // retain the working audio path; source hot reload must never disable LAN.
  enabled = workerEntry() !== undefined;
};
export const audioWorkerEnabled = () => enabled && isMainThread;
export const stopAudioWorker = () => {
  current?.stop();
  current = undefined;
  enabled = false;
  decided = false;
};
export const getAudioWorker = (): TAudioWorkerHost => {
  if (!current) {
    const entry = workerEntry();
    if (!entry) {
      throw new Error('Share Audio worker is unavailable.');
    }
    const resources = (process as NodeJS.Process & { resourcesPath?: string })
      .resourcesPath;
    current = createAudioWorkerHost(entry, resources, createAudioProcess);
    current.listen((event) =>
      workerListeners.forEach((listener) => listener(event)),
    );
    current.onFailure(() => {
      current = undefined;
    });
  }
  return current;
};
