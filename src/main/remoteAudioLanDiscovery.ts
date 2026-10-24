/* FluidEQ — GPL-3.0-or-later */
import type dgram from 'dgram';
import { discoveryTargets } from './remoteAudioLanAddresses';
import {
  REMOTE_AUDIO_DISCOVERY_PORT,
  encodeDiscoveryAnnouncement,
  isDiscoveryQuery,
} from './remoteAudioDiscovery';

export const closeDiscoverySocket = (socket: dgram.Socket) => {
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

/** Each datagram is sent after the previous one leaves; no timed retries. */
export const sendToEach = (
  socket: dgram.Socket,
  data: Buffer,
  targets: readonly string[],
  done: () => void = () => undefined,
) => {
  const [target, ...rest] = targets;
  if (target === undefined) {
    done();
    return;
  }
  try {
    socket.send(data, REMOTE_AUDIO_DISCOVERY_PORT, target, () =>
      sendToEach(socket, data, rest, done),
    );
  } catch {
    /* Adapter went away or socket closed; lifecycle events probe again. */
  }
};

export const configureLanDiscovery = (
  socket: dgram.Socket,
  {
    secret,
    port,
    deviceName,
    pairSecrets,
    heard,
    closed,
  }: {
    secret: string;
    port: number;
    deviceName: string;
    pairSecrets(): readonly string[];
    heard(data: Buffer, address: string): void;
    closed(): void;
  },
) => {
  socket.on('message', (data, sender) => {
    const discoveredSecret = [secret, ...pairSecrets()].find((key) =>
      isDiscoveryQuery(data, key),
    );
    if (discoveredSecret) {
      try {
        socket.send(
          encodeDiscoveryAnnouncement(discoveredSecret, port, deviceName),
          sender.port,
          sender.address,
          () => undefined,
        );
      } catch {
        /* Gone mid-send; the next lifecycle event probes again. */
      }
    } else {
      heard(data, sender.address);
    }
  });
  socket.on('error', () => {
    // Wildcard sockets remain usable after an adapter disappears and returns.
    // Closing here would permanently remove discovery after Wi-Fi or sleep.
  });
  socket.on('close', closed);
};

export const announceLanIdentity = (
  socket: dgram.Socket,
  port: number,
  deviceName: string,
  secrets: readonly string[],
) => {
  [...new Set(secrets)].forEach((secret) =>
    sendToEach(
      socket,
      encodeDiscoveryAnnouncement(secret, port, deviceName),
      discoveryTargets(),
    ),
  );
};
