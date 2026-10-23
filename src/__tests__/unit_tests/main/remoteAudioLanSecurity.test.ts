/**
 * @jest-environment node
 *
 * FluidEQ — GPL-3.0-or-later
 *
 * The pragma has to be in the FIRST comment in the file. It used to sit in a
 * second one under the licence line, where Jest never read it, so this ran in
 * the browser-like environment and tested main-process code against browser
 * globals — which have no `AbortSignal.timeout`, the deadline this file is
 * about.
 */

import { EventEmitter } from 'events';

interface IFakeServer extends EventEmitter {
  address(): { port: number };
  clients: Set<IFakeSocket>;
  close: jest.Mock;
}

interface IFakeSocket extends EventEmitter {
  close: jest.Mock;
  deferSendCallbacks: boolean;
  readyState?: number;
  removeAllListeners(): this;
  send: jest.Mock;
  sent: Buffer[];
  terminate: jest.Mock;
}

const mockServers: IFakeServer[] = [];
const mockWebSocket = jest.fn();
const mockNetworkInterfaces = jest.fn(() => ({
  Ethernet: [
    {
      address: '192.168.1.20',
      netmask: '255.255.255.0',
      family: 'IPv4',
      internal: false,
    },
  ],
}));
const mockCreateDgramSocket = jest.fn(() => {
  const socket = new EventEmitter() as EventEmitter & {
    bind: jest.Mock;
    close: jest.Mock;
    removeAllListeners(): EventEmitter;
    send: jest.Mock;
    setBroadcast: jest.Mock;
  };
  socket.bind = jest.fn(() => queueMicrotask(() => socket.emit('listening')));
  socket.close = jest.fn();
  socket.send = jest.fn(
    (
      _data: Buffer,
      _port: number,
      _address: string,
      callback?: (error?: Error) => void,
    ) => callback?.(),
  );
  socket.setBroadcast = jest.fn();
  return socket;
});

jest.mock('ws', () => ({
  __esModule: true,
  default: mockWebSocket,
  WebSocketServer: jest.fn(() => {
    const server = new EventEmitter() as IFakeServer;
    server.address = () => ({ port: 49_100 });
    server.clients = new Set();
    server.close = jest.fn();
    mockServers.push(server);
    queueMicrotask(() => server.emit('listening'));
    return server;
  }),
}));

jest.mock('dgram', () => ({
  __esModule: true,
  default: {
    createSocket: mockCreateDgramSocket,
  },
}));

jest.mock('os', () => ({
  __esModule: true,
  default: {
    hostname: () => 'LISTENER-PC',
    networkInterfaces: mockNetworkInterfaces,
  },
}));

// eslint-disable-next-line import/first
import createRemoteAudioLan from '../../../main/remoteAudioLan';
// eslint-disable-next-line import/first
import {
  PACKET_AUTH_CHALLENGE,
  keyFromSecret,
  openAuthChallenge,
  openPacket,
  encodePairingCode,
  sealAuthReady,
} from '../../../main/remoteAudioLanProtocol';

const book = (revoked: string[] = []) => ({
  isRevoked: jest.fn((id: string) => revoked.includes(id)),
  revoke: jest.fn(),
  unrevoke: jest.fn(),
  forgetJoin: jest.fn(),
});

const fakeSocket = (): IFakeSocket => {
  const socket = new EventEmitter() as IFakeSocket;
  socket.deferSendCallbacks = false;
  socket.readyState = 1;
  socket.sent = [];
  socket.close = jest.fn((code?: number, reason?: string) => {
    socket.emit('close', code, reason);
  });
  socket.terminate = jest.fn(() => socket.emit('close'));
  socket.send = jest.fn(
    (packet: Buffer, callback?: (error?: Error) => void) => {
      socket.sent.push(packet);
      if (!socket.deferSendCallbacks) {
        callback?.();
      }
    },
  );
  return socket;
};

