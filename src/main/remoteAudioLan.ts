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
import type {
  ILanRemoteAudioChunk,
  ILanRemoteAudioNetworkStats,
  ILanRemoteAudioSignal,
} from '../common/remoteAudio';
import { isLanRemoteAudioSignal } from '../common/remoteAudio';
import {
  MAX_PACKET_BYTES,
  PACKET_AUTH_READY,
  computerIdOf,
  createAuthChallenge,
  decodePairingCode,
  deriveSessionKey,
  encodePairingCode,
  keyFromSecret,
  openAuthReady,
  openPacket,
  sealAuthAccepted,
  sealAuthChallenge,
} from './remoteAudioLanProtocol';
import {
  discoveryTargets,
  isPrivateIpv4,
  lanAddresses,
} from './remoteAudioLanAddresses';
import {
  REMOTE_AUDIO_DISCOVERY_PORT,
  encodeDiscoveryAnnouncement,
  encodeDiscoveryQuery,
  isDiscoveryQuery,
} from './remoteAudioDiscovery';
import {
  CLOSE_ALREADY_LINKED,
  CLOSE_FORGET,
  closeWebSocketSafely,
} from './remoteAudioLanJoin';
import { createLanJoins } from './remoteAudioLanJoins';
import createRemoteAudioTransport, {
  probeWhileQuiet,
} from './remoteAudioTransport';
import type {
  ILanHostCredentials,
  ILanHostSession,
  ILanLinkBook,
  IRemoteAudioLan,
} from './remoteAudioLanTypes';

const MAX_PENDING_SOCKETS = 64;
const MAX_PENDING_SOCKETS_PER_ADDRESS = 8;
const MAX_AUTHENTICATED_SOCKETS = 32;
/**
 * How many times the network is asked who is there, each sent once the last
 * has left the socket. A datagram can be dropped; a computer that comes up
 * later announces itself and is heard without being asked again.
 */
const DISCOVERY_QUERIES = 3;
const WEB_SOCKET_OPEN = 1;

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

/** Sends one datagram to each target in turn, each once the last has left. */
const sendToEach = (
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
    // The adapter went away mid-send, or the socket closed. A computer that
    // comes up later still announces itself.
  }
};

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
  const usedPeerIds = new Set<string>();
  /** Every open link: which computer, and whether this one pasted its code. */
  const peers = new Map<string, { computerId?: string; joined: boolean }>();
  /** Connections from each computer to this one, while they are open. */
  const inbound = new Map<string, Set<WebSocket>>();

  const ownId = () => (session ? computerIdOf(session.secret) : '');

  const forgetPeer = (peerId: string) => {
    peers.delete(peerId);
  };

  const transport = createRemoteAudioTransport({
    emitAudio,
    emitNetwork,
    emitSignal: (message) => {
      const { peerId, signal } = message;
      if (signal.kind === 'stop') {
        const computerId = peers.get(peerId)?.computerId;
        // Unlinked over there: a code this computer holds for it is not to
        // be used again (a FluidEQ from before all to all never says so).
        if (signal.forget === true && computerId && joins.has(computerId)) {
          joins.leave(computerId);
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
    usedPeerIds.clear();
    peers.clear();
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
    /**
     * Connections that have not authenticated yet, oldest first, over all and
     * per address. A connection arriving to a full room makes room by
     * closing the one that has waited longest — never a timer: an honest
     * peer answers its challenge in one round trip, a silent one is the one
     * let go.
     */
    const pendingCandidates = new Map<WebSocket, () => void>();
    const pendingByAddress = new Map<string, Set<WebSocket>>();
    const makeRoom = (waiting: Iterable<WebSocket>) => {
      const [oldest] = waiting;
      if (oldest) {
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
      probeWhileQuiet(request.socket);
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
          const { computerId } = message;
          const refusal = admit(computerId, message.fresh === true);
          if (refusal !== undefined) {
            closeWebSocketSafely(candidate, refusal, 'Not linked');
            return;
          }
          if (computerId) {
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
          }
          const sessionKey = deriveSessionKey(
            nextKey,
            challenge,
            message.peerId,
          );
          // Reserve the peer identity before the asynchronous send callback,
          // or two simultaneous responses using the same peer ID could both
          // pass the duplicate check and race to replace one transport.
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
              transport.attach(
                message.peerId,
                candidate,
                sessionKey,
                computerId
                  ? `in:${computerId}`
                  : `${remoteAddress}\n${message.deviceName}`,
              );
              candidate.removeListener('error', onPendingError);
              peers.set(message.peerId, { computerId, joined: false });
              emitSignal({
                peerId: message.peerId,
                signal: {
                  kind: 'peer-ready',
                  address: remoteAddress,
                  deviceName: message.deviceName,
                  ...(computerId ? { computerId } : {}),
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
    nextDiscoverySocket.on('message', (data, sender) => {
      if (isDiscoveryQuery(data, secret)) {
        // Straight back to whoever asked: a broadcast answer leaves through
        // the default route alone and missed a computer on the other card.
        try {
          nextDiscoverySocket.send(
            announcement,
            sender.port,
            sender.address,
            () => undefined,
          );
        } catch {
          // Gone mid-send; it asks again when it looks again.
        }
        return;
      }
      joins.heard(data, sender.address);
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
      // Every computer still looking for this one hears it is back.
      sendToEach(nextDiscoverySocket, announcement, discoveryTargets());
    } catch (error) {
      if (lifecycleGeneration === operation) {
        stop();
      } else {
        closeDiscoverySocket(nextDiscoverySocket);
      }
      throw error;
    }
    session = { port, secret };
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
    transport.sendSignal(value);
  };

  return {
    start: startHost,
    join,
    unlink,
    retry: () => joins.retry(),
    sendSignal,
    sendAudio: (value) => transport.sendAudio(value),
    setStreamMode: (peerId, mode) => transport.setStreamMode(peerId, mode),
    stop,
  };
};

export default createRemoteAudioLan;
