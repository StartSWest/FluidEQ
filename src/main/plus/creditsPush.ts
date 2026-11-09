/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAccountConfig } from '../../common/accountConfig';
import type { IAccountSession } from '../account/session';

/**
 * The server telling the app that this account's credits moved, while a pack
 * is being paid for in the browser.
 *
 * Ivan, 2026-11-09: "the payment is fine but I need to click back to fluid so
 * fluid reload the credits ... fluid needs to also refresh and receive the
 * paid hook by it self automatically". Paying happens in the browser, and the
 * app used to hear of it only when somebody came back to its window. The
 * server now broadcasts an empty `credits` message to the private topic
 * `credits:<account>` whenever the account's ledger gains a row (premium
 * migration 0099), and only that account may join the topic.
 *
 * Realtime is spoken to directly, as `authClient.ts` speaks to the account
 * service: Node's own WebSocket and the Phoenix messages Realtime documents,
 * no client library. A socket is open only while a payment is owed — from
 * the checkout opening until the balance moves, the account changes or the
 * app quits — so the free plan's connections stay near zero.
 *
 * NO HEARTBEAT, because a heartbeat is a timer. Realtime closes a socket that
 * has sent nothing: 66 s after it joined, measured on the live project on
 * 2026-11-09 (a normal close, code 1000). A socket that had joined is opened
 * again at once when it closes, at most `MAX_REJOINS` times, and every join
 * reads the store once, so a payment that landed while the socket was between
 * two connections is still seen. A socket that never joined — offline,
 * refused, a token that would not refresh — is not tried again by itself.
 * Either way the next come-back event (`refreshIfDue`) watches again with a
 * fresh allowance: somebody is at the machine, and the checkout is still owed.
 */

/**
 * Rejoins after a drop, per watch: about 33 minutes of a checkout left open
 * with nobody at the computer, which a card payment finishes well inside. One
 * paid later than that, or by a method that settles days later, arrives at the
 * next come-back event, as every payment did before the push.
 */
export const MAX_REJOINS = 30;

export interface ICreditsPush {
  /** Listen for this account's credits, unless already listening. */
  watch(): void;
  /** Stop listening. */
  stop(): void;
}

export interface ICreditsPushDeps {
  config: Pick<IAccountConfig, 'supabaseUrl' | 'supabaseAnonKey'>;
  session: Pick<IAccountSession, 'state' | 'accessToken'>;
  /** The credits moved, or may have while nobody was listening. */
  onCredits: () => void;
  createSocket?: (url: string) => WebSocket;
  logger?: { info(message: string): void; warn(message: string): void };
}

export const creditsTopic = (userId: string) => `credits:${userId}`;

/** Realtime's socket address for this project, in Phoenix's 1.0 protocol. */
export const realtimeSocketUrl = (
  config: Pick<IAccountConfig, 'supabaseUrl' | 'supabaseAnonKey'>,
) => {
  const url = new URL('/realtime/v1/websocket', config.supabaseUrl);
  url.protocol = url.protocol === 'http:' ? 'ws:' : 'wss:';
  url.searchParams.set('apikey', config.supabaseAnonKey);
  url.searchParams.set('vsn', '1.0.0');
  return url.toString();
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readMessage = (data: unknown): Record<string, unknown> | undefined => {
  if (typeof data !== 'string') {
    return undefined;
  }
  try {
    const parsed: unknown = JSON.parse(data);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    // Realtime sends JSON; anything else is not a message for this.
    return undefined;
  }
};

const JOIN_REF = '1';
/** WebSocket's own `readyState` values, the same in every implementation. */
const CONNECTING = 0;
const OPEN = 1;

export const createCreditsPush = ({
  config,
  session,
  onCredits,
  createSocket = (url) => new WebSocket(url),
  logger,
}: ICreditsPushDeps): ICreditsPush => {
  let wanted = false;
  let rejoins = 0;
  /** The connection being made or held, and whether it joined. */
  let live: { socket?: WebSocket; joined: boolean } | undefined;

  const accountId = () => session.state().identity?.id;

  const close = (socket: WebSocket) => {
    if (socket.readyState === CONNECTING || socket.readyState === OPEN) {
      socket.close();
    }
  };

  const open = async () => {
    const userId = accountId();
    if (!userId) {
      return;
    }
    const attempt: { socket?: WebSocket; joined: boolean } = { joined: false };
    live = attempt;
    let token: string;
    try {
      token = await session.accessToken();
    } catch {
      // Signed out, or no network: the next come-back event asks again.
      live = undefined;
      return;
    }
    if (live !== attempt || !wanted || accountId() !== userId) {
      if (live === attempt) {
        live = undefined;
      }
      return;
    }
    const topic = `realtime:${creditsTopic(userId)}`;
    const socket = createSocket(realtimeSocketUrl(config));
    attempt.socket = socket;

    socket.addEventListener('open', () => {
      socket.send(
        JSON.stringify({
          topic,
          event: 'phx_join',
          payload: {
            config: {
              broadcast: { ack: false, self: false },
              presence: { key: '', enabled: false },
              postgres_changes: [],
              private: true,
            },
            access_token: token,
          },
          ref: JOIN_REF,
          join_ref: JOIN_REF,
        }),
      );
    });

    socket.addEventListener('message', (event: MessageEvent) => {
      const message = readMessage(event.data);
      if (!message || message.topic !== topic) {
        return;
      }
      const payload = isRecord(message.payload) ? message.payload : {};
      if (message.event === 'phx_reply' && message.ref === JOIN_REF) {
        if (payload.status === 'ok') {
          attempt.joined = true;
          // Whatever moved while nobody was listening is read now.
          onCredits();
        } else {
          logger?.warn('The credits channel refused to join.');
          close(socket);
        }
        return;
      }
      if (message.event === 'broadcast' && payload.event === 'credits') {
        onCredits();
        return;
      }
      if (
        message.event === 'phx_close' ||
        message.event === 'phx_error' ||
        (message.event === 'system' && payload.status === 'error')
      ) {
        // An expired token arrives this way; the rejoin takes a fresh one.
        close(socket);
      }
    });

    socket.addEventListener('close', () => {
      if (live !== attempt) {
        return;
      }
      live = undefined;
      if (wanted && attempt.joined && rejoins < MAX_REJOINS) {
        rejoins += 1;
        open().catch(() => undefined);
      }
    });
  };

  return {
    watch: () => {
      wanted = true;
      if (!live) {
        rejoins = 0;
        open().catch(() => undefined);
      }
    },
    stop: () => {
      wanted = false;
      const current = live;
      live = undefined;
      if (current?.socket) {
        close(current.socket);
      }
    },
  };
};
