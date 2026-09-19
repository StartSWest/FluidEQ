/* FluidEQ — GPL-3.0-or-later */

import type WebSocket from 'ws';
import type { RawData } from 'ws';
import type {
  ILanRemoteAudioChunk,
  ILanRemoteAudioNetworkStats,
  ILanRemoteAudioSignal,
  TRemoteAudioStreamMode,
} from '../common/remoteAudio';
import {
  PACKET_AUDIO,
  PACKET_SIGNAL,
  decodeAudioAsync,
  encodeAudioRaw,
  normalizeAudioChunk,
  openPacket,
  openSignal,
  sealPacket,
  sealSignal,
} from './remoteAudioLanProtocol';
import createRemoteAudioNetworkMeter from './remoteAudioNetworkMeter';

interface IRemoteAudioTransportOptions {
  emitAudio(chunk: ILanRemoteAudioChunk): void;
  emitNetwork(stats: ILanRemoteAudioNetworkStats): void;
  emitSignal(message: ILanRemoteAudioSignal): void;
}

const WEB_SOCKET_OPEN = 1;

const createRemoteAudioTransport = ({
  emitAudio,
  emitNetwork,
  emitSignal,
}: IRemoteAudioTransportOptions) => {
  const sockets = new Map<string, { key: Buffer; socket: WebSocket }>();
  const decodeQueues = new Map<string, Promise<void>>();
  const pendingDecodeBytes = new Map<string, number>();
  const networkMeter = createRemoteAudioNetworkMeter(emitNetwork);
  let generation = 0;
  let stopping = false;
  const MAX_PENDING_DECODE_BYTES = 8 * 1024 * 1024;
  const MAX_SOCKET_BUFFER_BYTES = 256 * 1024;

  const attach = (peerId: string, socket: WebSocket, socketKey: Buffer) => {
    sockets.set(peerId, { key: socketKey, socket });
    socket.on('message', (data: RawData) => {
      try {
        const receivedBytes = Array.isArray(data)
          ? data.reduce((total, part) => total + part.byteLength, 0)
          : data.byteLength;
        networkMeter.record(peerId, 'receive', receivedBytes, 0);
        const packet = openPacket(data, socketKey);
        if (packet.kind === PACKET_SIGNAL) {
          const message = openSignal(packet.clear);
          if (message.peerId !== peerId) {
            throw new Error('Peer identity changed.');
          }
          emitSignal(message);
          return;
        }
        if (packet.kind !== PACKET_AUDIO) {
          throw new Error('Unexpected LAN packet after authentication.');
        }
        const nextPendingDecodeBytes =
          (pendingDecodeBytes.get(peerId) ?? 0) + packet.clear.byteLength;
        if (nextPendingDecodeBytes > MAX_PENDING_DECODE_BYTES) {
          socket.close(1013, 'Audio receiver is overloaded');
          return;
        }
        pendingDecodeBytes.set(peerId, nextPendingDecodeBytes);
        const activeGeneration = generation;
        const previous = decodeQueues.get(peerId) ?? Promise.resolve();
        const queued = previous.then(async () => {
          const chunk = await decodeAudioAsync(peerId, packet.clear);
          if (
            generation === activeGeneration &&
            sockets.get(peerId)?.socket === socket
          ) {
            emitAudio(chunk);
          }
          return undefined;
        });
        decodeQueues.set(peerId, queued);
        queued
          .catch(() => socket.close(1008, 'Invalid encrypted packet'))
          .finally(() => {
            const remainingBytes = Math.max(
              0,
              (pendingDecodeBytes.get(peerId) ?? 0) - packet.clear.byteLength,
            );
            if (remainingBytes === 0) {
              pendingDecodeBytes.delete(peerId);
            } else {
              pendingDecodeBytes.set(peerId, remainingBytes);
            }
            if (decodeQueues.get(peerId) === queued) {
              decodeQueues.delete(peerId);
            }
          });
      } catch {
        socket.close(1008, 'Invalid encrypted packet');
      }
    });
    const closed = () => {
      if (sockets.get(peerId)?.socket === socket) {
        sockets.delete(peerId);
        pendingDecodeBytes.delete(peerId);
        if (!stopping) {
          emitSignal({ peerId, signal: { kind: 'stop' } });
        }
      }
    };
    socket.on('close', closed);
    socket.on('error', closed);
  };

  const sendAudio = (value: unknown) => {
    const chunk = normalizeAudioChunk(value);
    const connection = sockets.get(chunk.peerId);
    if (!connection || connection.socket.readyState !== WEB_SOCKET_OPEN) {
      throw new Error('That LAN computer is not connected.');
    }
    const { socket } = connection;
    // Capture already supplies float PCM. Always send it immediately; a sound
    // preset or a legacy Music/Video selection must not add an encoder queue.
    const queuedBytes = socket.bufferedAmount;
    if (queuedBytes > MAX_SOCKET_BUFFER_BYTES) {
      socket.close(1013, 'Network send buffer is overloaded');
      return;
    }
    const packet = sealPacket(
      PACKET_AUDIO,
      encodeAudioRaw(chunk),
      connection.key,
    );
    socket.send(packet);
    networkMeter.record(chunk.peerId, 'send', packet.byteLength, queuedBytes);
  };

  const sendSignal = (message: ILanRemoteAudioSignal) => {
    const connection = sockets.get(message.peerId);
    const socket = connection?.socket;
    if (!socket || socket.readyState !== WEB_SOCKET_OPEN) {
      throw new Error('That LAN computer is not connected.');
    }
    socket.send(sealSignal(message, connection.key));
  };

  const closeAll = () => {
    generation += 1;
    stopping = true;
    sockets.forEach(({ socket }) => {
      socket.removeAllListeners();
      socket.close();
    });
    sockets.clear();
    decodeQueues.clear();
    pendingDecodeBytes.clear();
    networkMeter.clear();
    stopping = false;
  };

  return {
    attach,
    closeAll,
    has: (peerId: string) => sockets.has(peerId),
    sendAudio,
    sendSignal,
    // Retained for older peers; sending always uses the raw low-delay path.
    setStreamMode: (_peerId: string, _mode: TRemoteAudioStreamMode) =>
      undefined,
    size: () => sockets.size,
  };
};

export default createRemoteAudioTransport;
