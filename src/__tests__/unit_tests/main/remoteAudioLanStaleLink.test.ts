/** @jest-environment node */
/* FluidEQ — GPL-3.0-or-later */

/**
 * A linked computer stays linked until somebody unlinks it (Ivan,
 * 2026-11-09: "this needs to be permanent untl they disconect maually").
 * Two things kept saved computers offline for good: a link here that died
 * without a close refused the other computer's dial back, and every computer
 * dialled itself on the strength of its own broadcast.
 */

import { EventEmitter } from 'events';

const mockJoinAt = jest.fn();

jest.mock('../../../main/remoteAudioLanJoin', () => {
  const actual = jest.requireActual('../../../main/remoteAudioLanJoin');
  return { ...actual, joinAt: (...args: unknown[]) => mockJoinAt(...args) };
});
jest.mock('../../../main/remoteAudioLanAddresses', () => ({
  ...jest.requireActual('../../../main/remoteAudioLanAddresses'),
  lanAddresses: () => ['192.168.1.66'],
  discoveryTargets: () => ['192.168.1.255'],
}));

/* eslint-disable import/first -- keep the mocked boundaries above */
import type dgram from 'dgram';
import { createLanJoins } from '../../../main/remoteAudioLanJoins';
import { configureLanDiscovery } from '../../../main/remoteAudioLanDiscovery';
import {
  REMOTE_AUDIO_DISCOVERY_PORT,
  encodeDiscoveryQuery,
} from '../../../main/remoteAudioDiscovery';
import {
  computerIdOf,
  decodePairingCode,
  encodePairingCode,
} from '../../../main/remoteAudioLanProtocol';
/* eslint-enable import/first */

const THEIR_SECRET = 'b'.repeat(43);
const THEIR_ID = computerIdOf(THEIR_SECRET);
/** Below theirs, so this computer's own link is the one a pair keeps. */
const SMALL_ID = '-'.repeat(32);

/** A link whose other end does as told when pinged. */
const link = (onPing: (socket: EventEmitter) => void) => {
  const socket = new EventEmitter();
  return Object.assign(socket, {
    ping: () => onPing(socket),
    close: jest.fn(),
    terminate: jest.fn(),
    readyState: 1,
  });
};

/** This computer linked to theirs over `socket`, by its own join. */
const linkedOver = async (socket: EventEmitter) => {
  let answer: (value: unknown) => void = () => undefined;
  mockJoinAt.mockImplementation(() => ({
    joined: new Promise((resolve) => {
      answer = resolve;
    }),
    cancel: jest.fn(),
  }));
  const joins = createLanJoins({
    attach: jest.fn(),
    emitSignal: jest.fn(),
    self: () => ({ computerId: SMALL_ID, deviceName: 'ME' }),
    askWhoIsThere: jest.fn(),
    inboundLive: () => false,
  });
  joins.join(
    decodePairingCode(
      encodePairingCode(['192.168.1.20'], 49_100, THEIR_SECRET, 'OTHER'),
    ),
    false,
  );
  answer({ socket, sessionKey: Buffer.alloc(32) });
  for (let turn = 0; turn < 3; turn += 1) {
    // eslint-disable-next-line no-await-in-loop -- one microtask per turn
    await Promise.resolve();
  }
  expect(joins.peerOf(THEIR_ID)).toBeDefined();
  return joins;
};

beforeEach(() => mockJoinAt.mockReset());

describe('a computer dialling back while this one thinks it is linked', () => {
  it('keeps this computer’s own link while it still answers', async () => {
    const joins = await linkedOver(
      link((socket) => queueMicrotask(() => socket.emit('pong'))),
    );
    await expect(joins.inboundArrived(THEIR_ID)).resolves.toBe('refuse');
    expect(joins.peerOf(THEIR_ID)).toBeDefined();
    joins.closeAll();
  });

  it('lets it in when this computer’s link is dead — it restarted', async () => {
    // A rebooted computer answers the ping with a reset: the link closes.
    const joins = await linkedOver(
      link((socket) => queueMicrotask(() => socket.emit('close', 1006))),
    );
    await expect(joins.inboundArrived(THEIR_ID)).resolves.toBe('accept');
    // Its connection is the link now; this computer's own sleeps.
    expect(joins.peerOf(THEIR_ID)).toBeUndefined();
    joins.closeAll();
  });

  it('lets it in once a link that answers nothing is given up — it slept or moved address', async () => {
    const dead = link(() => undefined);
    const joins = await linkedOver(dead);
    let decided: string | undefined;
    joins
      .inboundArrived(THEIR_ID)
      .then((answer) => {
        decided = answer;
        return undefined;
      })
      .catch(() => undefined);
    await Promise.resolve();
    // No answer and no close: nothing is decided on a guess at time.
    expect(decided).toBeUndefined();
    // TCP's keep-alive gives the dead link up.
    dead.emit('close', 1006);
    await Promise.resolve();
    await Promise.resolve();
    expect(decided).toBe('accept');
    joins.closeAll();
  });
});

describe('the discovery socket', () => {
  const discoverySocket = () => {
    const socket = new EventEmitter();
    const send = jest.fn();
    return Object.assign(socket, {
      send,
      address: () => ({
        address: '0.0.0.0',
        family: 'IPv4',
        port: REMOTE_AUDIO_DISCOVERY_PORT,
      }),
    });
  };
  const configure = (socket: EventEmitter, heard: jest.Mock) =>
    configureLanDiscovery(socket as unknown as dgram.Socket, {
      secret: 'a'.repeat(43),
      port: 60_223,
      deviceName: 'SWEST-GAMING',
      // A pair link's secret: the other computer holds it too.
      pairSecrets: () => [THEIR_SECRET],
      heard,
      closed: jest.fn(),
    });

  it('answers another computer asking for a link secret it shares', () => {
    const socket = discoverySocket();
    const heard = jest.fn();
    configure(socket, heard);
    socket.emit('message', encodeDiscoveryQuery(THEIR_SECRET), {
      address: '192.168.1.30',
      port: REMOTE_AUDIO_DISCOVERY_PORT,
    });
    expect(socket.send).toHaveBeenCalledTimes(1);
  });

  it('does not answer, or hear, its own broadcast for that secret', () => {
    const socket = discoverySocket();
    const heard = jest.fn();
    configure(socket, heard);
    const own = { address: '192.168.1.66', port: REMOTE_AUDIO_DISCOVERY_PORT };
    socket.emit('message', encodeDiscoveryQuery(THEIR_SECRET), own);
    socket.emit('message', Buffer.from('{"kind":"listener-ready"}'), own);
    expect(socket.send).not.toHaveBeenCalled();
    expect(heard).not.toHaveBeenCalled();
    // The same address from another port is another program's socket.
    socket.emit('message', Buffer.from('{}'), { ...own, port: 50_000 });
    expect(heard).toHaveBeenCalledTimes(1);
  });
});
