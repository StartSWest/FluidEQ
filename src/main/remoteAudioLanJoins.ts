/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import crypto from 'crypto';
import type WebSocket from 'ws';
import type { ILanRemoteAudioSignal } from '../common/remoteAudio';
import { decodeDiscoveryAnnouncement } from './remoteAudioDiscovery';
import { isPrivateIpv4 } from './remoteAudioLanAddresses';
import {
  CLOSE_ALREADY_LINKED,
  CLOSE_FORGET,
  LanJoinClosed,
  closeWebSocketSafely,
  joinAt,
} from './remoteAudioLanJoin';
import {
  type ILanPairingPayload,
  computerIdOf,
  keyFromSecret,
} from './remoteAudioLanProtocol';

/**
 * Every computer whose code was pasted here, kept linked for good.
 *
 * All to all: a computer listens on its own code and, at the same time,
 * joins every computer whose code it was given, so three computers link by
 * any two pastes each and none of them is "the server". A join is a loop with
 * no clock in it:
 *
 *  - LOOKING: every address the code names is tried at once, and so is any
 *    address the computer is heard announcing itself from (it answers a
 *    "who is there?" and says so whenever it starts). The first connection
 *    to authenticate is kept and the rest are dropped, which is how the
 *    fastest path is chosen — Ethernet answers before Wi-Fi, a stale
 *    address never answers at all. Nothing is tried again on a timer: a
 *    computer that is away is found when it announces itself.
 *  - CONNECTED: until that connection closes, then LOOKING again.
 *  - ASLEEP: the two computers each pasted the other's code and the other
 *    computer's connection is the one kept (`inboundArrived`). It wakes when
 *    that connection ends.
 */

type TJoinState = 'looking' | 'connected' | 'asleep';

interface IJoin {
  computerId: string;
  pairing: ILanPairingPayload;
  pairingKey: Buffer;
  /** The first connection after a paste says so, once. */
  fresh: boolean;
  port: number;
  state: TJoinState;
  /** One per round of looking: every address tried in a round uses it, so a
   * listener reached on two addresses at once accepts only one of them. */
  peerId: string;
  attempts: Map<string, () => void>;
  socket?: WebSocket;
  lastAddress?: string;
}

export interface ILanJoinsDeps {
  attach(peerId: string, socket: WebSocket, sessionKey: Buffer): void;
  emitSignal(message: ILanRemoteAudioSignal): void;
  /** This computer's own id and name, as it gives them when it joins. */
  self(): { computerId: string; deviceName: string };
  /** Sends a "who is there?" for one secret; no-op without a network. */
  askWhoIsThere(secret: string): void;
  /** A connection from that computer to this one is open. */
  inboundLive(computerId: string): boolean;
  /** The other computer said this code is not to be used again. */
  forgotten(computerId: string): void;
}

