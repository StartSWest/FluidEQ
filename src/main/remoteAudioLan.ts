/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import crypto from 'crypto';
import dgram from 'dgram';
import os from 'os';
import { WebSocketServer } from 'ws';
import type WebSocket from 'ws';
import registerLanPeers from './remoteAudioLanServer';
import createRemoteAudioGroup from './remoteAudioGroup';
import {
  closeDiscoverySocket,
  sendToEach,
  configureLanDiscovery,
  announceLanIdentity,
} from './remoteAudioLanDiscovery';
import type { IAudioGroupLink } from '../common/remoteAudioGroup';
import type {
  ILanRemoteAudioChunk,
  ILanRemoteAudioNetworkStats,
  ILanRemoteAudioSignal,
  TRemoteAudioSignal,
} from '../common/remoteAudio';
import { isLanRemoteAudioSignal } from '../common/remoteAudio';
import {
  MAX_PACKET_BYTES,
  computerIdOf,
  decodePairingCode,
  encodePairingCode,
  keyFromSecret,
} from './remoteAudioLanProtocol';
import { discoveryTargets, lanAddresses } from './remoteAudioLanAddresses';
import {
  REMOTE_AUDIO_DISCOVERY_PORT,
  encodeDiscoveryQuery,
} from './remoteAudioDiscovery';
import {
  CLOSE_ALREADY_LINKED,
  CLOSE_FORGET,
  closeWebSocketSafely,
} from './remoteAudioLanJoin';
import { createLanJoins } from './remoteAudioLanJoins';
import createRemoteAudioTransport from './remoteAudioTransport';
import type {
  ILanHostCredentials,
  ILanHostSession,
  ILanLinkBook,
  IRemoteAudioLan,
} from './remoteAudioLanTypes';

/**
 * How many times the network is asked who is there, each sent once the last
 * has left the socket. A datagram can be dropped; a computer that comes up
 * later announces itself and is heard without being asked again.
 */
const DISCOVERY_QUERIES = 3;

const deviceNameOf = () => os.hostname().trim() || 'FluidEQ';

/**
 * Share Audio's network: this computer listening on its own code, and joined
 * to every computer whose code was pasted here, all at once.
 *
 * Local certificates cannot prove which PC created them, so the WebSocket is
 * plain `ws://` and every packet inside it is authenticated and encrypted
 * with AES-256-GCM using the pairing secret. Samples travel as Float32, raw,
 * over the reliable, ordered WebSocket with no lossy media codec.
 *
 * Every computer is a listener and a joiner at the same time (all to all).
 * The code a computer shows is its own and never changes; pasting it on any
 * number of computers links each of them with this one, and unlinking one
 * leaves every other link alone. The joins themselves are
 * `remoteAudioLanJoins.ts`.
 */
