/* FluidEQ — GPL-3.0-or-later */

import { spawn } from 'child_process';
import type { ChildProcessWithoutNullStreams } from 'child_process';
import { existsSync } from 'fs';
import path from 'path';
import {
  type IPlaybackReply,
  playbackCommand,
  PlaybackReplyReader,
} from './nativeRemoteAudioPlaybackProtocol';

/**
 * FluidEQ-LAN-Playback, as one process every part of LAN audio shares.
 *
 * It plays what other computers share with this one, and it is the PARENT of
 * every capture helper: the second output's (`local`) and the network's
 * (`lan`). That is the whole of Share Audio both ways' echo guard. Windows
 * can leave one process tree out of a process loopback, so the network's
 * capture leaves this one's out — the sound received here and the second
 * output's mirrors with it — and a computer's own sound never travels back to
 * it. The second output's capture leaves only itself out and still hears
 * the received sound, as it always did. `echo_tree_test.cpp` holds both on
 * the real helpers.
 *
 * So the process lives while anything holds a lease — playback or either
 * capture — and is started by whichever asks first. A lease is void when
 * the process ends (`stopped`); a capture dies with it, because the helper
 * keeps its children in a job that ends them.
 *
 * Commands that answer (1 open output, 7 close output, 8 start a capture)
 * are `request`s, each under an id of its own; the rest are `send`s. Replies
 * nobody asked for go to every client: meters (5), the output failing (4 with
 * id 0 — the helper gives the device back and carries on) and a capture
 * ending (9, under the id it was started with).
 */

export interface ILanAudioClient {
  reply?(reply: IPlaybackReply): void;
  stopped(error: Error): void;
}

export interface ILanAudioLease {
  request(
    kind: number,
    payload?: Buffer,
  ): { id: number; answered: Promise<void> };
  send(packet: Buffer): void;
  release(): void;
}

const MAX_QUEUED_BYTES = 1_048_576;
const MAX_STDERR_BYTES = 4_096;
const HELPER_NAME = 'FluidEQ-LAN-Playback.exe';

export const findRemoteAudioPlaybackExecutable = (): string | undefined => {
  const resources = (process as NodeJS.Process & { resourcesPath?: string })
    .resourcesPath;
  return [
    ...(resources ? [path.join(resources, 'native', HELPER_NAME)] : []),
    path.join(__dirname, '../../../native/.build/bin', HELPER_NAME),
    path.join(__dirname, '../../native/.build/bin', HELPER_NAME),
  ].find((candidate) => existsSync(candidate));
};

interface IHelper {
  child: ChildProcessWithoutNullStreams;
  clients: Set<ILanAudioClient>;
  ready: Promise<void>;
  requests: Map<number, { resolve(): void; reject(error: Error): void }>;
  nextId: number;
  ended: boolean;
}

let current: IHelper | undefined;

const end = (helper: IHelper, error: Error) => {
  if (helper.ended) {
    return;
  }
  helper.ended = true;
  if (current === helper) {
    current = undefined;
  }
  helper.requests.forEach((request) => request.reject(error));
  helper.requests.clear();
  const clients = [...helper.clients];
  helper.clients.clear();
  clients.forEach((client) => client.stopped(error));
  helper.child.kill();
};

const write = (helper: IHelper, packet: Buffer) => {
  if (helper.ended) {
    throw new Error('The LAN audio helper has stopped.');
  }
  // A stalled helper must not turn a short network burst into minutes of
  // stale sound; its own audio thread reads a separate bounded queue.
  if (
    helper.child.stdin.writableLength + packet.byteLength >
    MAX_QUEUED_BYTES
  ) {
    const error = new Error('The LAN audio helper is overloaded.');
    end(helper, error);
    throw error;
  }
  helper.child.stdin.write(packet);
};

