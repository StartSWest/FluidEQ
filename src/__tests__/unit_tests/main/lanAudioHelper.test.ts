/** @jest-environment node */

/**
 * The LAN audio helper as one process every part of LAN audio shares.
 *
 * It is the parent of both capture helpers, which is what keeps a computer's
 * own sound from travelling back to it, so there must never be two of it:
 * a second one would be a second tree the network's capture does not leave
 * out. Held here: one process however many leases, requests answered under
 * their own ids, unasked replies to every lease, and the process ended by the
 * last release and not before.
 */

import { EventEmitter } from 'events';
import { playbackCommand } from 'main/nativeRemoteAudioPlaybackProtocol';

const mockSpawn = jest.fn();
jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));
jest.mock('fs', () => ({
  ...jest.requireActual('fs'),
  existsSync: () => true,
}));

type THelperModule = typeof import('main/lanAudioHelper');

interface IFakeChild extends EventEmitter {
  pid: number;
  kill: jest.Mock;
  stdin: EventEmitter & {
    write: jest.Mock;
    end: jest.Mock;
    writableLength: number;
  };
  stdout: EventEmitter;
  stderr: EventEmitter;
}

const fakeChild = (pid: number): IFakeChild => {
  const child = new EventEmitter() as IFakeChild;
  child.pid = pid;
  child.kill = jest.fn();
  child.stdin = Object.assign(new EventEmitter(), {
    write: jest.fn(),
    end: jest.fn(),
    writableLength: 0,
  });
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  return child;
};

/** What the helper writes back: its replies share the command layout. */
const reply = (kind: number, id = 0, rate = 0) =>
  playbackCommand(kind, id, Buffer.alloc(0), rate);

const written = (child: IFakeChild) =>
  child.stdin.write.mock.calls.map(([packet]: [Buffer]) => ({
    kind: packet.readUInt32LE(4),
    id: packet.readUInt32LE(8),
    payload: packet.subarray(24).toString('utf8'),
  }));

let helper: THelperModule;
let children: IFakeChild[];

/** Leases once the helper has said it is ready. */
const lease = async (client = { stopped: jest.fn(), reply: jest.fn() }) => {
  const leasing = helper.leaseLanAudioHelper(client);
  const child = children[children.length - 1];
  child.stdout.emit('data', reply(1));
  return { client, lease: await leasing, child };
};

beforeEach(() => {
  jest.resetModules();
  children = [];
  mockSpawn.mockReset().mockImplementation(() => {
    const child = fakeChild(1000 + children.length);
    children.push(child);
    return child;
  });
  // eslint-disable-next-line global-require -- the module holds its one helper; each case needs a fresh copy after resetModules
  helper = require('main/lanAudioHelper');
});

it('starts one process for every lease, told whose it is', async () => {
  const first = await lease();
  const second = helper.leaseLanAudioHelper({ stopped: jest.fn() });
  await second;
  expect(mockSpawn).toHaveBeenCalledTimes(1);
  expect(mockSpawn.mock.calls[0][1]).toEqual([
    '--parent-pid',
    String(process.pid),
  ]);
  expect(helper.lanAudioHelperPid()).toBe(first.child.pid);
});

it('answers each request under its own id, and refuses on a failure code', async () => {
  const { lease: held, child } = await lease();
  const open = held.request(1, Buffer.from('device'));
  const spawnCapture = held.request(8, Buffer.from('pipe token lan'));
  expect(written(child)).toEqual([
    { kind: 1, id: open.id, payload: 'device' },
    { kind: 8, id: spawnCapture.id, payload: 'pipe token lan' },
  ]);
  child.stdout.emit('data', reply(3, spawnCapture.id, 0x8007_0005));
  child.stdout.emit('data', reply(3, open.id, 0));
  await expect(open.answered).resolves.toBeUndefined();
  await expect(spawnCapture.answered).rejects.toThrow('0x80070005');
});

it('tells every lease what nobody asked for: a capture ending, the output failing', async () => {
  const first = await lease();
  const secondClient = { stopped: jest.fn(), reply: jest.fn() };
  await helper.leaseLanAudioHelper(secondClient);
  first.child.stdout.emit('data', reply(9, 7, 1));
  first.child.stdout.emit('data', reply(4, 0));
  [first.client, secondClient].forEach((client) => {
    expect(client.reply.mock.calls.map(([entry]) => entry.kind)).toEqual([
      9, 4,
    ]);
  });
  expect(first.child.kill).not.toHaveBeenCalled();
});

it('ends only with the last release, and starts afresh after it', async () => {
  const first = await lease();
  const second = await helper.leaseLanAudioHelper({ stopped: jest.fn() });
  first.lease.release();
  // Released twice is released once.
  first.lease.release();
  expect(first.child.stdin.end).not.toHaveBeenCalled();
  second.release();
  expect(first.child.stdin.end).toHaveBeenCalledTimes(1);
  const quit = first.child.stdin.end.mock.calls[0][0] as Buffer;
  expect(quit.readUInt32LE(4)).toBe(6);
  expect(helper.lanAudioHelperPid()).toBeUndefined();

  const next = await lease();
  expect(mockSpawn).toHaveBeenCalledTimes(2);
  expect(next.child).not.toBe(first.child);
});

it('voids every lease and request when the process ends', async () => {
  const { client, lease: held, child } = await lease();
  const pending = held.request(7);
  child.stderr.emit('data', Buffer.from('device lost'));
  child.emit('close');
  await expect(pending.answered).rejects.toThrow('device lost');
  expect(client.stopped).toHaveBeenCalledWith(new Error('device lost'));
  expect(() => held.send(playbackCommand(4))).toThrow('stopped');
});

it('refuses a helper that answers before it says it is ready', async () => {
  const client = { stopped: jest.fn() };
  const leasing = helper.leaseLanAudioHelper(client);
  children[0].stdout.emit('data', reply(3, 1));
  await expect(leasing).rejects.toThrow('before it was ready');
  expect(children[0].kill).toHaveBeenCalled();
});