const createRemoteAudioLan = (
  emitSignal: (message: ILanRemoteAudioSignal) => void,
  emitAudio: (chunk: ILanRemoteAudioChunk) => void,
  emitError: () => void,
  emitNetwork: (stats: ILanRemoteAudioNetworkStats) => void,
  book: ILanLinkBook,
): IRemoteAudioLan => {
  let server: WebSocketServer | undefined;
  let discoverySocket: dgram.Socket | undefined;
  let rejectHostStart: ((error: Error) => void) | undefined;
  let session: ILanHostCredentials | undefined;
  let lifecycleGeneration = 0;
  const announced = new Map<
    string,
    Extract<TRemoteAudioSignal, { kind: 'stream-mode' }>
  >();
  /** Every open link: which computer, and whether this one pasted its code. */
  const peers = new Map<string, { computerId?: string; joined: boolean }>();
  /** Connections from each computer to this one, while they are open. */
  const inbound = new Map<string, Set<WebSocket>>();

  const ownId = () => (session ? computerIdOf(session.secret) : '');

  const forgetPeer = (peerId: string) => {
    peers.delete(peerId);
    announced.delete(peerId);
    group.disconnected(peerId);
  };

  const restoreGroupLink = (link: IAudioGroupLink) => {
    if (book.isRevoked(link.computerId)) {
      return;
    }
    joins.join(
      {
        ...link,
        address: link.addresses[0] ?? '',
        computerId: link.computerId,
      },
      false,
    );
  };
  const group = createRemoteAudioGroup({
    self: () =>
      session && book.groupLinks && book.saveGroupLink
        ? {
            secret: session.secret,
            endpoint: {
              computerId: ownId(),
              deviceName: deviceNameOf(),
              addresses: lanAddresses(),
              port: session.port,
            },
          }
        : undefined,
    saved: () => book.groupLinks?.() ?? [],
    known: () => [
      ...(book.groupLinks?.() ?? []).map((link) => link.computerId),
    ],
    revoked: (id) => book.isRevoked(id),
    save: (link) => book.saveGroupLink?.(link),
    join: restoreGroupLink,
    send: (message) => {
      // Repeat the current duplex description with the group handshake. A
      // capability-only stream-mode would replace the replay snapshot and
      // could lose Receive/Send state after a renderer reload.
      const previous = announced.get(message.peerId);
      transport.sendSignal(
        message.signal.kind === 'stream-mode' && previous
          ? {
              ...message,
              signal: {
                ...message.signal,
                mode: previous.mode,
                duplex: previous.duplex,
              },
            }
          : message,
      );
    },
  });

  const transport = createRemoteAudioTransport({
    emitAudio,
    emitNetwork,
    emitSignal: (message) => {
      const { peerId, signal } = message;
      if (group.receive(message)) {
        return;
      }
      if (signal.kind === 'stop') {
        const computerId = peers.get(peerId)?.computerId;
        // Unlinked over there: a code this computer holds for it is not to
        // be used again (a FluidEQ from before all to all never says so).
        if (signal.forget === true && computerId) {
          book.revoke(computerId);
          if (joins.has(computerId)) {
            joins.leave(computerId);
          }
          book.forgetJoin(computerId);
        }
        forgetPeer(peerId);
      }
      emitSignal(message);
    },
  });

  const askWhoIsThere = (secret: string) => {
    const socket = discoverySocket;
    if (!socket) {
      return;
    }
    const query = encodeDiscoveryQuery(secret);
    const ask = (asked: number) => {
      if (asked < DISCOVERY_QUERIES && discoverySocket === socket) {
        sendToEach(socket, query, discoveryTargets(), () => ask(asked + 1));
      }
    };
    ask(0);
  };

  const announceSelf = () => {
    if (!session || !discoverySocket) {
      return;
    }
    const socket = discoverySocket;
    const { port, secret } = session;
    announceLanIdentity(socket, port, deviceNameOf(), [
      secret,
      ...(book.groupLinks?.() ?? []).map((link) => link.secret),
    ]);
  };

  const joins = createLanJoins({
    attach: (peerId, socket, sessionKey) => {
      transport.attach(peerId, socket, sessionKey);
    },
    emitSignal: (message) => {
      if (message.signal.kind === 'peer-ready') {
        peers.set(message.peerId, {
          computerId: message.signal.computerId,
          joined: true,
        });
      }
      emitSignal(message);
      if (message.signal.kind === 'peer-ready') {
        group.connected(message.peerId, message.signal.computerId);
      }
    },
    self: () => ({ computerId: ownId(), deviceName: deviceNameOf() }),
    askWhoIsThere,
    inboundLive: (computerId) => (inbound.get(computerId)?.size ?? 0) > 0,
    forgotten: (computerId) => book.forgetJoin(computerId),
  });

  const stop = () => {
    lifecycleGeneration += 1;
    const activeServer = server;
    const activeDiscoverySocket = discoverySocket;
    const activeRejectHostStart = rejectHostStart;
    server = undefined;
    discoverySocket = undefined;
    rejectHostStart = undefined;
    session = undefined;
    joins.closeAll();
    transport.closeAll();
    peers.clear();
    announced.clear();
    group.reset();
    inbound.clear();
    if (activeDiscoverySocket) {
      closeDiscoverySocket(activeDiscoverySocket);
    }
    activeRejectHostStart?.(new Error('LAN listener stopped.'));
    if (activeServer) {
      activeServer.clients.forEach((client) => {
        client.removeAllListeners();
        closeWebSocketSafely(client);
      });
      activeServer.close();
    }
  };

  const describe = (credentials: ILanHostCredentials): ILanHostSession => {
    const addresses = lanAddresses();
    const deviceName = deviceNameOf();
    return {
      credentials,
      details: {
        deviceName,
        computerId: computerIdOf(credentials.secret),
        ...(addresses.length > 0
          ? {
              code: encodePairingCode(
                addresses,
                credentials.port,
                credentials.secret,
                deviceName,
              ),
            }
          : {}),
      },
    };
  };

  /**
   * Whether a computer that has just authenticated is let in. It is not when
   * it was unlinked here and is coming back on its own (`CLOSE_FORGET` tells
   * it to forget this code), and not when this computer's own connection to
   * it is the one the pair keeps (`CLOSE_ALREADY_LINKED`).
   */
  const admit = (
    computerId: string | undefined,
    fresh: boolean,
  ): number | undefined => {
    if (computerId === undefined) {
      return undefined;
    }
    if (computerId === ownId()) {
      return 1008;
    }
    if (book.isRevoked(computerId)) {
      if (!fresh) {
        return CLOSE_FORGET;
      }
      book.unrevoke(computerId);
    }
    return joins.inboundArrived(computerId) === 'refuse'
      ? CLOSE_ALREADY_LINKED
      : undefined;
  };

  const startHost = async (
    credentials?: ILanHostCredentials,
  ): Promise<ILanHostSession> => {
    if (
      session &&
      server &&
      (credentials === undefined || credentials.secret === session.secret)
    ) {
      // Already listening on this code: the links stay up, and the code is
      // made again from the addresses this computer has now.
      return describe(session);
    }
    stop();
    const operation = lifecycleGeneration;
    const secret =
      credentials?.secret ?? crypto.randomBytes(32).toString('base64url');
    const deviceName = deviceNameOf();
    const nextKey = keyFromSecret(secret);
    const nextServer = new WebSocketServer({
      host: '0.0.0.0',
      port: credentials?.port ?? 0,
      maxPayload: MAX_PACKET_BYTES,
      perMessageDeflate: false,
    });
    server = nextServer;
    registerLanPeers(nextServer, {
      current: () => lifecycleGeneration === operation && server === nextServer,
      pairingKey: nextKey,
      book,
      admit,
      arriving: (computerId, candidate) => {
        const open = inbound.get(computerId) ?? new Set<WebSocket>();
        open.add(candidate);
        inbound.set(computerId, open);
        candidate.once('close', () => {
          open.delete(candidate);
          if (open.size === 0 && inbound.get(computerId) === open) {
            inbound.delete(computerId);
            joins.inboundClosed(computerId);
          }
        });
      },
      ready: (candidate, sessionKey, message, remoteAddress, introduced) => {
        const { computerId } = message;
        transport.attach(
          message.peerId,
          candidate,
          sessionKey,
          computerId
            ? `in:${computerId}`
            : `${remoteAddress}\n${message.deviceName}`,
        );
        peers.set(message.peerId, { computerId, joined: false });
        emitSignal({
          peerId: message.peerId,
          signal: {
            kind: 'peer-ready',
            address: remoteAddress,
            deviceName: message.deviceName,
            ...(computerId ? { computerId } : {}),
            ...(introduced ? { introduced: true } : {}),
          },
        });
        group.connected(message.peerId, computerId);
      },
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

    const nextDiscoverySocket = dgram.createSocket({
      type: 'udp4',
      reuseAddr: true,
    });
    discoverySocket = nextDiscoverySocket;
    configureLanDiscovery(nextDiscoverySocket, {
      secret,
      port,
      deviceName,
      pairSecrets: () => (book.groupLinks?.() ?? []).map((link) => link.secret),
      heard: (data, address) => joins.heard(data, address),
      closed: () => {
        if (discoverySocket === nextDiscoverySocket) {
          discoverySocket = undefined;
          emitError();
        }
      },
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
    } catch (error) {
      if (lifecycleGeneration === operation) {
        stop();
      } else {
        closeDiscoverySocket(nextDiscoverySocket);
      }
      throw error;
    }
    session = { port, secret };
    (book.groupLinks?.() ?? []).forEach(restoreGroupLink);
    announceSelf();
    return describe(session);
  };

  const join = (code: unknown, fresh: boolean) => {
    const pairing = decodePairingCode(code);
    const computerId = computerIdOf(pairing.secret);
    if (session && computerId === ownId()) {
      throw new Error('That is this computer’s own code.');
    }
    if (fresh) {
      book.unrevoke(computerId);
    }
    joins.join(pairing, fresh);
    return { computerId, deviceName: pairing.deviceName };
  };

  const unlink = ({
    peerId,
    computerId: named,
  }: {
    peerId?: string;
    computerId?: string;
  }) => {
    const computerId =
      named ??
      (peerId === undefined ? undefined : peers.get(peerId)?.computerId);
    const links =
      computerId === undefined
        ? [peerId].filter((id): id is string => id !== undefined)
        : [...peers.entries()]
            .filter(([, peer]) => peer.computerId === computerId)
            .map(([id]) => id);
    links.forEach((id) => {
      try {
        transport.sendSignal({
          peerId: id,
          signal: { kind: 'stop', forget: true },
        });
      } catch {
        // Already gone; its own close says so.
      }
    });
    if (computerId !== undefined) {
      // Refused if it comes back on its own, with word to forget this code;
      // let in again only if somebody pastes the code there by hand.
      book.revoke(computerId);
      if (joins.has(computerId)) {
        joins.leave(computerId);
        book.forgetJoin(computerId);
      }
    }
    links.forEach((id) => transport.close(id));
  };

  const sendSignal = (value: unknown) => {
    if (!isLanRemoteAudioSignal(value)) {
      throw new Error('Invalid remote audio control message.');
    }
    if (value.signal.kind === 'stream-mode') {
      announced.set(value.peerId, value.signal);
    }
    transport.sendSignal(value);
  };

  return {
    start: startHost,
    join,
    unlink,
    retry: () => {
      announceSelf();
      joins.retry();
    },
    sendSignal,
    sendAudio: (value) => transport.sendAudio(value),
    setStreamMode: (peerId, mode) => transport.setStreamMode(peerId, mode),
    stop,
  };
};

export default createRemoteAudioLan;
