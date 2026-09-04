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
  encodeAudioAsync,
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
  const encodeQueues = new Map<string, Promise<void>>();
  const decodeQueues = new Map<string, Promise<void>>();
  const pendingDecodeBytes = new Map<string, number>();
  const pendingEncodeMilliseconds = new Map<string, number>();
  const streamModes = new Map<string, TRemoteAudioStreamMode>();
  const networkMeter = createRemoteAudioNetworkMeter(emitNetwork);
  let generation = 0;
  let stopping = false;
  const MAX_PENDING_DECODE_BYTES = 8 * 1024 * 1024;
  const MAX_SOCKET_BUFFER_BYTES = {
    music: 2 * 1024 * 1024,
    video: 256 * 1024,
  } as const;
  const MAX_PENDING_ENCODE_MILLISECONDS = {
    music: 750,
    video: 150,
  } as const;

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

  const sendAudio = (value: unknown) => {
    const chunk = normalizeAudioChunk(value);
    const connection = sockets.get(chunk.peerId);
    if (!connection || connection.socket.readyState !== WEB_SOCKET_OPEN) {
      throw new Error('That LAN computer is not connected.');
    }
    const { socket } = connection;
    const activeGeneration = generation;
    const streamMode = streamModes.get(chunk.peerId) ?? 'music';
    // Raw PCM has no asynchronous encoder. Queuing it behind resolved promises
    // made a single 160 ms pipe read close an otherwise empty, healthy socket.
    if (streamMode === 'video' && !encodeQueues.has(chunk.peerId)) {
      const queuedBytes = socket.bufferedAmount;
      if (queuedBytes > MAX_SOCKET_BUFFER_BYTES.video) {
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
      return;
    }
    const chunkMilliseconds = (chunk.frames / chunk.sampleRate) * 1_000;
    const pendingMilliseconds =
      (pendingEncodeMilliseconds.get(chunk.peerId) ?? 0) + chunkMilliseconds;
    if (pendingMilliseconds > MAX_PENDING_ENCODE_MILLISECONDS[streamMode]) {
      socket.close(1013, 'Audio sender is overloaded');
      return;
    }
    pendingEncodeMilliseconds.set(chunk.peerId, pendingMilliseconds);
    const previous = encodeQueues.get(chunk.peerId) ?? Promise.resolve();
    const queued = (async () => {
      await previous;
      let packet: Buffer;
      try {
        packet = sealPacket(
          PACKET_AUDIO,
          await encodeAudioAsync(chunk, streamMode !== 'video'),
          connection.key,
        );
      } finally {
        const remainingMilliseconds = Math.max(
          0,
          (pendingEncodeMilliseconds.get(chunk.peerId) ?? 0) -
            chunkMilliseconds,
        );
        pendingEncodeMilliseconds.set(chunk.peerId, remainingMilliseconds);
      }
      const remainingMilliseconds =
        pendingEncodeMilliseconds.get(chunk.peerId) ?? 0;
      if (
        generation !== activeGeneration ||
        sockets.get(chunk.peerId)?.socket !== socket ||
        socket.readyState !== WEB_SOCKET_OPEN
      ) {
        return undefined;
      }
      const queuedBytes = socket.bufferedAmount;
      if (queuedBytes > MAX_SOCKET_BUFFER_BYTES[streamMode]) {
        socket.close(1013, 'Network send buffer is overloaded');
        return undefined;
      }
      socket.send(packet);
      networkMeter.record(
        chunk.peerId,
        'send',
        packet.byteLength,
        queuedBytes,
        remainingMilliseconds,
      );
      return undefined;
    })();
    encodeQueues.set(chunk.peerId, queued);
    queued
      .catch(() => socket.close(1011, 'Audio transport failed'))
      .finally(() => {
        if (encodeQueues.get(chunk.peerId) === queued) {
          encodeQueues.delete(chunk.peerId);
        }
      });
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
    encodeQueues.clear();
    decodeQueues.clear();
    pendingDecodeBytes.clear();
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
