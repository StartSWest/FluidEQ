/* FluidEQ — GPL-3.0-or-later */
import type WebSocket from 'ws';
import type { WebSocketServer, RawData } from 'ws';
import {
  PACKET_AUTH_READY,
  createAuthChallenge,
  deriveSessionKey,
  keyFromSecret,
  openAuthReady,
  openPacket,
  sealAuthAccepted,
  sealAuthChallenge,
  type ILanAuthReady,
} from './remoteAudioLanProtocol';
import { isPrivateIpv4 } from './remoteAudioLanAddresses';
import { CLOSE_FORGET, closeWebSocketSafely } from './remoteAudioLanJoin';
import { probeWhileQuiet } from './remoteAudioTransport';
import type { ILanLinkBook } from './remoteAudioLanTypes';

const MAX_PENDING_SOCKETS = 64;
const MAX_PENDING_SOCKETS_PER_ADDRESS = 8;
const MAX_AUTHENTICATED_SOCKETS = 32;
const WEB_SOCKET_OPEN = 1;
interface IDeps {
  current(): boolean;
  pairingKey: Buffer;
  book: ILanLinkBook;
  admit(computerId: string | undefined, fresh: boolean): number | undefined;
  arriving(computerId: string, socket: WebSocket): void;
  ready(
    socket: WebSocket,
    key: Buffer,
    message: ILanAuthReady,
    address: string,
    introduced: boolean,
  ): void;
}
/** Authenticate bounded inbound candidates before exposing any transport. */
const registerLanPeers = (
  server: WebSocketServer,
  { current, pairingKey, book, admit, arriving, ready }: IDeps,
) => {
  const usedPeerIds = new Set<string>();
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

  server.on('connection', (candidate, request) => {
    if (!current()) {
      closeWebSocketSafely(candidate);
      return;
    }
    const remoteAddress = request.socket.remoteAddress?.replace(/^::ffff:/, '');
    if (!remoteAddress || !isPrivateIpv4(remoteAddress)) {
      closeWebSocketSafely(
        candidate,
        1008,
        'Only private LAN connections are allowed',
      );
      return;
    }
    probeWhileQuiet(request.socket);
    const ticketId = new URLSearchParams(
      (request.url ?? '/').split('?')[1] ?? '',
    ).get('computer');
    const ticket =
      ticketId === null
        ? undefined
        : book.groupLinks?.().find((link) => link.computerId === ticketId);
    if (ticketId !== null && (!ticket || book.isRevoked(ticketId))) {
      closeWebSocketSafely(
        candidate,
        ticketId !== null && book.isRevoked(ticketId) ? CLOSE_FORGET : 1008,
        'Not linked',
      );
      return;
    }
    const authKey = ticket ? keyFromSecret(ticket.secret) : pairingKey;
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
        const packet = openPacket(data, authKey);
        const message =
          packet.kind === PACKET_AUTH_READY
            ? openAuthReady(packet.clear)
            : undefined;
        if (
          !message ||
          message.challenge !== challenge ||
          usedPeerIds.has(message.peerId) ||
          usedPeerIds.size >= MAX_AUTHENTICATED_SOCKETS ||
          (ticket !== undefined && message.computerId !== ticket.computerId)
        ) {
          closeWebSocketSafely(candidate, 1008, 'Authentication failed');
          return;
        }
        candidate.removeListener('message', authenticate);
        const { computerId } = message;
        const refusal = admit(computerId, !ticket && message.fresh === true);
        if (refusal !== undefined) {
          closeWebSocketSafely(candidate, refusal, 'Not linked');
          return;
        }
        if (computerId) {
          arriving(computerId, candidate);
        }
        const sessionKey = deriveSessionKey(authKey, challenge, message.peerId);
        // Reserve the peer identity before the asynchronous send callback,
        // or two simultaneous responses using the same peer ID could both
        // pass the duplicate check and race to replace one transport.
        usedPeerIds.add(message.peerId);
        candidate.once('close', () => usedPeerIds.delete(message.peerId));
        candidate.send(
          sealAuthAccepted({ challenge, peerId: message.peerId }, authKey),
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
            candidate.removeListener('error', onPendingError);
            ready(
              candidate,
              sessionKey,
              message,
              remoteAddress,
              ticket?.introduced === true,
            );
          },
        );
      } catch {
        closeWebSocketSafely(candidate, 1008, 'Authentication failed');
      }
    };
    candidate.on('message', authenticate);
    candidate.send(sealAuthChallenge(challenge, authKey), (error) => {
      if (error) {
        closeWebSocketSafely(candidate, 1008, 'Authentication failed');
      }
    });
  });
};
export default registerLanPeers;
