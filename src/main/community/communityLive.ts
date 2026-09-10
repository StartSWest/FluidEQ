import { RealtimeClient, type RealtimeChannel } from '@supabase/realtime-js';
import WebSocket from 'ws';
import type { IAccountConfig } from 'common/accountConfig';
import { readMessage, type ICommunityMessage } from './communityApi';

/**
 * The live half of the chat: new and deleted messages as they happen.
 *
 * Connected only while the Community tab is open. The free tier allows two
 * hundred simultaneous listeners, and a chat nobody is looking at does not
 * need one — so the renderer says "open" when the tab mounts and "close" when
 * it leaves, and the socket lives exactly that long. Unread mentions for a
 * closed tab are fetched on the ordinary events instead.
 *
 * The one library dependency in this feature. The Realtime protocol is a
 * Phoenix channel over a WebSocket, with a join handshake, a heartbeat the
 * server requires, and a reference counter on every frame; a hand-rolled copy
 * would be the largest piece of new networking code in the app and would have
 * to be right on the first try. The heartbeat that protocol mandates lives
 * inside the library, which is where a protocol keep-alive belongs — it is not
 * this code guessing at when something will be ready.
 *
 * A token lasts an hour. When the server closes the channel for an expired one,
 * the `CLOSED` status is the event that asks for a fresh token and rejoins.
 */

export type TLiveStatus = 'closed' | 'connecting' | 'live' | 'error';

export interface ILiveEvent {
  kind: 'inserted' | 'deleted';
  message: ICommunityMessage;
}

export interface ICommunityLive {
  open(): void;
  close(): void;
  status(): TLiveStatus;
}

export interface ICommunityLiveOptions {
  config: IAccountConfig;
  accessToken: () => Promise<string>;
  onEvent: (event: ILiveEvent) => void;
  onStatus: (status: TLiveStatus) => void;
  logger?: { info(message: string): void; warn(message: string): void };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

export const createCommunityLive = ({
  config,
  accessToken,
  onEvent,
  onStatus,
  logger,
}: ICommunityLiveOptions): ICommunityLive => {
  let client: RealtimeClient | undefined;
  let channel: RealtimeChannel | undefined;
  let status: TLiveStatus = 'closed';
  let wanted = false;

  const setStatus = (next: TLiveStatus) => {
    if (status !== next) {
      status = next;
      onStatus(next);
    }
  };

  const teardown = () => {
    if (channel) {
      channel.unsubscribe().catch(() => undefined);
      channel = undefined;
    }
    if (client) {
      client.disconnect();
      client = undefined;
    }
  };

  const join = async () => {
    if (!wanted) {
      return;
    }
    setStatus('connecting');
    let token: string;
    try {
      token = await accessToken();
    } catch {
      // Signed out meanwhile. Stay closed; a sign-in reopens through the tab.
      setStatus('closed');
      return;
    }
    if (!wanted) {
      return;
    }
    teardown();
    client = new RealtimeClient(
      `${config.supabaseUrl.replace(/^https:/, 'wss:')}/realtime/v1`,
      {
        params: { apikey: config.supabaseAnonKey },
        // Node has no browser WebSocket for the library to find on its own.
        transport: WebSocket as unknown as typeof globalThis.WebSocket,
      },
    );
    client.setAuth(token);
    channel = client.channel('community-messages');
    channel
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload: { new: unknown }) => {
          const message = readMessage(payload.new);
          if (message) {
            onEvent({ kind: 'inserted', message });
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages' },
        (payload: { new: unknown }) => {
          const row = payload.new;
          if (isRecord(row) && row.deleted_at) {
            const message = readMessage(row);
            if (message) {
              onEvent({ kind: 'deleted', message });
            }
          }
        },
      )
      .subscribe((state, error) => {
        if (state === 'SUBSCRIBED') {
          setStatus('live');
        } else if (state === 'CHANNEL_ERROR' || state === 'TIMED_OUT') {
          logger?.warn(`Community feed: ${state} ${error ?? ''}`);
          setStatus('error');
        } else if (state === 'CLOSED') {
          // The server ends a channel whose token has expired. If the tab is
          // still open, that is the event that asks for a new token.
          if (wanted) {
            join().catch(() => undefined);
          } else {
            setStatus('closed');
          }
        }
      });
  };

  return {
    open: () => {
      if (wanted) {
        return;
      }
      wanted = true;
      join().catch((error) => {
        logger?.warn(`Community feed could not open: ${error}`);
        setStatus('error');
      });
    },
    close: () => {
      wanted = false;
      teardown();
      setStatus('closed');
    },
    status: () => status,
  };
};
