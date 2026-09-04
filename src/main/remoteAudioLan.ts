/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import crypto from 'crypto';
import dgram from 'dgram';
import os from 'os';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import {
  ILanHostDetails,
  ILanRemoteComputer,
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
  isLanRemoteAudioSignal,
} from '../common/remoteAudio';
import {
  MAX_PACKET_BYTES,
  PACKET_AUDIO,
  PACKET_SIGNAL,
  type ILanPairingPayload,
  decodeAudio,
  decodePairingCode,
  encodeAudio,
  encodePairingCode,
  isPrivateIpv4,
  keyFromSecret,
  lanAddresses,
  normalizeAudioChunk,
  openPacket,
  openSignal,
  sealPacket,
  sealSignal,
} from './remoteAudioLanProtocol';
import {
  REMOTE_AUDIO_DISCOVERY_PORT,
  decodeDiscoveryAnnouncement,
  encodeDiscoveryAnnouncement,
  encodeDiscoveryQuery,
  isDiscoveryQuery,
} from './remoteAudioDiscovery';

const MAX_PENDING_SOCKETS = 64;

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

export interface IRemoteAudioLan {
  startHost(credentials?: ILanHostCredentials): Promise<ILanHostSession>;
  join(code: unknown): Promise<ILanRemoteComputer>;
  restoreJoin(code: unknown): Promise<ILanRemoteComputer>;
  sendSignal(message: unknown): void;
  sendAudio(chunk: unknown): void;
  stop(): void;
}

export interface ILanHostCredentials {
  port: number;
  secret: string;
}

export interface ILanHostSession {
  credentials: ILanHostCredentials;
  details: ILanHostDetails;
}

/**
 * One encrypted, lossless PCM hub on the listening computer.
 *
 * Local certificates cannot prove which PC created them, so the WebSocket is
 * plain `ws://` and every packet inside it is authenticated and encrypted
 * with AES-256-GCM using the pairing secret. Audio is lossless Zstandard
 * compressed Float32 PCM over the reliable, ordered WebSocket; there is no
 * lossy media codec and no packet dropping.
 */
