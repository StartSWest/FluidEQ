/* FluidEQ — GPL-3.0-or-later */

/** @jest-environment node */

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
          family: 'IPv4',
          internal: false,
        },
      ],
    });
  });

  afterEach(() => jest.useRealTimers());

  it('limits pending sockets per address and times silent clients out', async () => {
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );
    await lan.startHost();
    jest.useFakeTimers();
    const server = mockServers[0];
    const candidates = Array.from({ length: 9 }, () => fakeSocket());

    candidates.forEach((candidate) => {
      server.clients.add(candidate);
      server.emit('connection', candidate, {
        socket: { remoteAddress: '192.168.1.100' },
      });
    });

    expect(candidates[0].close).not.toHaveBeenCalled();
    expect(candidates[8].close).toHaveBeenCalledWith(
      1008,
      'Too many unauthenticated connections',
    );

    jest.advanceTimersByTime(5_000);
    expect(candidates[0].close).toHaveBeenCalledWith(
      1008,
      'Authentication timed out',
    );
    lan.stop();
  });

  it('settles a listener start that is manually stopped before binding', async () => {
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );

    const starting = lan.startHost();
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
    );
    const session = await lan.startHost();
    const server = mockServers[0];
    const key = keyFromSecret(session.credentials.secret);
    const first = fakeSocket();
    const second = fakeSocket();

    const connect = (socket: IFakeSocket) => {
      server.clients.add(socket);
      server.emit('connection', socket, {
        socket: { remoteAddress: '192.168.1.101' },
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
    );
    const session = await lan.startHost();
    const server = mockServers[0];
    const key = keyFromSecret(session.credentials.secret);
    const candidates = Array.from({ length: 33 }, () => fakeSocket());

    candidates.forEach((candidate, index) => {
      server.clients.add(candidate);
      server.emit('connection', candidate, {
        socket: { remoteAddress: `192.168.1.${index + 50}` },
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
    );
    const session = await lan.startHost();
    const server = mockServers[0];
    const key = keyFromSecret(session.credentials.secret);
    const candidate = fakeSocket();
    server.clients.add(candidate);
    server.emit('connection', candidate, {
      socket: { remoteAddress: '192.168.1.90' },
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

  it('cannot attach a peer after its acknowledgement timed out', async () => {
    const emitSignal = jest.fn();
    const lan = createRemoteAudioLan(
      emitSignal,
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );
    const session = await lan.startHost();
    jest.useFakeTimers();
    const server = mockServers[0];
    const key = keyFromSecret(session.credentials.secret);
    const candidate = fakeSocket();
    server.clients.add(candidate);
    server.emit('connection', candidate, {
      socket: { remoteAddress: '192.168.1.91' },
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
          peerId: 'timed-out-peer',
        },
        key,
      ),
    );

    jest.advanceTimersByTime(5_000);
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
    );

    const session = await lan.startHost();

    expect(session.details.deviceName).toBe('LISTENER-PC');
    expect(session.details.options).toEqual([]);
    expect(mockServers).toHaveLength(1);
    lan.stop();
  });

  it('can abort a connecting client without an uncaught WebSocket error', async () => {
    jest.useFakeTimers();
    const socket = fakeSocket();
    socket.readyState = 0;
    socket.close.mockImplementation((code?: number, reason?: string) => {
      socket.emit(
        'error',
        new Error('WebSocket was closed before the connection was established'),
      );
      socket.emit('close', code, reason);
    });
    mockWebSocket.mockImplementationOnce(() => socket);
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );
    const pairingCode = encodePairingCode(
      '192.168.1.20',
      49_100,
      'c'.repeat(43),
      'LISTENER-PC',
    );

    const joining = lan.restoreJoin(pairingCode);
    jest.advanceTimersByTime(5_000);
    await Promise.resolve();
    lan.stop();

    await expect(joining).rejects.toThrow('LAN authentication timed out.');
    expect(socket.close).toHaveBeenCalledWith(1008, 'Authentication timed out');
  });

  it('does not start discovery after a pending restore was manually stopped', async () => {
    const socket = fakeSocket();
    socket.readyState = 0;
    mockWebSocket.mockImplementationOnce(() => socket);
    const lan = createRemoteAudioLan(
      jest.fn(),
      jest.fn(),
      jest.fn(),
      jest.fn(),
    );
    const pairingCode = encodePairingCode(
      '192.168.1.20',
      49_100,
      'c'.repeat(43),
      'LISTENER-PC',
    );

    const restoring = lan.restoreJoin(pairingCode);
    lan.stop();

    await expect(restoring).rejects.toThrow('LAN connection closed.');
    expect(mockCreateDgramSocket).not.toHaveBeenCalled();
  });
});
