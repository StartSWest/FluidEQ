/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import WebSocket, { type RawData } from 'ws';
import {
  MAX_PACKET_BYTES,
  PACKET_AUTH_ACCEPTED,
  PACKET_AUTH_CHALLENGE,
  deriveSessionKey,
  openAuthAccepted,
  openAuthChallenge,
  openPacket,
  sealAuthReady,
} from './remoteAudioLanProtocol';
import { probeWhileQuiet } from './remoteAudioTransport';

const WEB_SOCKET_CLOSED = 3;

/**
 * Close codes a listener answers a join with, beside the protocol's own.
 *
 * `FORGET`: this computer was unlinked there; old builds also used it for a
 * duplicate. The close code alone never removes credentials: only the
 * authenticated stop/forget signal does. `ALREADY_LINKED`: the two computers each
 * pasted the other's code and the other connection is the one kept; the code
 * stays, asleep, for when that connection ends.
 */
export const CLOSE_FORGET = 4001;
export const CLOSE_ALREADY_LINKED = 4003;

export class LanJoinClosed extends Error {
  constructor(readonly code: number) {
    super(`LAN connection closed (${code}).`);
  }
}

/**
 * Closing a `ws` client while it is still CONNECTING aborts its handshake by
 * emitting an Error before `close`. Keep one close-only sink attached until
 * the socket reaches its terminal event, or that abort escapes as an
 * uncaught main-process exception.
 */
export const closeWebSocketSafely = (
  socket: WebSocket,
  code?: number,
  reason?: string,
) => {
  if (socket.readyState === WEB_SOCKET_CLOSED) {
    return;
  }
  const absorbCloseError = () => undefined;
  socket.once('error', absorbCloseError);
  socket.once('close', () => {
    socket.removeListener('error', absorbCloseError);
  });
  try {
    socket.close(code, reason);
  } catch {
    try {
      socket.terminate();
    } catch {
      socket.once('error', absorbCloseError);
    }
  }
};

export interface IJoinHandshake {
  address: string;
  port: number;
  pairingKey: Buffer;
  peerId: string;
  deviceName: string;
  computerId: string;
  fresh: boolean;
  ticket?: boolean;
  /** The remote endpoint proved it knows the pairing key. */
  onChallenge?(): void;
}

export interface IJoinedSocket {
  address: string;
  socket: WebSocket;
  sessionKey: Buffer;
}

/**
 * One try at one address: connect, answer the listener's challenge, and hand
 * back the authenticated socket. No deadline: it ends on the socket's own
 * close or error — an address nobody answers fails to connect — or on
 * `cancel`.
 */
export const joinAt = ({
  address,
  port,
  pairingKey,
  peerId,
  deviceName,
  computerId,
  fresh,
  ticket,
  onChallenge,
}: IJoinHandshake): {
  joined: Promise<IJoinedSocket>;
  cancel(): void;
} => {
  const socket = new WebSocket(
    `ws://${address}:${port}${ticket ? `/?computer=${encodeURIComponent(computerId)}` : ''}`,
    {
      perMessageDeflate: false,
      maxPayload: MAX_PACKET_BYTES,
    },
  );
  socket.once('upgrade', (response) => probeWhileQuiet(response.socket));
  let settled = false;
  let cancelled = false;
  const joined = new Promise<IJoinedSocket>((resolve, reject) => {
    let challenge: string | undefined;
    const cleanup = () => {
      socket.removeListener('close', onClose);
      socket.removeListener('error', onError);
      socket.removeListener('message', onHandshake);
    };
    const fail = (error: Error) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      reject(error);
    };
    const onClose = (code: number) => fail(new LanJoinClosed(code));
    const onError = (error: Error) => fail(error);
    const onHandshake = (data: RawData) => {
      try {
        const packet = openPacket(data, pairingKey);
        if (!challenge) {
          if (packet.kind !== PACKET_AUTH_CHALLENGE) {
            throw new Error('LAN listener did not send a challenge.');
          }
          challenge = openAuthChallenge(packet.clear).challenge;
          onChallenge?.();
          socket.send(
            sealAuthReady(
              {
                challenge,
                deviceName,
                peerId,
                computerId,
                ...(fresh ? { fresh } : {}),
              },
              pairingKey,
            ),
          );
          return;
        }
        if (packet.kind !== PACKET_AUTH_ACCEPTED) {
          throw new Error('LAN listener did not accept authentication.');
        }
        const accepted = openAuthAccepted(packet.clear);
        if (accepted.challenge !== challenge || accepted.peerId !== peerId) {
          throw new Error('LAN authentication acknowledgement changed.');
        }
        if (cancelled) {
          throw new Error('LAN connection was stopped.');
        }
        settled = true;
        cleanup();
        resolve({
          address,
          socket,
          sessionKey: deriveSessionKey(pairingKey, challenge, peerId),
        });
      } catch (error) {
        fail(
          error instanceof Error
            ? error
            : new Error('LAN authentication failed.'),
        );
        closeWebSocketSafely(socket, 1008, 'Authentication failed');
      }
    };
    socket.once('error', onError);
    socket.once('close', onClose);
    socket.on('message', onHandshake);
  });
  return {
    joined,
    cancel: () => {
      cancelled = true;
      if (!settled) {
        closeWebSocketSafely(socket);
      }
    },
  };
};
