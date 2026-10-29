/* FluidEQ — GPL-3.0-or-later */
import { EventEmitter } from 'events';
import fs from 'fs';
import {
  createAudioWorkerHost,
  enableAudioWorker,
  audioWorkerEnabled,
  stopAudioWorker,
} from '../../../main/shareAudio/host';
import startRemoteAudioHostSession from '../../../main/remoteAudioHostSession';
import type { IRemoteAudioCredentialStore } from '../../../main/remoteAudioCredentials';
import type { IRemoteAudioLan } from '../../../main/remoteAudioLanTypes';

const mockWorkers: EventEmitter[] = [];
jest.mock('worker_threads', () => ({
  isMainThread: true,
  Worker: jest.fn().mockImplementation(() => {
    const { EventEmitter: MockEvents } =
      jest.requireActual<typeof import('events')>('events');
    const worker = Object.assign(new MockEvents(), {
      postMessage: jest.fn(),
      terminate: jest.fn(async () => 0),
      unref: jest.fn(),
      ref: jest.fn(),
    });
    mockWorkers.push(worker);
    return worker;
  }),
}));

afterEach(() => {
  stopAudioWorker();
  jest.restoreAllMocks();
  mockWorkers.length = 0;
});

it('retains the working connection path when a running dev compiler has no worker bundle', () => {
  jest.spyOn(fs, 'existsSync').mockReturnValue(false);
  enableAudioWorker();
  expect(audioWorkerEnabled()).toBe(false);
  jest.spyOn(fs, 'existsSync').mockReturnValue(true);
  enableAudioWorker();
  expect(audioWorkerEnabled()).toBe(false);
  stopAudioWorker();
  enableAudioWorker();
  expect(audioWorkerEnabled()).toBe(true);
});

it('acknowledges telemetry only after consumers process it', () => {
  const host = createAudioWorkerHost('fixture');
  const worker = mockWorkers[0] as EventEmitter & { postMessage: jest.Mock };
  const order: string[] = [];
  worker.postMessage.mockImplementation(() => order.push('acknowledged'));
  host.listen(() => order.push('processed'));
  worker.emit('message', {
    type: 'event',
    event: { type: 'lan-failed' },
    credit: 'lane',
  });
  expect(order).toEqual(['processed', 'acknowledged']);
  host.stop();
});

it('bounds pending controls and rejects every pending operation when the worker exits', async () => {
  const host = createAudioWorkerHost('fixture');
  const pending = Array.from({ length: 128 }, () =>
    host.request('lan.retry').catch((error: Error) => error.message),
  );
  await expect(host.request('lan.retry')).rejects.toThrow('queue is full');
  mockWorkers[0].emit('exit', 1);
  expect(await Promise.all(pending)).toEqual(
    Array(128).fill('Share Audio worker stopped.'),
  );
  await expect(host.request('lan.retry')).rejects.toThrow('stopped');
});

it('ends audio ownership if durable pairing persistence fails', () => {
  const host = createAudioWorkerHost('fixture');
  const failed = jest.fn();
  host.onFailure(failed);
  host.listen(() => {
    throw new Error('Credential store unavailable');
  });
  mockWorkers[0].emit('message', {
    type: 'event',
    event: { type: 'book', operation: 'revoke', value: 'fixture' },
  });
  expect(failed).toHaveBeenCalledTimes(1);
});

it('turns a lost telemetry acknowledgement into cleanup rather than an uncaught UI-thread error', () => {
  const host = createAudioWorkerHost('fixture');
  const worker = mockWorkers[0] as EventEmitter & {
    postMessage: jest.Mock;
    terminate: jest.Mock;
  };
  const failed = jest.fn();
  host.onFailure(failed);
  worker.postMessage.mockImplementation(() => {
    throw new Error('Port closed');
  });
  expect(() =>
    worker.emit('message', {
      type: 'event',
      event: { type: 'lan-failed' },
      credit: 'lane',
    }),
  ).not.toThrow();
  expect(failed).toHaveBeenCalledTimes(1);
  expect(worker.terminate).toHaveBeenCalledTimes(1);
});

