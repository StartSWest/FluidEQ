/* FluidEQ — GPL-3.0-or-later */
import { EventEmitter } from 'events';
import fs from 'fs';
import {
  createAudioWorkerHost,
  enableAudioWorker,
  audioWorkerEnabled,
  stopAudioWorker,
} from '../../../main/shareAudio/host';

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
    reason: 'EADDRINUSE listen',
  });
  await expect(started).rejects.toThrow(
    'Share Audio operation failed. lan.retry (EADDRINUSE listen)',
  );
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
