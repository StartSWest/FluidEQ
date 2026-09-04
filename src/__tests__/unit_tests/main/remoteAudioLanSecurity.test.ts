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
  removeAllListeners(): this;
  send: jest.Mock;
  sent: Buffer[];
}

const mockServers: IFakeServer[] = [];

jest.mock('ws', () => ({
  __esModule: true,
  default: jest.fn(),
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
    createSocket: jest.fn(() => {
      const socket = new EventEmitter() as EventEmitter & {
        bind: jest.Mock;
        close: jest.Mock;
        removeAllListeners(): EventEmitter;
        send: jest.Mock;
        setBroadcast: jest.Mock;
      };
      socket.bind = jest.fn(() =>
        queueMicrotask(() => socket.emit('listening')),
      );
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
    }),
  },
}));

jest.mock('os', () => ({
  __esModule: true,
  default: {
    hostname: () => 'LISTENER-PC',
    networkInterfaces: () => ({
      Ethernet: [
        {
          address: '192.168.1.20',
          family: 'IPv4',
          internal: false,
        },
      ],
    }),
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
  sealAuthReady,
} from '../../../main/remoteAudioLanProtocol';

const fakeSocket = (): IFakeSocket => {
  const socket = new EventEmitter() as IFakeSocket;
  socket.deferSendCallbacks = false;
  socket.sent = [];
  socket.close = jest.fn((code?: number, reason?: string) => {
    socket.emit('close', code, reason);
  });
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
});