it('ends ownership after a control cannot be sent and rejects the other pending operations', async () => {
  const host = createAudioWorkerHost('fixture');
  const pending = host.request('status').catch((error: Error) => error.message);
  const worker = mockWorkers[0] as EventEmitter & { postMessage: jest.Mock };
  worker.postMessage.mockImplementation(() => {
    throw new Error('Port closed');
  });
  await expect(host.request('lan.retry')).rejects.toThrow('could not be sent');
  expect(await pending).toBe('Share Audio worker stopped.');
});

it("says which step failed and the system's code for it", async () => {
  const host = createAudioWorkerHost('fixture');
  const worker = mockWorkers[0];
  const started = host.request('lan.retry');
  worker.emit('message', {
    type: 'answer',
    id: 1,
    error: 'Share Audio operation failed.',
    code: 'EADDRINUSE',
    syscall: 'listen',
  });
  await expect(started).rejects.toThrow(
    'Share Audio operation failed. lan.retry (EADDRINUSE listen)',
  );
  await expect(started).rejects.toMatchObject({
    code: 'EADDRINUSE',
    syscall: 'listen',
  });
  // The control: with no code, the step alone.
  const retried = host.request('lan.retry');
  worker.emit('message', {
    type: 'answer',
    id: 2,
    error: 'Share Audio operation failed.',
  });
  await expect(retried).rejects.toThrow(
    /^Share Audio operation failed\. lan\.retry$/,
  );
  host.stop();
});

/**
 * Ivan, 2026-10-28: the Share Audio page could not open its local link, twice
 * in a row. The saved port was taken, which main answers by listening on a
 * fresh one; once the link ran in its own service the failure arrived with
 * no code, and the fallback never ran.
 */
describe('a taken saved port through the Share Audio service', () => {
  const session = {
    credentials: { port: 50123, secret: 'kept' },
    details: { code: 'code', deviceName: 'PC', computerId: 'pc' },
  };
  const saved = { identity: { port: 49000, secret: 'kept' } };
  const startThrough = async (refusal: string) => {
    const host = createAudioWorkerHost('fixture');
    const worker = mockWorkers[0] as EventEmitter & {
      postMessage: jest.Mock;
    };
    const asked: (number | undefined)[] = [];
    worker.postMessage.mockImplementation(
      (message: {
        type: string;
        id: number;
        args: [{ port: number } | undefined];
      }) => {
        if (message.type !== 'request') {
          return;
        }
        const port = message.args[0]?.port;
        asked.push(port);
        queueMicrotask(() =>
          worker.emit(
            'message',
            port === saved.identity.port
              ? {
                  type: 'answer',
                  id: message.id,
                  error: 'Share Audio operation failed.',
                  code: refusal,
                  syscall: 'listen',
                }
              : { type: 'answer', id: message.id, value: session },
          ),
        );
      },
    );
    const lan = {
      start: (credentials?: { port: number; secret: string }) =>
        host.request('lan.start', credentials, { revoked: [], links: [] }),
    } as unknown as IRemoteAudioLan;
    const credentials = {
      read: () => saved,
    } as unknown as IRemoteAudioCredentialStore;
    try {
      return {
        result: await startRemoteAudioHostSession(lan, credentials),
        asked,
      };
    } finally {
      host.stop();
    }
  };

  it('listens on a fresh port with the same secret', async () => {
    const { result, asked } = await startThrough('EADDRINUSE');
    expect(asked).toEqual([49000, 0]);
    expect(result).toEqual(session);
  });

  it('still fails on anything but a taken port', async () => {
    await expect(startThrough('EACCES')).rejects.toMatchObject({
      code: 'EACCES',
    });
  });
});
