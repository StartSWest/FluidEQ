/* FluidEQ — GPL-3.0-or-later */

import type { Socket } from 'net';
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
/** How long a link carries nothing before the operating system asks whether
 * the other end is still there. Node has the system send ten probes a second
 * apart after that, so a link to nobody fails about fifteen seconds in. */
const LINK_QUIET_BEFORE_PROBE_MS = 5_000;

/**
 * Lets the operating system notice a computer that left without a word.
 *
 * A computer that sleeps, loses its Wi-Fi or loses power closes nothing, so
 * no event ever came: the other side kept showing it linked for good. A link
 * that carries audio found out when its sends piled up, but a paused link, or
 * a quiet one, carries nothing. TCP's keep-alive is the network's own probe.
 * Nothing in FluidEQ waits on it: the system probes a link that has gone
 * quiet, and a link nobody answers fails with an error. That error closes
 * the link like any other close, so the computer that joined goes looking
 * for the other one again and finds it as soon as it is back.
 */
export const probeWhileQuiet = (socket: Socket) => {
  socket.setKeepAlive(true, LINK_QUIET_BEFORE_PROBE_MS);
};

const createRemoteAudioTransport = ({
  emitAudio,
  emitNetwork,
  emitSignal,
}: IRemoteAudioTransportOptions) => {
  const sockets = new Map<
    string,
    { key: Buffer; socket: WebSocket; computer?: string }
  >();
  const decodeQueues = new Map<string, Promise<void>>();
  const pendingDecodeBytes = new Map<string, number>();
  const networkMeter = createRemoteAudioNetworkMeter(emitNetwork);
  let generation = 0;
  let stopping = false;
  const MAX_PENDING_DECODE_BYTES = 8 * 1024 * 1024;
  const MAX_SOCKET_BUFFER_BYTES = 256 * 1024;

  /**
   * `computer` names the machine at the other end, as the address it arrived
   * from and the name it gave. A computer coming back while its old link
   * still looks open replaces that link. Without the replacement it stood
   * beside the new one as a second card until the old one was found dead.
   * Only one copy of FluidEQ runs on a machine, and a machine holds one link
   * to this one, so an older link from the same machine is always the dead
   * one.
   */
  const attach = (
    peerId: string,
    socket: WebSocket,
    socketKey: Buffer,
    computer?: string,
  ) => {
    if (computer !== undefined) {
      sockets.forEach((other, otherId) => {
        if (other.computer === computer && otherId !== peerId) {
          // Its own close announces it gone (`closed` below).
          other.socket.terminate();
        }
      });
    }
    sockets.set(peerId, { key: socketKey, socket, computer });
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
          // A link is announced by the LAN layer on this computer when it
          // authenticates. One arriving from the other end would be that
          // computer naming itself again, under any name it liked.
          if (message.signal.kind === 'peer-ready') {
            return;
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