export const createRemoteAudioLan = (
  emitSignal: (message: ILanRemoteAudioSignal) => void,
  emitAudio: (chunk: ILanRemoteAudioChunk) => void,
  emitError: () => void,
): IRemoteAudioLan => {
  let server: WebSocketServer | undefined;
  let discoverySocket: dgram.Socket | undefined;
  let rejectDiscovery: ((error: Error) => void) | undefined;
  let pendingSocket: WebSocket | undefined;
  const sockets = new Map<string, WebSocket>();
  const usedPeerIds = new Set<string>();
  let key: Buffer | undefined;
  let isStopping = false;

  const attachSocket = (
    peerId: string,
    socket: WebSocket,
    socketKey: Buffer,
  ) => {
    sockets.set(peerId, socket);
    socket.on('message', (data) => {
      try {
        const packet = openPacket(data, socketKey);
        if (packet.kind === PACKET_SIGNAL) {
          const message = openSignal(packet.clear);
          if (message.peerId !== peerId) {
            throw new Error('Peer identity changed.');
          }
          emitSignal(message);
        } else {
          emitAudio(decodeAudio(peerId, packet.clear));
        }
      } catch {
        socket.close(1008, 'Invalid encrypted packet');
      }
    });
    const closed = () => {
      if (sockets.get(peerId) === socket) {
        sockets.delete(peerId);
        if (!isStopping) {
          emitSignal({ peerId, signal: { kind: 'stop' } });
        }
      }
    };
    socket.on('close', closed);
    socket.on('error', closed);
  };

  const stop = () => {
    isStopping = true;
    const activeServer = server;
    const activePendingSocket = pendingSocket;
    const activeDiscoverySocket = discoverySocket;
    const activeRejectDiscovery = rejectDiscovery;
    server = undefined;
    pendingSocket = undefined;
    discoverySocket = undefined;
    rejectDiscovery = undefined;
    key = undefined;
    sockets.forEach((socket) => {
      socket.removeAllListeners();
      socket.close();
    });
    sockets.clear();
    usedPeerIds.clear();
    // Keep the pending socket's close listener: it settles the outstanding
    // join promise from the real close event instead of from a guessed delay.
    activePendingSocket?.close();
    if (activeDiscoverySocket) {
      closeDiscoverySocket(activeDiscoverySocket);
    }
    activeRejectDiscovery?.(new Error('LAN discovery stopped.'));
    if (activeServer) {
      activeServer.clients.forEach((client) => {
        client.removeAllListeners();
        client.close();
      });
      activeServer.close();
    }
    isStopping = false;
  };

  const startHost = async (
    credentials?: ILanHostCredentials,
  ): Promise<ILanHostSession> => {
    stop();
    const addresses = lanAddresses();
    if (addresses.length === 0) {
      throw new Error('No private IPv4 network is available.');
    }
    const secret =
      credentials?.secret ?? crypto.randomBytes(32).toString('base64url');
    const deviceName = os.hostname().trim() || addresses[0];
    const nextKey = keyFromSecret(secret);
    const nextServer = new WebSocketServer({
      host: '0.0.0.0',
      port: credentials?.port ?? 0,
      maxPayload: MAX_PACKET_BYTES,
      perMessageDeflate: false,
    });
    server = nextServer;
    key = nextKey;

    nextServer.on('connection', (candidate, request) => {
      const remoteAddress = request.socket.remoteAddress?.replace(
        /^::ffff:/,
        '',
      );
      if (!remoteAddress || !isPrivateIpv4(remoteAddress)) {
        candidate.close(1008, 'Only private LAN connections are allowed');
        return;
      }
      if (nextServer.clients.size - sockets.size > MAX_PENDING_SOCKETS) {
        candidate.close(1008, 'Too many unauthenticated connections');
        return;
      }
      const onPendingError = () => {
        candidate.close(1008, 'Authentication failed');
      };
      candidate.once('error', onPendingError);
      const authenticate = (data: RawData) => {
        try {
          const packet = openPacket(data, nextKey);
          const message =
            packet.kind === PACKET_SIGNAL
              ? openSignal(packet.clear)
              : undefined;
          if (
            message?.signal.kind !== 'peer-ready' ||
            usedPeerIds.has(message.peerId)
          ) {
            candidate.close(1008, 'Authentication failed');
            return;
          }
          candidate.removeListener('error', onPendingError);
          candidate.removeListener('message', authenticate);
          usedPeerIds.add(message.peerId);
          attachSocket(message.peerId, candidate, nextKey);
          emitSignal({
            ...message,
            signal: { ...message.signal, address: remoteAddress },
          });
        } catch {
          candidate.close(1008, 'Authentication failed');
        }
      };
      candidate.on('message', authenticate);
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
      if (discoverySocket === nextDiscoverySocket) {
        discoverySocket = undefined;
        closeDiscoverySocket(nextDiscoverySocket);
      }
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
      const releasePendingSocket = () => {
        if (pendingSocket === socket) {
          pendingSocket = undefined;
        }
      };
      const onError = (error: Error) => {
        socket.removeListener('open', onOpen);
        socket.removeListener('close', onClose);
        releasePendingSocket();
        reject(error);
      };
      const onClose = () => {
        onError(new Error('LAN connection closed.'));
      };
      const onOpen = () => {
        socket.removeListener('error', onError);
        socket.removeListener('close', onClose);
        releasePendingSocket();
        attachSocket(peerId, socket, nextKey);
        const ready: ILanRemoteAudioSignal = {
          peerId,
          signal: {
            kind: 'peer-ready',
            deviceName: os.hostname().trim() || pairing.address,
          },
        };
        socket.send(sealSignal(ready, nextKey));
        emitSignal(ready);
        resolve({
          address: pairing.address,
          deviceName: pairing.deviceName,
          peerId,
        });
      };
      socket.once('error', onError);
      socket.once('close', onClose);
      socket.once('open', onOpen);
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
          });
      });
      socket.once('error', (error) => finish({ error }));
      socket.once('listening', () => {
        socket.setBroadcast(true);
        socket.send(
          encodeDiscoveryQuery(savedPairing.secret),
          REMOTE_AUDIO_DISCOVERY_PORT,
          '255.255.255.255',
          (error) => {
            if (error) {
              finish({ error });
            }
          },
        );
      });
      socket.bind(REMOTE_AUDIO_DISCOVERY_PORT);
    });
  };

  const sendSignal = (value: unknown) => {
    if (!key || !isLanRemoteAudioSignal(value)) {
      throw new Error('Invalid remote audio control message.');
    }
    const socket = sockets.get(value.peerId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('That LAN computer is not connected.');
    }
    socket.send(sealSignal(value, key));
  };

  const sendAudio = (value: unknown) => {
    if (!key) {
      throw new Error('The LAN audio connection is not ready.');
    }
    const chunk = normalizeAudioChunk(value);
    const socket = sockets.get(chunk.peerId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('That LAN computer is not connected.');
    }
    socket.send(sealPacket(PACKET_AUDIO, encodeAudio(chunk), key));
  };

  return { startHost, join, restoreJoin, sendSignal, sendAudio, stop };
};
