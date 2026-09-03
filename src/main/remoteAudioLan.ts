/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import crypto from 'crypto';
import { WebSocket, WebSocketServer, type RawData } from 'ws';
import {
  ILanHostDetails,
  ILanRemoteAudioChunk,
  ILanRemoteAudioSignal,
  isLanRemoteAudioSignal,
} from '../common/remoteAudio';
import {
  MAX_PACKET_BYTES,
  PACKET_AUDIO,
  PACKET_SIGNAL,
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

const MAX_PENDING_SOCKETS = 64;

export interface IRemoteAudioLan {
  startHost(): Promise<ILanHostDetails>;
  join(code: unknown): Promise<void>;
  sendSignal(message: unknown): void;
  sendAudio(chunk: unknown): void;
  stop(): void;
}

/**
 * One encrypted, lossless PCM hub on the listening computer.
 *
 * Local certificates cannot prove which PC created them, so the WebSocket is
 * plain `ws://` and every packet inside it is authenticated and encrypted
 * with AES-256-GCM using the pairing secret. Audio is raw Float32 PCM over the
 * reliable, ordered WebSocket; there is no media codec and no packet dropping.
 */
export const createRemoteAudioLan = (
  emitSignal: (message: ILanRemoteAudioSignal) => void,
  emitAudio: (chunk: ILanRemoteAudioChunk) => void,
  emitError: () => void,
): IRemoteAudioLan => {
  let server: WebSocketServer | undefined;
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
    server = undefined;
    pendingSocket = undefined;
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
    if (activeServer) {
      activeServer.clients.forEach((client) => {
        client.removeAllListeners();
        client.close();
      });
      activeServer.close();
    }
    isStopping = false;
  };

  const startHost = async (): Promise<ILanHostDetails> => {
    stop();
    const addresses = lanAddresses();
    if (addresses.length === 0) {
      throw new Error('No private IPv4 network is available.');
    }
    const secret = crypto.randomBytes(32).toString('base64url');
    const nextKey = keyFromSecret(secret);
    const nextServer = new WebSocketServer({
      host: '0.0.0.0',
      port: 0,
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
          emitSignal(message);
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

    return {
      options: addresses.map((address) => ({
        address,
        code: encodePairingCode(address, port, secret),
      })),
    };
  };

  const join = async (code: unknown): Promise<void> => {
    stop();
    const pairing = decodePairingCode(code);
    const nextKey = keyFromSecret(pairing.secret);
    const peerId = crypto.randomUUID();
    const socket = new WebSocket(`ws://${pairing.address}:${pairing.port}`, {
      perMessageDeflate: false,
      maxPayload: MAX_PACKET_BYTES,
    });
    pendingSocket = socket;
    key = nextKey;

    await new Promise<void>((resolve, reject) => {
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
          signal: { kind: 'peer-ready' },
        };
        socket.send(sealSignal(ready, nextKey));
        emitSignal(ready);
        resolve();
      };
      socket.once('error', onError);
      socket.once('close', onClose);
      socket.once('open', onOpen);
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

  return { startHost, join, sendSignal, sendAudio, stop };
};