export const createLanJoins = (deps: ILanJoinsDeps) => {
  const joins = new Map<string, IJoin>();

  const cancelAttempts = (join: IJoin) => {
    join.attempts.forEach((cancel) => cancel());
    join.attempts.clear();
  };

  const leave = (computerId: string) => {
    const join = joins.get(computerId);
    if (!join) {
      return;
    }
    joins.delete(computerId);
    cancelAttempts(join);
    if (join.socket) {
      closeWebSocketSafely(join.socket);
    }
  };

  const sleep = (join: IJoin) => {
    join.state = 'asleep';
    cancelAttempts(join);
    const { socket } = join;
    join.socket = undefined;
    if (socket) {
      closeWebSocketSafely(socket);
    }
  };

  // `tryAddress` starts a new round when its connection closes, long after
  // both exist; the real `look` is assigned below it.
  let look: (join: IJoin) => void = () => undefined;

  const tryAddress = (join: IJoin, address: string, port: number) => {
    const at = `${address}:${port}`;
    if (
      joins.get(join.computerId) !== join ||
      join.state !== 'looking' ||
      join.attempts.has(at)
    ) {
      return;
    }
    const { peerId } = join;
    const { computerId, deviceName } = deps.self();
    const attempt = joinAt({
      address,
      port,
      pairingKey: join.pairingKey,
      peerId,
      deviceName,
      computerId,
      fresh: join.fresh,
      ticket: join.pairing.computerId !== undefined,
    });
    join.attempts.set(at, attempt.cancel);
    attempt.joined
      .then(({ socket, sessionKey }) => {
        join.attempts.delete(at);
        if (
          joins.get(join.computerId) !== join ||
          join.state !== 'looking' ||
          join.peerId !== peerId
        ) {
          closeWebSocketSafely(socket);
          return undefined;
        }
        cancelAttempts(join);
        join.state = 'connected';
        join.socket = socket;
        join.lastAddress = address;
        join.port = port;
        join.fresh = false;
        socket.once('close', () => {
          if (joins.get(join.computerId) === join && join.socket === socket) {
            join.socket = undefined;
            look(join);
          }
        });
        deps.attach(peerId, socket, sessionKey);
        deps.emitSignal({
          peerId,
          signal: {
            kind: 'peer-ready',
            address,
            computerId: join.computerId,
            deviceName: join.pairing.deviceName,
            joined: true,
            ...(join.pairing.introduced ? { introduced: true } : {}),
          },
        });
        return undefined;
      })
      .catch((error: unknown) => {
        join.attempts.delete(at);
        if (joins.get(join.computerId) !== join || join.state !== 'looking') {
          return;
        }
        if (!(error instanceof LanJoinClosed)) {
          // Nobody there, or not this computer: the next announcement says
          // where it is.
          return;
        }
        if (error.code === CLOSE_FORGET) {
          leave(join.computerId);
          deps.forgotten(join.computerId);
        } else if (
          error.code === CLOSE_ALREADY_LINKED &&
          deps.inboundLive(join.computerId)
        ) {
          sleep(join);
        }
      });
  };

  /** Every address worth trying in this round, and a "who is there?". An
   * address already being tried is not tried twice. */
  const probe = (join: IJoin) => {
    const candidates = new Set(
      [join.lastAddress, ...join.pairing.addresses].filter(
        (address): address is string => address !== undefined,
      ),
    );
    candidates.forEach((address) => tryAddress(join, address, join.port));
    deps.askWhoIsThere(join.pairing.secret);
  };

  look = (join: IJoin) => {
    cancelAttempts(join);
    join.state = 'looking';
    join.peerId = crypto.randomUUID();
    probe(join);
  };

  return {
    /** Keeps a link to the computer whose code this is; its id. */
    join(pairing: ILanPairingPayload, fresh: boolean): string {
      const computerId = pairing.computerId ?? computerIdOf(pairing.secret);
      const existing = joins.get(computerId);
      if (existing) {
        existing.fresh = existing.fresh || fresh;
        if (
          existing.pairing.computerId &&
          existing.pairing.secret !== pairing.secret
        ) {
          // A concurrent introduction chose another scoped credential. Keep
          // the authenticated session alive while both computers learn it;
          // closing here could cut off delivery of the winning credential.
          existing.pairing = pairing;
          existing.pairingKey = keyFromSecret(pairing.secret);
          if (existing.state === 'looking') {
            look(existing);
          }
          return computerId;
        }
        if (existing.state === 'looking') {
          probe(existing);
        }
        return computerId;
      }
      const join: IJoin = {
        computerId,
        pairing,
        pairingKey: keyFromSecret(pairing.secret),
        fresh,
        port: pairing.port,
        state: 'looking',
        peerId: '',
        attempts: new Map(),
      };
      joins.set(computerId, join);
      if (deps.inboundLive(computerId)) {
        join.state = 'asleep';
      } else {
        look(join);
      }
      return computerId;
    },
    leave,
    has: (computerId: string) => joins.has(computerId),
    /** The peer id of the open connection to that computer, if any. */
    peerOf(computerId: string): string | undefined {
      const join = joins.get(computerId);
      return join?.state === 'connected' ? join.peerId : undefined;
    },
    /**
     * A computer this one also joined has connected to it. Of the two
     * connections between one pair, the one whose JOINING computer has the
     * smaller id is kept, so both computers pick the same one without
     * asking each other. `refuse` means close it with
     * `CLOSE_ALREADY_LINKED`: this computer's own connection is that one.
     */
    inboundArrived(computerId: string): 'accept' | 'refuse' {
      const join = joins.get(computerId);
      if (!join) {
        return 'accept';
      }
      if (join.state === 'connected' && deps.self().computerId < computerId) {
        return 'refuse';
      }
      sleep(join);
      return 'accept';
    },
    /** The last connection from that computer closed. */
    inboundClosed(computerId: string) {
      const join = joins.get(computerId);
      if (join?.state === 'asleep') {
        look(join);
      }
    },
    /** A datagram on the discovery port: perhaps one we are looking for. */
    heard(data: Buffer, address: string) {
      if (!isPrivateIpv4(address)) {
        return;
      }
      joins.forEach((join) => {
        if (join.state !== 'looking') {
          return;
        }
        const announcement = decodeDiscoveryAnnouncement(
          data,
          join.pairing.secret,
        );
        if (announcement) {
          tryAddress(join, address, announcement.port);
        }
      });
    },
    /** The network is back: every computer still away is looked for now. */
    retry() {
      joins.forEach((join) => {
        if (join.state === 'looking') {
          look(join);
        }
      });
    },
    closeAll() {
      [...joins.keys()].forEach(leave);
    },
  };
};

export type ILanJoins = ReturnType<typeof createLanJoins>;
