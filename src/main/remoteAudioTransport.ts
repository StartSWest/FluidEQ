/* FluidEQ — GPL-3.0-or-later */

import { WebSocket, type RawData } from 'ws';
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
  encodeAudioAsync,
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

const createRemoteAudioTransport = ({
  emitAudio,
  emitNetwork,
  emitSignal,
}: IRemoteAudioTransportOptions) => {
  const sockets = new Map<string, WebSocket>();
  const encodeQueues = new Map<string, Promise<void>>();
  const decodeQueues = new Map<string, Promise<void>>();
  const pendingEncodeMilliseconds = new Map<string, number>();
  const streamModes = new Map<string, TRemoteAudioStreamMode>();
  const networkMeter = createRemoteAudioNetworkMeter(emitNetwork);
  let generation = 0;
  let stopping = false;

  const attach = (peerId: string, socket: WebSocket, socketKey: Buffer) => {
    sockets.set(peerId, socket);
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
        const activeGeneration = generation;
        const previous = decodeQueues.get(peerId) ?? Promise.resolve();
        const queued = previous.then(async () => {
          const chunk = await decodeAudioAsync(peerId, packet.clear);
          if (
            generation === activeGeneration &&
            sockets.get(peerId) === socket
          ) {
            emitAudio(chunk);
          }
          return undefined;
        });
        decodeQueues.set(peerId, queued);
        queued
          .catch(() => socket.close(1008, 'Invalid encrypted packet'))
          .finally(() => {
            if (decodeQueues.get(peerId) === queued) {
              decodeQueues.delete(peerId);
            }
          });
      } catch {
        socket.close(1008, 'Invalid encrypted packet');
      }
    });
    const closed = () => {
      if (sockets.get(peerId) === socket) {
        sockets.delete(peerId);
        pendingEncodeMilliseconds.delete(peerId);
        streamModes.delete(peerId);
        if (!stopping) {
          emitSignal({ peerId, signal: { kind: 'stop' } });
        }
      }
    };
    socket.on('close', closed);
    socket.on('error', closed);
  };

  const sendAudio = (value: unknown, socketKey: Buffer) => {
    const chunk = normalizeAudioChunk(value);
    const socket = sockets.get(chunk.peerId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('That LAN computer is not connected.');
    }
    const activeGeneration = generation;
    const chunkMilliseconds = (chunk.frames / chunk.sampleRate) * 1_000;
    const pendingMilliseconds =
      (pendingEncodeMilliseconds.get(chunk.peerId) ?? 0) + chunkMilliseconds;
    pendingEncodeMilliseconds.set(chunk.peerId, pendingMilliseconds);
    const previous = encodeQueues.get(chunk.peerId) ?? Promise.resolve();
    const queued = previous.then(async () => {
      const packet = sealPacket(
        PACKET_AUDIO,
        await encodeAudioAsync(
          chunk,
          streamModes.get(chunk.peerId) !== 'video',
        ),
        socketKey,
      );
      const remainingMilliseconds = Math.max(
        0,
        (pendingEncodeMilliseconds.get(chunk.peerId) ?? 0) - chunkMilliseconds,
      );
      pendingEncodeMilliseconds.set(chunk.peerId, remainingMilliseconds);
      if (
        generation !== activeGeneration ||
        sockets.get(chunk.peerId) !== socket ||
        socket.readyState !== WebSocket.OPEN
      ) {
        return undefined;
      }
      const queuedBytes = socket.bufferedAmount;
      socket.send(packet);
      networkMeter.record(
        chunk.peerId,
        'send',
        packet.byteLength,
        queuedBytes,
        remainingMilliseconds,
      );
      return undefined;
    });
    encodeQueues.set(chunk.peerId, queued);
    queued
      .catch(() => socket.close(1011, 'Audio transport failed'))
      .finally(() => {
        if (encodeQueues.get(chunk.peerId) === queued) {
          encodeQueues.delete(chunk.peerId);
        }
      });
  };

  const sendSignal = (message: ILanRemoteAudioSignal, socketKey: Buffer) => {
    const socket = sockets.get(message.peerId);
    if (!socket || socket.readyState !== WebSocket.OPEN) {
      throw new Error('That LAN computer is not connected.');
    }
    socket.send(sealSignal(message, socketKey));
  };

  const closeAll = () => {
    generation += 1;
    stopping = true;
    sockets.forEach((socket) => {
      socket.removeAllListeners();
      socket.close();
    });
    sockets.clear();
    encodeQueues.clear();
    decodeQueues.clear();
    pendingEncodeMilliseconds.clear();
    streamModes.clear();
    networkMeter.clear();
    stopping = false;
  };

  return {
    attach,
    closeAll,
    has: (peerId: string) => sockets.has(peerId),
    sendAudio,
    sendSignal,
    setStreamMode: (peerId: string, mode: TRemoteAudioStreamMode) => {
      streamModes.set(peerId, mode);
    },
    size: () => sockets.size,
  };
};

export default createRemoteAudioTransport;
