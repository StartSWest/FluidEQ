/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

const mockJoinAt = jest.fn();

jest.mock('../../../main/remoteAudioLanJoin', () => {
  const actual = jest.requireActual('../../../main/remoteAudioLanJoin');
  return { ...actual, joinAt: (...args: unknown[]) => mockJoinAt(...args) };
});

// eslint-disable-next-line import/first
import { createLanJoins } from '../../../main/remoteAudioLanJoins';
// eslint-disable-next-line import/first
import {
  computerIdOf,
  decodePairingCode,
  encodePairingCode,
} from '../../../main/remoteAudioLanProtocol';

const pairing = (secret: string) =>
  decodePairingCode(
    encodePairingCode(['192.168.1.20', '10.0.0.20'], 49_100, secret, 'OTHER'),
  );

/** A connection attempt nobody answers. */
const never = () =>
  new Promise(() => {
    // Never settles.
  });

const joinsAs = (selfId: string, inboundLive = false) => {
  const deps = {
    attach: jest.fn(),
    emitSignal: jest.fn(),
    self: () => ({ computerId: selfId, deviceName: 'ME' }),
    askWhoIsThere: jest.fn(),
    inboundLive: jest.fn(() => inboundLive),
    forgotten: jest.fn(),
  };
  return { joins: createLanJoins(deps), deps };
};

beforeEach(() => {
  mockJoinAt.mockReset();
  mockJoinAt.mockImplementation(() => ({ joined: never(), cancel: jest.fn() }));
});

describe('joining every computer whose code was pasted', () => {
  it('tries every address in the code at once, and asks the network too', () => {
    const { joins, deps } = joinsAs('m'.repeat(32));
    joins.join(pairing('a'.repeat(43)), true);

    expect(
      mockJoinAt.mock.calls.map(([attempt]) => attempt.address).sort(),
    ).toEqual(['10.0.0.20', '192.168.1.20']);
    expect(mockJoinAt.mock.calls[0][0].fresh).toBe(true);
    // One peer id for the round, so a computer reached twice accepts once.
    expect(new Set(mockJoinAt.mock.calls.map(([a]) => a.peerId)).size).toBe(1);
    expect(deps.askWhoIsThere).toHaveBeenCalledWith('a'.repeat(43));
  });

  it('keeps the first address that answers and drops the slower one', async () => {
    const cancels = [jest.fn(), jest.fn()];
    let answer: (value: unknown) => void = () => undefined;
    mockJoinAt
      .mockImplementationOnce(() => ({
        joined: new Promise((resolve) => {
          answer = resolve;
        }),
        cancel: cancels[0],
      }))
      .mockImplementationOnce(() => ({ joined: never(), cancel: cancels[1] }));
    const { joins, deps } = joinsAs('m'.repeat(32));
    const id = joins.join(pairing('a'.repeat(43)), true);
    const socket = { once: jest.fn() };
    answer({ address: '192.168.1.20', socket, sessionKey: Buffer.alloc(32) });
    await Promise.resolve();
    await Promise.resolve();

    expect(cancels[1]).toHaveBeenCalled();
    expect(deps.attach).toHaveBeenCalledTimes(1);
    expect(joins.peerOf(id)).toBeDefined();
  });

  it('of two connections between one pair, both computers keep the same one', () => {
    // The lowest and highest ids there can be, either side of theirs.
    const small = '-'.repeat(32);
    const large = 'z'.repeat(32);
    const theirSecret = 'b'.repeat(43);
    const theirId = computerIdOf(theirSecret);

    // This computer is joined and connected to them; they connect back.
    const connected = (selfId: string) => {
      let answer: (value: unknown) => void = () => undefined;
      mockJoinAt.mockImplementation(() => ({
        joined: new Promise((resolve) => {
          answer = resolve;
        }),
        cancel: jest.fn(),
      }));
      const { joins } = joinsAs(selfId);
      joins.join(pairing(theirSecret), false);
      answer({
        address: '192.168.1.20',
        socket: { once: jest.fn() },
        sessionKey: Buffer.alloc(32),
      });
      return joins;
    };

    return (async () => {
      const below = connected(small);
      const above = connected(large);
      await Promise.resolve();
      await Promise.resolve();
      // The connection whose JOINING computer has the smaller id is kept:
      // below them, this computer's own is kept and theirs refused; above
      // them, theirs is let in and this one's own goes to sleep.
      expect(below.inboundArrived(theirId)).toBe('refuse');
      expect(above.inboundArrived(theirId)).toBe('accept');
      expect(above.peerOf(theirId)).toBeUndefined();
    })();
  });

  it('sleeps while the other computer’s connection is the link, and wakes when it ends', () => {
    const { joins } = joinsAs('m'.repeat(32), true);
    joins.join(pairing('c'.repeat(43)), false);
    expect(mockJoinAt).not.toHaveBeenCalled();

    joins.inboundClosed(computerIdOf('c'.repeat(43)));
    expect(mockJoinAt).toHaveBeenCalled();
  });
});
