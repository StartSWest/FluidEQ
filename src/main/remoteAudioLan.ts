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
const AUTHENTICATION_TIMEOUT_MS = 5_000;
const DISCOVERY_RETRY_DELAYS_MS = [0, 1_000, 2_000, 5_000] as const;
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
  let discoveryRetryTimer: NodeJS.Timeout | undefined;
  let rejectDiscovery: ((error: Error) => void) | undefined;
  let pendingSocket: WebSocket | undefined;
  const usedPeerIds = new Set<string>();
  let key: Buffer | undefined;
  const transport = createRemoteAudioTransport({
    emitAudio,
    emitNetwork,
    emitSignal,
  });

  const stop = () => {
    const activeServer = server;
    const activePendingSocket = pendingSocket;
    const activeDiscoverySocket = discoverySocket;
    const activeDiscoveryRetryTimer = discoveryRetryTimer;
    const activeRejectDiscovery = rejectDiscovery;
    server = undefined;
    pendingSocket = undefined;
    discoverySocket = undefined;
    discoveryRetryTimer = undefined;
    rejectDiscovery = undefined;
    key = undefined;
    transport.closeAll();
    usedPeerIds.clear();
    // Keep the pending socket's close listener: it settles the outstanding
    // join promise from the real close event instead of from a guessed delay.
    if (activePendingSocket) {
      closeWebSocketSafely(activePendingSocket);
    }
    if (activeDiscoveryRetryTimer) {
      clearTimeout(activeDiscoveryRetryTimer);
    }
    if (activeDiscoverySocket) {
      closeDiscoverySocket(activeDiscoverySocket);
    }
    activeRejectDiscovery?.(new Error('LAN discovery stopped.'));
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
    const pendingSocketsByAddress = new Map<string, number>();

    nextServer.on('connection', (candidate, request) => {
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
      if (nextServer.clients.size - transport.size() > MAX_PENDING_SOCKETS) {
        closeWebSocketSafely(
          candidate,
          1008,
          'Too many unauthenticated connections',
        );
        return;
      }
      const pendingForAddress = pendingSocketsByAddress.get(remoteAddress) ?? 0;
      if (pendingForAddress >= MAX_PENDING_SOCKETS_PER_ADDRESS) {
        closeWebSocketSafely(
          candidate,
          1008,
          'Too many unauthenticated connections',
        );
        return;
      }
      pendingSocketsByAddress.set(remoteAddress, pendingForAddress + 1);
      let isPending = true;
      const releasePending = () => {
        if (!isPending) {
          return;
        }
        isPending = false;
        const remaining = (pendingSocketsByAddress.get(remoteAddress) ?? 1) - 1;
        if (remaining > 0) {
          pendingSocketsByAddress.set(remoteAddress, remaining);
        } else {
          pendingSocketsByAddress.delete(remoteAddress);
        }
      };
      candidate.once('close', releasePending);
      const challenge = createAuthChallenge();
      const authenticationTimer = setTimeout(() => {
        closeWebSocketSafely(candidate, 1008, 'Authentication timed out');
      }, AUTHENTICATION_TIMEOUT_MS);
      candidate.once('close', () => clearTimeout(authenticationTimer));
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
            usedPeerIds.has(message.peerId)
          ) {
            closeWebSocketSafely(candidate, 1008, 'Authentication failed');
            return;
          }
          candidate.removeListener('error', onPendingError);
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
              if (error) {
                closeWebSocketSafely(candidate, 1008, 'Authentication failed');
                return;
              }
              candidate.removeListener('close', releasePending);
              clearTimeout(authenticationTimer);
              releasePending();
              transport.attach(message.peerId, candidate, sessionKey);
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
        const onError = (error: Error) => {
          nextServer.removeListener('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          nextServer.removeListener('error', onError);
          const address = nextServer.address();
          if (typeof address === 'string' || address === null) {
            reject(new Error('LAN server did not receive a network port.'));
            return;
          }
          resolve(address.port);
        };
        nextServer.once('error', onError);
        nextServer.once('listening', onListening);
      });
    } catch (error) {
      stop();
      throw error;
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
    try {
      await new Promise<void>((resolve, reject) => {
        const onError = (error: Error) => {
          nextDiscoverySocket.removeListener('listening', onListening);
          reject(error);
        };
        const onListening = () => {
          nextDiscoverySocket.removeListener('error', onError);
          resolve();
        };
        nextDiscoverySocket.once('error', onError);
        nextDiscoverySocket.once('listening', onListening);
        nextDiscoverySocket.bind(REMOTE_AUDIO_DISCOVERY_PORT);
      });
      nextDiscoverySocket.setBroadcast(true);
      nextDiscoverySocket.send(
        announcement,
        REMOTE_AUDIO_DISCOVERY_PORT,
        '255.255.255.255',
        () => undefined,
      );
    } catch (error) {
      stop();
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
  ): Promise<ILanRemoteComputer> => {
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
      const authenticationTimer = setTimeout(() => {
        finishError(new Error('LAN authentication timed out.'));
        closeWebSocketSafely(socket, 1008, 'Authentication timed out');
      }, AUTHENTICATION_TIMEOUT_MS);
      const releasePendingSocket = () => {
        if (pendingSocket === socket) {
          pendingSocket = undefined;
        }
      };
      const cleanup = () => {
        clearTimeout(authenticationTimer);
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

  const join = async (code: unknown): Promise<ILanRemoteComputer> => {
    stop();
    return connectPairing(decodePairingCode(code));
  };

  const restoreJoin = async (code: unknown): Promise<ILanRemoteComputer> => {
    stop();
    const savedPairing = decodePairingCode(code);
    try {
      return await connectPairing(savedPairing);
    } catch {
      // A saved address can change between launches. The authenticated
      // discovery exchange below finds only the listener holding this pairing
      // secret, so reconnect does not fall back to trusting a machine name.
    }

    const socket = dgram.createSocket({ type: 'udp4', reuseAddr: true });
    discoverySocket = socket;
    return new Promise<ILanRemoteComputer>((resolve, reject) => {
      let connecting = false;
      let settled = false;
      let discoveryAttempt = 0;
      const finish = (
        outcome:
          | { computer: ILanRemoteComputer; error?: never }
          | { computer?: never; error: Error },
      ) => {
        if (settled) {
          return;
        }
        settled = true;
        if (discoveryRetryTimer) {
          clearTimeout(discoveryRetryTimer);
          discoveryRetryTimer = undefined;
        }
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
      const scheduleQuery = () => {
        if (settled || discoveryRetryTimer) {
          return;
        }
        const delay =
          DISCOVERY_RETRY_DELAYS_MS[
            Math.min(discoveryAttempt, DISCOVERY_RETRY_DELAYS_MS.length - 1)
          ];
        discoveryAttempt += 1;
        discoveryRetryTimer = setTimeout(() => {
          discoveryRetryTimer = undefined;
          if (settled || connecting) {
            scheduleQuery();
            return;
          }
          try {
            socket.send(
              encodeDiscoveryQuery(savedPairing.secret),
              REMOTE_AUDIO_DISCOVERY_PORT,
              '255.255.255.255',
              () => scheduleQuery(),
            );
          } catch {
            scheduleQuery();
          }
        }, delay);
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
        connectPairing({
          address: sender.address,
          deviceName: announcement.deviceName,
          port: announcement.port,
          secret: savedPairing.secret,
        })
          .then((computer) => finish({ computer }))
          .catch(() => {
            connecting = false;
            scheduleQuery();
          });
      });
      socket.on('error', () => {
        // Network adapters can disappear during sleep or boot. Keep the
        // durable pairing alive and let the next backoff tick try again.
        scheduleQuery();
      });
      socket.once('listening', () => {
        socket.setBroadcast(true);
        scheduleQuery();
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
    join,
    restoreJoin,
    sendSignal,
    sendAudio,
    setStreamMode,
    stop,
  };
};

export default createRemoteAudioLan;
