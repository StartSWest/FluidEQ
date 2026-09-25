/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import crypto from 'crypto';
import dgram from 'dgram';
import os from 'os';
import WebSocket, { WebSocketServer, type RawData } from 'ws';
import {
  ILanRemoteComputer,
  ILanRemoteAudioChunk,
  ILanRemoteAudioNetworkStats,
  ILanRemoteAudioSignal,
  isLanRemoteAudioSignal,
} from '../common/remoteAudio';
import {
  MAX_PACKET_BYTES,
  PACKET_AUTH_ACCEPTED,
  PACKET_AUTH_CHALLENGE,
  PACKET_AUTH_READY,
  type ILanPairingPayload,
  createAuthChallenge,
  decodePairingCode,
  deriveSessionKey,
  encodePairingCode,
  isPrivateIpv4,
  keyFromSecret,
  lanAddresses,
  openAuthAccepted,
  openAuthChallenge,
  openAuthReady,
  openPacket,
  sealAuthAccepted,
  sealAuthChallenge,
  sealAuthReady,
} from './remoteAudioLanProtocol';
import {
  REMOTE_AUDIO_DISCOVERY_PORT,
  decodeDiscoveryAnnouncement,
  encodeDiscoveryAnnouncement,
  encodeDiscoveryQuery,
  isDiscoveryQuery,
} from './remoteAudioDiscovery';
import createRemoteAudioTransport from './remoteAudioTransport';
import type {
  ILanHostCredentials,
  ILanHostSession,
  IRemoteAudioLan,
} from './remoteAudioLanTypes';

const MAX_PENDING_SOCKETS = 64;
const MAX_PENDING_SOCKETS_PER_ADDRESS = 8;
const MAX_AUTHENTICATED_SOCKETS = 32;
/**
 * How many times the network is asked who is listening, each sent once the
 * last has left the socket. A datagram can be dropped; a listener that comes
 * up later announces itself and is heard without being asked again.
 */
const DISCOVERY_QUERIES = 3;
const WEB_SOCKET_OPEN = 1;
const WEB_SOCKET_CLOSED = 3;

/**
 * Closing a `ws` client while it is still CONNECTING aborts its handshake by
 * emitting an Error before `close`. The join cleanup removes its own Error
 * listener once the attempt is settled, so a later abort used to escape as an
 * uncaught main-process exception. Keep one close-only sink attached until the
 * socket reaches its terminal event; disconnects can then feed the reconnect
 * state machine instead of killing Electron.
 */
const closeWebSocketSafely = (
  socket: WebSocket,
  code?: number,
  reason?: string,
) => {
  if (socket.readyState === WEB_SOCKET_CLOSED) {
    return;
  }
  const absorbCloseError = () => undefined;
  socket.once('error', absorbCloseError);
  socket.once('close', () => {
    socket.removeListener('error', absorbCloseError);
  });
  try {
    socket.close(code, reason);
  } catch {
    try {
      socket.terminate();
    } catch {
      socket.once('error', absorbCloseError);
    }
  }
};

const closeDiscoverySocket = (socket: dgram.Socket) => {
  socket.removeAllListeners();
  try {
    socket.close();
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code?: unknown }).code
        : undefined;
    if (code !== 'ERR_SOCKET_DGRAM_NOT_RUNNING') {
      throw error;
    }
  }
};

/**
 * One encrypted, lossless PCM hub on the listening computer.
 *
 * Local certificates cannot prove which PC created them, so the WebSocket is
 * plain `ws://` and every packet inside it is authenticated and encrypted
 * with AES-256-GCM using the pairing secret. Music mode uses lossless
 * Zstandard; Video mode sends the same Float32 bits raw to remove codec delay.
 * Both travel over the reliable, ordered WebSocket with no lossy media codec.
 */