describe('LAN listener authentication limits', () => {
  beforeEach(() => {
    mockServers.length = 0;
    mockWebSocket.mockReset();
    mockCreateDgramSocket.mockClear();
    mockNetworkInterfaces.mockReturnValue({
      Ethernet: [
        {
          address: '192.168.1.20',
          netmask: '255.255.255.0',
          family: 'IPv4',
          internal: false,
        },
      ],
    });
  });

  afterEach(() => jest.useRealTimers());

  /**
   * A silent connection is let go when a newer one needs its slot, not after
   * five seconds on a timer: the one that has waited longest makes room, from
   * its own address or over all. A peer that answers its challenge is only
   * ever pending for one round trip, so it is never the one let go.
   */
  it('makes room for a ninth connection from one address by letting the oldest go', async () => {
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );
    await lan.start();
    const server = mockServers[0];
    const candidates = Array.from({ length: 9 }, () => fakeSocket());

    candidates.forEach((candidate) => {
      server.clients.add(candidate);
      server.emit('connection', candidate, {
        socket: { remoteAddress: '192.168.1.100', setKeepAlive: jest.fn() },
      });
    });

    expect(candidates[0].close).toHaveBeenCalledWith(
      1008,
      'Too many unauthenticated connections',
    );
    candidates.slice(1).forEach((candidate) => {
      expect(candidate.close).not.toHaveBeenCalled();
    });
    lan.stop();
  });

  it('makes room over all addresses by letting the longest-waiting go', async () => {
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );
    await lan.start();
    const server = mockServers[0];
    // Sixty-four fill the room, eight from each of eight addresses; the
    // sixty-fifth comes from a ninth, which holds nothing to give up.
    const candidates = Array.from({ length: 65 }, (_, index) => {
      const candidate = fakeSocket();
      server.clients.add(candidate);
      server.emit('connection', candidate, {
        socket: {
          remoteAddress: `192.168.1.${10 + Math.floor(index / 8)}`,
          setKeepAlive: jest.fn(),
        },
      });
      return candidate;
    });

    expect(candidates[0].close).toHaveBeenCalledWith(
      1008,
      'Too many unauthenticated connections',
    );
    expect(
      candidates.filter((candidate) => candidate.close.mock.calls.length > 0),
    ).toHaveLength(1);
    lan.stop();
  });

  it('settles a listener start that is manually stopped before binding', async () => {
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );

    const starting = lan.start();
    lan.stop();

    await expect(starting).rejects.toThrow('LAN listener stopped.');
    expect(mockCreateDgramSocket).not.toHaveBeenCalled();
  });

  it('reserves a peer identity before its acknowledgement completes', async () => {
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );
    const session = await lan.start();
    const server = mockServers[0];
    const key = keyFromSecret(session.credentials.secret);
    const first = fakeSocket();
    const second = fakeSocket();

    const connect = (socket: IFakeSocket) => {
      server.clients.add(socket);
      server.emit('connection', socket, {
        socket: { remoteAddress: '192.168.1.101', setKeepAlive: jest.fn() },
      });
      const packet = openPacket(socket.sent[0], key);
      expect(packet.kind).toBe(PACKET_AUTH_CHALLENGE);
      return openAuthChallenge(packet.clear).challenge;
    };

    const firstChallenge = connect(first);
    first.deferSendCallbacks = true;
    first.emit(
      'message',
      sealAuthReady(
        {
          challenge: firstChallenge,
          deviceName: 'SOURCE-ONE',
          peerId: 'same-peer',
        },
        key,
      ),
    );

    const secondChallenge = connect(second);
    second.emit(
      'message',
      sealAuthReady(
        {
          challenge: secondChallenge,
          deviceName: 'SOURCE-TWO',
          peerId: 'same-peer',
        },
        key,
      ),
    );

    expect(second.close).toHaveBeenCalledWith(1008, 'Authentication failed');
    lan.stop();
  });

  it('bounds authenticated senders even when they all know the pairing code', async () => {
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );
    const session = await lan.start();
    const server = mockServers[0];
    const key = keyFromSecret(session.credentials.secret);
    const candidates = Array.from({ length: 33 }, () => fakeSocket());

    candidates.forEach((candidate, index) => {
      server.clients.add(candidate);
      server.emit('connection', candidate, {
        socket: {
          remoteAddress: `192.168.1.${index + 50}`,
          setKeepAlive: jest.fn(),
        },
      });
      const packet = openPacket(candidate.sent[0], key);
      const { challenge } = openAuthChallenge(packet.clear);
      candidate.emit(
        'message',
        sealAuthReady(
          {
            challenge,
            deviceName: `SOURCE-${index}`,
            peerId: `peer-${index}`,
          },
          key,
        ),
      );
    });

    expect(candidates[31].close).not.toHaveBeenCalled();
    expect(candidates[32].close).toHaveBeenCalledWith(
      1008,
      'Authentication failed',
    );
    lan.stop();
  });

  it('keeps an error listener during the authentication acknowledgement', async () => {
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );
    const session = await lan.start();
    const server = mockServers[0];
    const key = keyFromSecret(session.credentials.secret);
    const candidate = fakeSocket();
    server.clients.add(candidate);
    server.emit('connection', candidate, {
      socket: { remoteAddress: '192.168.1.90', setKeepAlive: jest.fn() },
    });
    const packet = openPacket(candidate.sent[0], key);
    const { challenge } = openAuthChallenge(packet.clear);
    candidate.deferSendCallbacks = true;
    candidate.emit(
      'message',
      sealAuthReady(
        {
          challenge,
          deviceName: 'SOURCE-PC',
          peerId: 'pending-ack-peer',
        },
        key,
      ),
    );

    expect(() =>
      candidate.emit('error', new Error('socket failed')),
    ).not.toThrow();
    expect(candidate.close).toHaveBeenCalledWith(1008, 'Authentication failed');
    lan.stop();
  });

  it('cannot attach a peer let go while its acknowledgement was on its way', async () => {
    const emitSignal = jest.fn();
    const lan = createRemoteAudioLan(
      emitSignal,
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );
    const session = await lan.start();
    const server = mockServers[0];
    const key = keyFromSecret(session.credentials.secret);
    const candidate = fakeSocket();
    server.clients.add(candidate);
    server.emit('connection', candidate, {
      socket: { remoteAddress: '192.168.1.91', setKeepAlive: jest.fn() },
    });
    const packet = openPacket(candidate.sent[0], key);
    const { challenge } = openAuthChallenge(packet.clear);
    candidate.deferSendCallbacks = true;
    candidate.emit(
      'message',
      sealAuthReady(
        {
          challenge,
          deviceName: 'SOURCE-PC',
          peerId: 'let-go-peer',
        },
        key,
      ),
    );

    // Eight newer connections from the same address: the oldest, this one,
    // makes room while its acknowledgement is still being sent.
    Array.from({ length: 8 }, () => fakeSocket()).forEach((newer) => {
      server.clients.add(newer);
      server.emit('connection', newer, {
        socket: { remoteAddress: '192.168.1.91', setKeepAlive: jest.fn() },
      });
    });
    expect(candidate.close).toHaveBeenCalledWith(
      1008,
      'Too many unauthenticated connections',
    );
    const acknowledge = candidate.send.mock.calls[1][1] as
      ((error?: Error) => void) | undefined;
    acknowledge?.();

    expect(emitSignal).not.toHaveBeenCalled();
    lan.stop();
  });

  it('keeps the listener alive while every network adapter is offline', async () => {
    mockNetworkInterfaces.mockReturnValue({ Ethernet: [] });
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );

    const session = await lan.start();

    expect(session.details.deviceName).toBe('LISTENER-PC');
    expect(session.details.code).toBeUndefined();
    expect(mockServers).toHaveLength(1);
    lan.stop();
  });

  it('can abort a connecting join without an uncaught WebSocket error', async () => {
    const socket = fakeSocket();
    socket.readyState = 0;
    socket.close.mockImplementation((code?: number, reason?: string) => {
      socket.emit(
        'error',
        new Error('WebSocket was closed before the connection was established'),
      );
      socket.emit('close', code, reason);
    });
    mockWebSocket.mockImplementation(() => socket);
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );
    await lan.start();
    const pairingCode = encodePairingCode(
      '192.168.1.21',
      49_100,
      'c'.repeat(43),
      'OTHER-PC',
    );

    // A join has no deadline: it ends on the socket's own close or error, or
    // on stop, which is what unlinking and quitting call.
    lan.join(pairingCode, true);
    await Promise.resolve();
    expect(() => lan.stop()).not.toThrow();
    expect(socket.close).toHaveBeenCalled();
  });

  it('refuses this computer’s own code', async () => {
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
      book(),
    );
    const session = await lan.start();

    expect(() => lan.join(session.details.code, true)).toThrow('own code');
    lan.stop();
  });

  /** Answers a fresh connection's challenge as the computer `computerId`. */
  const joinAs = async (
    revoked: string[],
    computerId: string,
    fresh: boolean,
  ) => {
    const links = book(revoked);
    const emitSignal = jest.fn();
    const lan = createRemoteAudioLan(
      emitSignal,
      jest.fn(),
      jest.fn(),
      jest.fn(),
      links,
    );
    const session = await lan.start();
    const key = keyFromSecret(session.credentials.secret);
    const candidate = fakeSocket();
    mockServers[0].clients.add(candidate);
    mockServers[0].emit('connection', candidate, {
      socket: { remoteAddress: '192.168.1.101', setKeepAlive: jest.fn() },
    });
    const { challenge } = openAuthChallenge(
      openPacket(candidate.sent[0], key).clear,
    );
    candidate.emit(
      'message',
      sealAuthReady(
        {
          challenge,
          deviceName: 'COMEBACK-PC',
          peerId: 'peer-x',
          computerId,
          ...(fresh ? { fresh } : {}),
        },
        key,
      ),
    );
    return { lan, links, candidate, emitSignal };
  };

  it('turns an unlinked computer away, telling it to forget this code', async () => {
    const id = 'u'.repeat(32);
    const { lan, links, candidate, emitSignal } = await joinAs([id], id, false);

    expect(candidate.close).toHaveBeenCalledWith(4001, 'Not linked');
    expect(links.unrevoke).not.toHaveBeenCalled();
    expect(emitSignal).not.toHaveBeenCalled();
    lan.stop();
  });

  it('lets an unlinked computer back in when somebody pasted the code there', async () => {
    const id = 'u'.repeat(32);
    const { lan, links, candidate, emitSignal } = await joinAs([id], id, true);

    expect(candidate.close).not.toHaveBeenCalled();
    expect(links.unrevoke).toHaveBeenCalledWith(id);
    expect(emitSignal).toHaveBeenCalledWith({
      peerId: 'peer-x',
      signal: {
        kind: 'peer-ready',
        address: '192.168.1.101',
        deviceName: 'COMEBACK-PC',
        computerId: id,
      },
    });
    lan.stop();
  });

  it('unlinks one computer: it is told to forget, and refused if it comes back', async () => {
    const id = 'k'.repeat(32);
    const { lan, links, candidate } = await joinAs([], id, true);

    lan.unlink({ peerId: 'peer-x' });

    expect(links.revoke).toHaveBeenCalledWith(id);
    expect(candidate.close).toHaveBeenCalledWith(1000, 'Unlinked');
    lan.stop();
  });
});