const start = (): IHelper => {
  const executable = findRemoteAudioPlaybackExecutable();
  if (!executable) {
    throw new Error('The LAN audio helper is unavailable.');
  }
  const child = spawn(executable, ['--parent-pid', String(process.pid)], {
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let markReady: () => void = () => undefined;
  let refuse: (error: Error) => void = () => undefined;
  const helper: IHelper = {
    child,
    clients: new Set(),
    ready: new Promise<void>((resolve, reject) => {
      markReady = resolve;
      refuse = reject;
    }),
    requests: new Map(),
    nextId: 0,
    ended: false,
  };
  // Settled either way before anyone awaits it; a refusal is also an `end`.
  helper.ready.catch(() => undefined);
  let isReady = false;
  let stderr = '';
  const reader = new PlaybackReplyReader();
  const stop = (error: Error) => {
    if (!isReady) {
      refuse(error);
    }
    end(helper, error);
  };
  child.stdin.on('error', stop);
  child.once('error', stop);
  child.stderr.on('data', (bytes: Buffer) => {
    stderr = (stderr + bytes.toString('utf8')).slice(-MAX_STDERR_BYTES);
  });
  child.once('close', () =>
    stop(new Error(stderr.trim() || 'The LAN audio helper stopped.')),
  );
  child.stdout.on('data', (bytes: Buffer) => {
    if (helper.ended) {
      return;
    }
    try {
      reader.push(bytes, (reply) => {
        if (reply.kind === 1 && !isReady && reply.payload.byteLength === 0) {
          isReady = true;
          markReady();
          return;
        }
        if (!isReady) {
          throw new Error('The LAN audio helper answered before it was ready.');
        }
        if (reply.kind === 3 && reply.payload.byteLength === 0) {
          const request = helper.requests.get(reply.id);
          helper.requests.delete(reply.id);
          if (reply.rate >= 0x8000_0000) {
            request?.reject(
              new Error(
                `The LAN audio helper refused (0x${reply.rate.toString(16)}).`,
              ),
            );
          } else {
            request?.resolve();
          }
          return;
        }
        if (reply.kind === 4 && reply.id !== 0) {
          // A command it could not take: the helper ends after this reply.
          throw new Error('The LAN audio helper refused a command.');
        }
        helper.clients.forEach((client) => client.reply?.(reply));
      });
    } catch (error) {
      stop(
        error instanceof Error
          ? error
          : new Error('The LAN audio helper sent an invalid reply.'),
      );
    }
  });
  return helper;
};

const release = (helper: IHelper, client: ILanAudioClient) => {
  if (!helper.clients.delete(client) || helper.clients.size > 0) {
    return;
  }
  // The last lease: let the helper finish on its own end of the pipe. A
  // lease taken from here on starts a new one, and this one's captures end
  // with it.
  helper.ended = true;
  if (current === helper) {
    current = undefined;
  }
  helper.requests.forEach((request) =>
    request.reject(new Error('The LAN audio helper was released.')),
  );
  helper.requests.clear();
  try {
    helper.child.stdin.end(playbackCommand(6));
  } catch {
    helper.child.kill();
  }
};

/** The helper's process id while it runs, for the Processes list. */
export const lanAudioHelperPid = (): number | undefined =>
  current && !current.ended ? current.child.pid : undefined;

export const leaseLanAudioHelper = async (
  client: ILanAudioClient,
): Promise<ILanAudioLease> => {
  current ??= start();
  const helper = current;
  helper.clients.add(client);
  try {
    await helper.ready;
  } catch (error) {
    helper.clients.delete(client);
    throw error;
  }
  if (helper.ended || !helper.clients.has(client)) {
    throw new Error('The LAN audio helper has stopped.');
  }
  let released = false;
  return {
    request: (kind, payload) => {
      helper.nextId = helper.nextId === 0xffff_ffff ? 1 : helper.nextId + 1;
      const id = helper.nextId;
      const answered = new Promise<void>((resolve, reject) => {
        helper.requests.set(id, { resolve, reject });
        try {
          write(helper, playbackCommand(kind, id, payload));
        } catch (error) {
          helper.requests.delete(id);
          reject(error);
        }
      });
      return { id, answered };
    },
    send: (packet) => write(helper, packet),
    release: () => {
      if (!released) {
        released = true;
        release(helper, client);
      }
    },
  };
};
