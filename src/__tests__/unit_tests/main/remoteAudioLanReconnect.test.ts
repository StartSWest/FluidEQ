/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

/**
 * Reconnect by hand, from a computer's options menu: a new round with the
 * code saved for it, answered when that round ends — linked, or every
 * address gone without an answer — and never by guessing a duration.
 */

const mockJoinAt = jest.fn();

jest.mock('../../../main/remoteAudioLanJoin', () => {
  const actual = jest.requireActual('../../../main/remoteAudioLanJoin');
  return { ...actual, joinAt: (...args: unknown[]) => mockJoinAt(...args) };
});

/* eslint-disable import/first -- keep the mocked join boundary above */
import { createLanJoins } from '../../../main/remoteAudioLanJoins';
import {
  computerIdOf,
  decodePairingCode,
  encodePairingCode,
} from '../../../main/remoteAudioLanProtocol';
/* eslint-enable import/first */

const SECRET = 'r'.repeat(43);
const pairing = () =>
  decodePairingCode(
    encodePairingCode(['192.168.1.20', '10.0.0.20'], 49_100, SECRET, 'OTHER'),
  );

/** Every attempt joinAt is asked for, each settled by hand. */
const attempts = () => {
  const made: {
    address: string;
    peerId: string;
    answer(value: unknown): void;
    refuse(error: unknown): void;
  }[] = [];
  mockJoinAt.mockImplementation(
    (options: { address: string; peerId: string }) => {
      let answer: (value: unknown) => void = () => undefined;
      let refuse: (error: unknown) => void = () => undefined;
      const joined = new Promise((resolve, reject) => {
        answer = resolve;
        refuse = reject;
      });
      made.push({ ...options, answer, refuse });
      return { joined, cancel: jest.fn() };
    },
  );
  return made;
};

const settled = async () => {
  for (let turn = 0; turn < 4; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask per turn
    await Promise.resolve();
  }
};

const joinsFor = () =>
  createLanJoins({
    attach: jest.fn(),
    emitSignal: jest.fn(),
    self: () => ({ computerId: 'm'.repeat(32), deviceName: 'ME' }),
    askWhoIsThere: jest.fn(),
    inboundLive: () => false,
  });

beforeEach(() => mockJoinAt.mockReset());

describe('reconnecting a computer by hand', () => {
  it('tries every saved address again in a new round, and says when none answered', async () => {
    const made = attempts();
    const joins = joinsFor();
    const id = joins.join(pairing(), false);
    expect(made).toHaveLength(2);

    const outcome = joins.reconnect(id);
    expect(made).toHaveLength(4);
    // A new round: its own peer id, so the old round's answers are ignored.
    expect(made[2].peerId).not.toBe(made[0].peerId);
    let answered: boolean | undefined;
    outcome.then((linked) => {
      answered = linked;
      return undefined;
    });

    made[2].refuse(
      Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }),
    );
    await settled();
    expect(answered).toBeUndefined();
    made[3].refuse(
      Object.assign(new Error('refused'), { code: 'ECONNREFUSED' }),
    );
    await settled();
    expect(answered).toBe(false);
    joins.closeAll();
  });

  it('answers linked as soon as one address of the new round answers', async () => {
    const made = attempts();
    const joins = joinsFor();
    const id = joins.join(pairing(), false);
    const outcome = joins.reconnect(id);
    made[3].answer({
      socket: { once: jest.fn() },
      sessionKey: Buffer.alloc(32),
    });
    await expect(outcome).resolves.toBe(true);
    expect(joins.peerOf(id)).toBe(made[3].peerId);
    joins.closeAll();
  });

  it('waits on a linked computer for the round its closed connection starts', async () => {
    const made = attempts();
    const joins = joinsFor();
    const id = joins.join(pairing(), false);
    const closes: ((code: number) => void)[] = [];
    made[0].answer({
      socket: {
        once: (_event: string, listener: (code: number) => void) =>
          closes.push(listener),
      },
      sessionKey: Buffer.alloc(32),
    });
    await settled();
    expect(joins.peerOf(id)).toBeDefined();

    const outcome = joins.reconnect(id);
    // Linked: nothing is dialled until the caller's close lands.
    expect(made).toHaveLength(2);
    let answered: boolean | undefined;
    outcome.then((linked) => {
      answered = linked;
      return undefined;
    });
    await settled();
    expect(answered).toBeUndefined();

    closes[0](1000);
    expect(made).toHaveLength(4);
    made[2].answer({
      socket: { once: jest.fn() },
      sessionKey: Buffer.alloc(32),
    });
    await settled();
    expect(answered).toBe(true);
    joins.closeAll();
  });

  it('cannot reconnect a computer it holds no code for, and a forgotten one is not reached', async () => {
    attempts();
    const joins = joinsFor();
    await expect(joins.reconnect(computerIdOf('x'.repeat(43)))).resolves.toBe(
      false,
    );
    const id = joins.join(pairing(), false);
    const outcome = joins.reconnect(id);
    joins.leave(id);
    await expect(outcome).resolves.toBe(false);
  });
});
