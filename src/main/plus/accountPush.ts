/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAccountConfig } from '../../common/accountConfig';
import type { IAccountSession } from '../account/session';

/**
 * The server telling the app that something of this account's moved, on a
 * private Realtime topic only that account may join.
 *
 * Two things ride it: the credits while a pack is paid for in the browser
 * (`creditsPush.ts`, premium 0099) and a scene sent for review being decided
 * (`ipc/plusReview.ts`, premium 0102). Each broadcast is empty — the app reads
 * the thing again, as it does at launch — so a message seen by the wrong
 * reader would tell it nothing either.
 *
 * Realtime is spoken to directly, as `authClient.ts` speaks to the account
 * service: Node's own WebSocket and the Phoenix messages Realtime documents,
 * no client library. A socket is open only while its owner says something is
 * owed — a payment, a scene waiting for review — so the free plan's
 * connections stay near zero.
 *
 * NO HEARTBEAT, because a heartbeat is a timer. Realtime closes a socket that
 * has sent nothing: 66 s after it joined, measured on the live project on
 * 2026-11-09 (a normal close, code 1000). A socket that had joined is opened
 * again at once when it closes, at most `MAX_REJOINS` times, and every join
 * calls `onEvent` once, so whatever moved while the socket was between two
 * connections is still read. A socket that never joined — offline, refused, a
 * token that would not refresh — is not tried again by itself. Either way the
 * next come-back event watches again with a fresh allowance.
 */

/**
 * Rejoins after a drop, per watch: about 33 minutes of nobody at the
 * computer. Whatever moves later than that arrives at the next come-back
 * event, as everything did before the push.
 */
export const MAX_REJOINS = 30;

export interface IAccountPush {
  /** Listen for this account's topic, unless already listening. */
  watch(): void;
  /** Stop listening. */
  stop(): void;
}

export interface IAccountPushDeps {
  config: Pick<IAccountConfig, 'supabaseUrl' | 'supabaseAnonKey'>;
  session: Pick<IAccountSession, 'state' | 'accessToken'>;
  /** The private topic for an account, e.g. `credits:<id>`. */
  topicOf: (userId: string) => string;
  /** The broadcast's event name that means "read it again". */
  event: string;
  /** What moved, for the log: "credits", "scene review". */
  name: string;
  /** It moved, or may have while nobody was listening. */
  onEvent: () => void;
  createSocket?: (url: string) => WebSocket;
  logger?: { info(message: string): void; warn(message: string): void };
}

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

export const createAccountPush = ({
  config,
  session,
  topicOf,
  event,
  name,
  onEvent,
  createSocket = (url) => new WebSocket(url),
  logger,
}: IAccountPushDeps): IAccountPush => {
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
    const topic = `realtime:${topicOf(userId)}`;
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

    socket.addEventListener('message', (message: MessageEvent) => {
      const read = readMessage(message.data);
      if (!read || read.topic !== topic) {
        return;
      }
      const payload = isRecord(read.payload) ? read.payload : {};
      if (read.event === 'phx_reply' && read.ref === JOIN_REF) {
        if (payload.status === 'ok') {
          attempt.joined = true;
          // Whatever moved while nobody was listening is read now.
          onEvent();
        } else {
          logger?.warn(`The ${name} channel refused to join.`);
          close(socket);
        }
        return;
      }
      if (read.event === 'broadcast' && payload.event === event) {
        onEvent();
        return;
      }
      if (
        read.event === 'phx_close' ||
        read.event === 'phx_error' ||
        (read.event === 'system' && payload.status === 'error')
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
