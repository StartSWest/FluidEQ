import { BrowserWindow, ipcMain } from 'electron';
import type { IAccountConfig } from '../../common/accountConfig';
import type { IAccountSession } from '../account/session';
import {
  CommunityError,
  createCommunityApi,
  type ICommunityApi,
  type TCommunityFailure,
} from '../community/communityApi';
import {
  createCommunityLive,
  type ILiveEvent,
  type TLiveStatus,
} from '../community/communityLive';
import {
  isSampleMessageId,
  isSampleUserId,
  sampleMessages,
} from '../community/sampleCommunity';

/**
 * The community, as the renderer sees it.
 *
 * Every call answers `{ ok, value }` or `{ ok: false, failure }` rather than
 * throwing across the bridge, so the one word the server used survives the
 * trip and the panel can show the sentence that goes with it.
 */

export interface ICommunityIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  config: IAccountConfig;
  session: IAccountSession;
  logger?: { info(message: string): void; warn(message: string): void };
  fetchImpl?: typeof fetch;
  /**
   * DEVELOPMENT ONLY: lay a cast of sample people and their messages over
   * the real channels so the panel can be looked at full. See
   * `sampleCommunity.ts`; `main.ts` sets it only when the app is not packaged.
   */
  sampleContent?: boolean;
}

export type TCommunityResult<T> =
  { ok: true; value: T } | { ok: false; failure: TCommunityFailure };

const CHANNELS = [
  'community-profile',
  'community-create-profile',
  'community-accept-conduct',
  'community-channels',
  'community-messages',
  'community-send',
  'community-delete',
  'community-report',
  'community-blocks',
  'community-block',
  'community-unblock',
  'community-mentions',
  'community-mentions-read',
  'community-open',
  'community-close',
] as const;

const HANDLE = /^[a-z0-9_]{3,20}$/;

const guard =
  <T>(work: () => Promise<T>) =>
  async (): Promise<TCommunityResult<T>> => {
    try {
      return { ok: true, value: await work() };
    } catch (error) {
      if (error instanceof CommunityError) {
        return { ok: false, failure: error.failure };
      }
      return { ok: false, failure: 'network' };
    }
  };

export const registerCommunityIpc = ({
  getMainWindow,
  config,
  session,
  logger,
  fetchImpl,
  sampleContent = false,
}: ICommunityIpcDeps) => {
  const api: ICommunityApi = createCommunityApi({
    config,
    accessToken: () => session.accessToken(),
    fetchImpl,
  });

  const send = (channel: string, payload: unknown) => {
    getMainWindow()?.webContents.send(channel, payload);
  };

  const live = createCommunityLive({
    config,
    accessToken: () => session.accessToken(),
    onEvent: (event: ILiveEvent) => send('community-event', event),
    onStatus: (status: TLiveStatus) => send('community-live-status', status),
    logger,
  });

  ipcMain.handle(
    'community-profile',
    guard(() => api.getMyProfile()),
  );

  ipcMain.handle(
    'community-create-profile',
    (_event, handle: unknown, displayName: unknown) =>
      guard(async () => {
        const wanted =
          typeof handle === 'string' ? handle.trim().toLowerCase() : '';
        const name =
          typeof displayName === 'string'
            ? displayName.trim().slice(0, 40)
            : '';
        if (!HANDLE.test(wanted) || name.length === 0) {
          throw new CommunityError('rejected', 'Handle or name malformed.');
        }
        return api.createProfile(wanted, name);
      })(),
  );

  ipcMain.handle(
    'community-accept-conduct',
    guard(() => api.acceptConduct()),
  );

  ipcMain.handle(
    'community-channels',
    guard(() => api.listChannels()),
  );

  ipcMain.handle(
    'community-messages',
    (_event, channelId: unknown, beforeId: unknown) =>
      guard(async () => {
        if (typeof channelId !== 'string') {
          throw new CommunityError('rejected', 'No channel.');
        }
        const before = typeof beforeId === 'number' ? beforeId : undefined;
        const real = await api.listMessages(channelId, before);
        // The sample rides on the newest page only; older pages are the
        // server's alone, so "show earlier" keeps meaning what it says.
        if (!sampleContent || before !== undefined) {
          return real;
        }
        const me = await api.getMyProfile();
        return [
          ...real,
          ...sampleMessages(channelId, me?.handle ?? 'you'),
        ].sort((a, b) => a.createdAt - b.createdAt);
      })(),
  );

  ipcMain.handle(
    'community-send',
    (_event, channelId: unknown, body: unknown) =>
      guard(async () => {
        if (typeof channelId !== 'string' || typeof body !== 'string') {
          throw new CommunityError('rejected', 'Malformed message.');
        }
        const trimmed = body.trim();
        if (trimmed.length === 0) {
          throw new CommunityError('empty', 'Nothing to send.');
        }
        return api.sendMessage(channelId, trimmed.slice(0, 1_000));
      })(),
  );

  ipcMain.handle('community-delete', (_event, id: unknown) =>
    guard(async () => {
      if (typeof id !== 'number') {
        throw new CommunityError('rejected', 'No message.');
      }
      if (sampleContent && isSampleMessageId(id)) {
        return undefined;
      }
      return api.deleteMessage(id);
    })(),
  );

  ipcMain.handle('community-report', (_event, id: unknown, reason: unknown) =>
    guard(async () => {
      if (typeof id !== 'number' || typeof reason !== 'string') {
        throw new CommunityError('rejected', 'Malformed report.');
      }
      if (sampleContent && isSampleMessageId(id)) {
        return undefined;
      }
      return api.reportMessage(id, reason.trim().slice(0, 500) || 'reported');
    })(),
  );

  ipcMain.handle(
    'community-blocks',
    guard(() => api.listBlocks()),
  );

  ipcMain.handle('community-block', (_event, userId: unknown) =>
    guard(async () => {
      if (typeof userId !== 'string') {
        throw new CommunityError('rejected', 'No user.');
      }
      if (sampleContent && isSampleUserId(userId)) {
        return undefined;
      }
      return api.block(userId);
    })(),
  );

  ipcMain.handle('community-unblock', (_event, userId: unknown) =>
    guard(async () => {
      if (typeof userId !== 'string') {
        throw new CommunityError('rejected', 'No user.');
      }
      return api.unblock(userId);
    })(),
  );

  ipcMain.handle(
    'community-mentions',
    guard(() => api.unreadMentions()),
  );

  ipcMain.handle('community-mentions-read', (_event, ids: unknown) =>
    guard(async () => {
      const list = Array.isArray(ids)
        ? ids.filter((id): id is number => typeof id === 'number')
        : [];
      return api.markMentionsRead(list);
    })(),
  );

  ipcMain.handle('community-open', () => {
    live.open();
    return live.status();
  });

  ipcMain.handle('community-close', () => {
    live.close();
  });

  return {
    dispose: () => {
      live.close();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