const createRemoteAudioLan = (
  emitSignal: (message: ILanRemoteAudioSignal) => void,
  emitAudio: (chunk: ILanRemoteAudioChunk) => void,
  emitError: () => void,
  emitNetwork: (stats: ILanRemoteAudioNetworkStats) => void,
): IRemoteAudioLan => {
  let server: WebSocketServer | undefined;
  let discoverySocket: dgram.Socket | undefined;
  let rejectDiscovery: ((error: Error) => void) | undefined;
  let rejectHostStart: ((error: Error) => void) | undefined;
  let pendingSocket: WebSocket | undefined;
  let lifecycleGeneration = 0;
  const usedPeerIds = new Set<string>();
  let key: Buffer | undefined;
  const transport = createRemoteAudioTransport({
    emitAudio,
    emitNetwork,
    emitSignal,
  });

  const stop = () => {
    lifecycleGeneration += 1;
    const activeServer = server;
    const activePendingSocket = pendingSocket;
    const activeDiscoverySocket = discoverySocket;
    const activeRejectDiscovery = rejectDiscovery;
    const activeRejectHostStart = rejectHostStart;
    server = undefined;
    pendingSocket = undefined;
    discoverySocket = undefined;
    rejectDiscovery = undefined;
    rejectHostStart = undefined;
    key = undefined;
    transport.closeAll();
    usedPeerIds.clear();
    // Keep the pending socket's close listener: it settles the outstanding
    // join promise from the real close event instead of from a guessed delay.
    if (activePendingSocket) {
      closeWebSocketSafely(activePendingSocket);
    }
    if (activeDiscoverySocket) {
      closeDiscoverySocket(activeDiscoverySocket);
    }
    activeRejectDiscovery?.(new Error('LAN discovery stopped.'));
    activeRejectHostStart?.(new Error('LAN listener stopped.'));
    if (activeServer) {
      activeServer.clients.forEach((client) => {
        client.removeAllListeners();
        closeWebSocketSafely(client);
      });
      activeServer.close();
    }
  };

  const startHost = async (
    credentials?: ILanHostCredentials,
  ): Promise<ILanHostSession> => {
    stop();
    const operation = lifecycleGeneration;
    const addresses = lanAddresses();
    const secret =
      credentials?.secret ?? crypto.randomBytes(32).toString('base64url');
    const deviceName = os.hostname().trim() || addresses[0] || 'FluidEQ';
    const nextKey = keyFromSecret(secret);
    const nextServer = new WebSocketServer({
      host: '0.0.0.0',
      port: credentials?.port ?? 0,
      maxPayload: MAX_PACKET_BYTES,
      perMessageDeflate: false,
    });
    server = nextServer;
    key = nextKey;
    /**
     * Connections that have not authenticated yet, oldest first, over all and
     * per address.
     *
     * A socket that never authenticates has to be let go of, or somebody on
     * the network holds the few pending slots open for good. It used to be
     * dropped five seconds after it arrived, on a timer. What actually needs
     * it gone is a newer connection wanting its slot, so that is when it
     * goes: a connection arriving to a full room makes room by closing the
     * one that has waited longest — over all, or from its own address. An
     * honest peer answers its challenge in one round trip, so it is never
     * the oldest for long; a silent one is, and is the one let go.
     */
    const pendingCandidates = new Map<WebSocket, () => void>();
    const pendingByAddress = new Map<string, Set<WebSocket>>();
    const makeRoom = (waiting: Iterable<WebSocket>) => {
      const [oldest] = waiting;
      if (oldest) {
        // Released at once, not on its close event: the newcomer is counted
        // next.
        pendingCandidates.get(oldest)?.();
        closeWebSocketSafely(
          oldest,
          1008,
          'Too many unauthenticated connections',
        );
      }
    };

    nextServer.on('connection', (candidate, request) => {
      if (lifecycleGeneration !== operation || server !== nextServer) {
        closeWebSocketSafely(candidate);
        return;
      }
      const remoteAddress = request.socket.remoteAddress?.replace(
        /^::ffff:/,
        '',
      );
      if (!remoteAddress || !isPrivateIpv4(remoteAddress)) {
        closeWebSocketSafely(
          candidate,
          1008,
          'Only private LAN connections are allowed',
        );
        return;
      }
      const fromAddress =
        pendingByAddress.get(remoteAddress) ?? new Set<WebSocket>();
      if (fromAddress.size >= MAX_PENDING_SOCKETS_PER_ADDRESS) {
        makeRoom(fromAddress);
      }
      if (pendingCandidates.size >= MAX_PENDING_SOCKETS) {
        makeRoom(pendingCandidates.keys());
      }
      fromAddress.add(candidate);
      pendingByAddress.set(remoteAddress, fromAddress);
      let isPending = true;
      const releasePending = () => {
        if (!isPending) {
          return;
        }
        isPending = false;
        pendingCandidates.delete(candidate);
        fromAddress.delete(candidate);
        if (fromAddress.size === 0) {
          pendingByAddress.delete(remoteAddress);
        }
      };
      pendingCandidates.set(candidate, releasePending);
      candidate.once('close', releasePending);
      const challenge = createAuthChallenge();
      const onPendingError = () => {
        closeWebSocketSafely(candidate, 1008, 'Authentication failed');
      };
      candidate.once('error', onPendingError);
      const authenticate = (data: RawData) => {
        try {
          const packet = openPacket(data, nextKey);
          const message =
            packet.kind === PACKET_AUTH_READY
              ? openAuthReady(packet.clear)
              : undefined;
          if (
            !message ||
            message.challenge !== challenge ||
            usedPeerIds.has(message.peerId) ||
            usedPeerIds.size >= MAX_AUTHENTICATED_SOCKETS
          ) {
            closeWebSocketSafely(candidate, 1008, 'Authentication failed');
            return;
          }
          candidate.removeListener('message', authenticate);
          const sessionKey = deriveSessionKey(
            nextKey,
            challenge,
            message.peerId,
          );
          // Reserve the peer identity before the asynchronous send callback.
          // Otherwise two simultaneous responses using the same peer ID could
          // both pass the duplicate check and race to replace one transport.
          usedPeerIds.add(message.peerId);
          candidate.once('close', () => usedPeerIds.delete(message.peerId));
          candidate.send(
            sealAuthAccepted({ challenge, peerId: message.peerId }, nextKey),
            (error) => {
              if (
                error ||
                !isPending ||
                candidate.readyState !== WEB_SOCKET_OPEN
              ) {
                closeWebSocketSafely(candidate, 1008, 'Authentication failed');
                return;
              }
              candidate.removeListener('close', releasePending);
              releasePending();
              transport.attach(message.peerId, candidate, sessionKey);
              candidate.removeListener('error', onPendingError);
              emitSignal({
                peerId: message.peerId,
                signal: {
                  kind: 'peer-ready',
                  address: remoteAddress,
                  deviceName: message.deviceName,
                },
              });
            },
          );
        } catch {
          closeWebSocketSafely(candidate, 1008, 'Authentication failed');
        }
      };
      candidate.on('message', authenticate);
      candidate.send(sealAuthChallenge(challenge, nextKey), (error) => {
        if (error) {
          closeWebSocketSafely(candidate, 1008, 'Authentication failed');
        }
      });
    });

    let port: number;
    try {
      port = await new Promise<number>((resolve, reject) => {
        const cancel = (error: Error) => {
          nextServer.removeListener('error', onError);
          nextServer.removeListener('listening', onListening);
          reject(error);
        };
        const onError = (error: Error) => {
          nextServer.removeListener('listening', onListening);
          if (rejectHostStart === cancel) {
            rejectHostStart = undefined;
          }
          reject(error);
        };
        const onListening = () => {
          nextServer.removeListener('error', onError);
          if (rejectHostStart === cancel) {
            rejectHostStart = undefined;
          }
          const address = nextServer.address();
          if (typeof address === 'string' || address === null) {
            reject(new Error('LAN server did not receive a network port.'));
            return;
          }
          resolve(address.port);
        };
        nextServer.once('error', onError);
        nextServer.once('listening', onListening);
        rejectHostStart = cancel;
      });
    } catch (error) {
      if (lifecycleGeneration === operation) {
        stop();
      }
      throw error;
    }
    if (lifecycleGeneration !== operation || server !== nextServer) {
      throw new Error('LAN listener was stopped.');
    }
    nextServer.on('error', () => {
      if (server === nextServer) {
        stop();
        emitError();
      }
    });

    const announcement = encodeDiscoveryAnnouncement(secret, port, deviceName);
    const nextDiscoverySocket = dgram.createSocket({
      type: 'udp4',
      reuseAddr: true,
    });
    discoverySocket = nextDiscoverySocket;
    nextDiscoverySocket.on('message', (data) => {
      if (!isDiscoveryQuery(data, secret)) {
        return;
      }
      nextDiscoverySocket.send(
        announcement,
        REMOTE_AUDIO_DISCOVERY_PORT,
        '255.255.255.255',
        () => undefined,
      );
    });
    nextDiscoverySocket.on('error', () => {
      // A wildcard UDP socket remains usable when an adapter disappears and
      // later returns. Closing it here permanently removed discovery after a
      // sleep or Wi-Fi change, even though the listener server stayed alive.
    });
    nextDiscoverySocket.on('close', () => {
      if (discoverySocket === nextDiscoverySocket) {
        discoverySocket = undefined;
        emitError();
      }
    });
    try {
      await new Promise<void>((resolve, reject) => {
        const cancel = (error: Error) => {
          nextDiscoverySocket.removeListener('error', onError);
          nextDiscoverySocket.removeListener('listening', onListening);
          reject(error);
        };
        const onError = (error: Error) => {
          nextDiscoverySocket.removeListener('listening', onListening);
          if (rejectHostStart === cancel) {
            rejectHostStart = undefined;
          }
          reject(error);
        };
        const onListening = () => {
          nextDiscoverySocket.removeListener('error', onError);
          if (rejectHostStart === cancel) {
            rejectHostStart = undefined;
          }
          resolve();
        };
        nextDiscoverySocket.once('error', onError);
        nextDiscoverySocket.once('listening', onListening);
        rejectHostStart = cancel;
        nextDiscoverySocket.bind(REMOTE_AUDIO_DISCOVERY_PORT);
      });
      if (
        lifecycleGeneration !== operation ||
        discoverySocket !== nextDiscoverySocket
      ) {
        throw new Error('LAN listener was stopped.');
      }
      nextDiscoverySocket.setBroadcast(true);
      nextDiscoverySocket.send(
        announcement,
        REMOTE_AUDIO_DISCOVERY_PORT,
        '255.255.255.255',
        () => undefined,
      );
    } catch (error) {
      if (lifecycleGeneration === operation) {
        stop();
      } else {
        closeDiscoverySocket(nextDiscoverySocket);
      }
      throw error;
    }

    return {
      credentials: { port, secret },
      details: {
        deviceName,
        options: addresses.map((address) => ({
          address,
          code: encodePairingCode(address, port, secret, deviceName),
          deviceName,
        })),
      },
    };
  };

  const connectPairing = async (
    pairing: ILanPairingPayload,
    operation: number,
  ): Promise<ILanRemoteComputer> => {
    if (lifecycleGeneration !== operation) {
      throw new Error('LAN connection was stopped.');
    }
    const nextKey = keyFromSecret(pairing.secret);
    const peerId = crypto.randomUUID();
    const socket = new WebSocket(`ws://${pairing.address}:${pairing.port}`, {
      perMessageDeflate: false,
      maxPayload: MAX_PACKET_BYTES,
    });
    pendingSocket = socket;
    key = nextKey;

    return new Promise<ILanRemoteComputer>((resolve, reject) => {
      let challenge: string | undefined;
      let settled = false;
      // No deadline on this end either. The join ends on the socket's own
      // close or error — a listener that is not there fails to connect, one
      // that lets it go closes it — or on `stop`, which is what cancelling
      // the pairing calls, and which closes this socket.
      const releasePendingSocket = () => {
        if (pendingSocket === socket) {
          pendingSocket = undefined;
        }
      };
      const cleanup = () => {
        socket.removeListener('close', onClose);
        socket.removeListener('error', onError);
        socket.removeListener('message', onHandshake);
        releasePendingSocket();
      };
      const finishError = (error: Error) => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup();
        reject(error);
      };
      const onClose = () => {
        finishError(new Error('LAN connection closed.'));
      };
      const onError = (error: Error) => finishError(error);
      const onHandshake = (data: RawData) => {
        try {
          const packet = openPacket(data, nextKey);
          if (!challenge) {
            if (packet.kind !== PACKET_AUTH_CHALLENGE) {
              throw new Error('LAN listener did not send a challenge.');
            }
            challenge = openAuthChallenge(packet.clear).challenge;
            socket.send(
              sealAuthReady(
                {
                  challenge,
                  deviceName: os.hostname().trim() || pairing.address,
                  peerId,
                },
                nextKey,
              ),
            );
            return;
          }
          if (packet.kind !== PACKET_AUTH_ACCEPTED) {
            throw new Error('LAN listener did not accept authentication.');
          }
          const accepted = openAuthAccepted(packet.clear);
          if (accepted.challenge !== challenge || accepted.peerId !== peerId) {
            throw new Error('LAN authentication acknowledgement changed.');
          }
          if (lifecycleGeneration !== operation) {
            throw new Error('LAN connection was stopped.');
          }
          settled = true;
          cleanup();
          const sessionKey = deriveSessionKey(nextKey, challenge, peerId);
          transport.attach(peerId, socket, sessionKey);
          const ready: ILanRemoteAudioSignal = {
            peerId,
            signal: {
              kind: 'peer-ready',
              deviceName: os.hostname().trim() || pairing.address,
            },
          };
          emitSignal(ready);
          resolve({
            address: pairing.address,
            deviceName: pairing.deviceName,
            peerId,
          });
        } catch (error) {
          finishError(
            error instanceof Error
              ? error
              : new Error('LAN authentication failed.'),
          );
          closeWebSocketSafely(socket, 1008, 'Authentication failed');
        }
      };
      socket.once('error', onError);
      socket.once('close', onClose);
      socket.on('message', onHandshake);
    });
  };

  const restoreJoin = async (code: unknown): Promise<ILanRemoteComputer> => {
    stop();
    const operation = lifecycleGeneration;
    const savedPairing = decodePairingCode(code);
    try {
      return await connectPairing(savedPairing, operation);
    } catch (error) {
      if (lifecycleGeneration !== operation) {
        throw error;
      }
      // A saved address can change between launches. The authenticated
      // discovery exchange below finds only the listener holding this pairing
      // secret, so reconnect does not fall back to trusting a machine name.
    }

    if (lifecycleGeneration !== operation) {
      throw new Error('LAN connection was stopped.');
    }
    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    discoverySocket = socket;
    return new Promise<ILanRemoteComputer>((resolve, reject) => {
      let connecting = false;
      let settled = false;
      const finish = (
        outcome:
          | { computer: ILanRemoteComputer; error?: never }
          | { computer?: never; error: Error },
      ) => {
        if (settled) {
          return;
        }
        settled = true;
        if (discoverySocket === socket) {
          discoverySocket = undefined;
        }
        rejectDiscovery = undefined;
        closeDiscoverySocket(socket);
        if (outcome.computer) {
          resolve(outcome.computer);
        } else {
          reject(outcome.error);
        }
      };
      rejectDiscovery = (error) => finish({ error });
      /**
       * Asks the network who is listening, a few times over, and then waits.
       *
       * It used to ask again on a backoff — 0, 1, 2 then 5 seconds — which is
       * a `setTimeout` retrying until something is ready, and this project
       * allows neither. Taking it out costs nothing, because there are two
       * ways a listener is found and the clock was never either of them:
       *
       *  - A listener ALREADY running answers this query. A datagram can be
       *    dropped, so it goes out `DISCOVERY_QUERIES` times, each sent when
       *    the last one has actually left the socket — the send callback,
       *    which is the I/O completing rather than a guess at how long it
       *    takes.
       *  - A listener that starts LATER broadcasts an announcement of its own
       *    the moment it is up (`startHost`), and this socket is bound to the
       *    discovery port listening for exactly that. Nothing has to ask
       *    again for it to be heard.
       *
       * So the wait after the queries is not idle: it is a socket waiting on
       * a message that arrives by itself. What bounds it is the caller, which
       * is the same place that decides to stop looking.
       */
      const askWhoIsThere = (asked = 0) => {
        if (settled || connecting || lifecycleGeneration !== operation) {
          return;
        }
        if (asked >= DISCOVERY_QUERIES) {
          return;
        }
        try {
          socket.send(
            encodeDiscoveryQuery(savedPairing.secret),
            REMOTE_AUDIO_DISCOVERY_PORT,
            '255.255.255.255',
            () => askWhoIsThere(asked + 1),
          );
        } catch {
          // The adapter went away mid-send. A listener coming up later still
          // announces itself, and this socket is still listening for it.
        }
      };
      socket.on('message', (data, sender) => {
        const announcement = decodeDiscoveryAnnouncement(
          data,
          savedPairing.secret,
        );
        if (connecting || !announcement || !isPrivateIpv4(sender.address)) {
          return;
        }
        connecting = true;
        connectPairing(
          {
            address: sender.address,
            deviceName: announcement.deviceName,
            port: announcement.port,
            secret: savedPairing.secret,
          },
          operation,
        )
          .then((computer) => finish({ computer }))
          .catch(() => {
            connecting = false;
            askWhoIsThere();
          });
      });
      socket.on('error', () => {
        // Network adapters can disappear during sleep or boot. Keep the
        // durable pairing alive and let the next backoff tick try again.
        askWhoIsThere();
      });
      socket.once('listening', () => {
        socket.setBroadcast(true);
        askWhoIsThere();
      });
      socket.bind(REMOTE_AUDIO_DISCOVERY_PORT);
    });
  };

  const sendSignal = (value: unknown) => {
    if (!key || !isLanRemoteAudioSignal(value)) {
      throw new Error('Invalid remote audio control message.');
    }
    transport.sendSignal(value);
  };

  const sendAudio = (value: unknown) => {
    if (!key) {
      throw new Error('The LAN audio connection is not ready.');
    }
    transport.sendAudio(value);
  };

  const setStreamMode = (peerId: string, mode: 'music' | 'video') =>
    transport.setStreamMode(peerId, mode);

  return {
    startHost,
    restoreJoin,
    sendSignal,
    sendAudio,
    setStreamMode,
    stop,
  };
};

export default createRemoteAudioLan;
