/* FluidEQ — GPL-3.0-or-later */
import { createAudioRuntime } from '../../../main/shareAudio/runtime';
import type { ILanAudioClient } from '../../../main/lanAudioHelper';
import type {
  IAudioMethods,
  TAudioMethod,
  TAudioRequest,
  TAudioResponse,
} from '../../../main/shareAudio/protocol';

it('routes a capture exit only to its own lease using the original main-side request id', async () => {
  const messages: TAudioResponse[] = [];
  const clients: ILanAudioClient[] = [];
  const pending = new Map<number, (message: TAudioResponse) => void>();
  let nativeId = 20;
  const lease = {
    request: jest.fn(() => {
      nativeId += 1;
      return { id: nativeId, answered: Promise.resolve() };
    }),
    send: jest.fn(),
    release: jest.fn(),
  };
  const factory = jest.fn(async (client: ILanAudioClient) => {
    clients.push(client);
    return lease;
  });
  const runtime = createAudioRuntime({
    post: (message) => {
      messages.push(message);
      if (message.type === 'answer') {
        pending.get(message.id)?.(message);
        pending.delete(message.id);
      }
      if (message.type === 'event' && message.credit) {
        queueMicrotask(() =>
          runtime({ type: 'credit', key: message.credit ?? '' }),
        );
      }
    },
    createLan: jest.fn(),
    startCapture: jest.fn(),
    startPlayback: jest.fn(),
    leaseHelper: factory,
    helperPid: () => 12345,
  });
  let next = 0;
  const request = <K extends TAudioMethod>(
    method: K,
    ...args: IAudioMethods[K]['args']
  ): Promise<IAudioMethods[K]['result']> => {
    next += 1;
    const id = next;
    return new Promise((resolve, reject) => {
      pending.set(id, (message) => {
        if (message.type !== 'answer' || message.error) {
          reject(new Error('request failed'));
        } else {
          resolve(message.value as IAudioMethods[K]['result']);
        }
      });
      runtime({ type: 'request', id, method, args } as TAudioRequest);
    });
  };
  const first = await request('helper.lease');
  const second = await request('helper.lease');
  await request('helper.request', first.id, 99, 8, undefined);
  const reply = {
    kind: 9,
    id: 21,
    rate: 0,
    channels: 0,
    frames: 0,
    payload: Buffer.alloc(0),
  };
  clients.forEach((client) => client.reply?.(reply));
  const exits = messages.filter(
    (message) =>
      message.type === 'event' && message.event.type === 'helper-reply',
  );
  expect(exits).toHaveLength(1);
  expect(exits[0]).toMatchObject({
    event: { id: first.id, reply: { id: 99 } },
  });
  lease.request.mockImplementationOnce(() => ({
    id: 22,
    answered: Promise.reject(new Error('Capture could not start')),
  }));
  await expect(
    request('helper.request', first.id, 100, 8, undefined),
  ).rejects.toThrow('request failed');
  clients.forEach((client) => client.reply?.({ ...reply, id: 22 }));
  expect(
    messages.filter(
      (message) =>
        message.type === 'event' && message.event.type === 'helper-reply',
    ),
  ).toHaveLength(1);
  await request('helper.release', first.id);
  await request('helper.send', second.id, new Uint8Array([1]));
  expect(lease.send).toHaveBeenCalledTimes(1);
  expect(lease.release).toHaveBeenCalledTimes(1);
});
