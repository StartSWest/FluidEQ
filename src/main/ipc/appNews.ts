/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import fs from 'fs';
import path from 'path';
import { ipcMain, type BrowserWindow } from 'electron';
import {
  ACCOUNT_CONFIG,
  type IAccountConfig,
} from '../../common/accountConfig';
import {
  currentAppNews,
  newsRow,
  parseAppNews,
  type IAppNews,
  type IAppNewsState,
} from '../../common/appNews';
import { isRecord } from '../../common/sceneAnnouncements';
import writeFileAtomically from '../atomicWrite';
import type { IGalleryAccess } from '../plus/galleryAccess';
import { rpc } from '../plus/galleryApi';
import {
  newsWasRead,
  readNewsReadState,
  rememberNewsRead,
  type TNewsReadState,
} from './appNewsReadState';

const CHANNELS = ['app-news', 'app-news-seen'] as const;

/** Called by the existing announcements service, on its existing refresh events. */
export const registerAppNewsIpc = ({
  getMainWindow,
  userDataDir,
  access,
  logger,
  config = ACCOUNT_CONFIG,
}: {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  access: IGalleryAccess;
  logger?: { warn(message: string): void };
  config?: IAccountConfig;
}) => {
  const filePath = path.join(userDataDir, 'app-news.json');
  let publicItems: IAppNews[] = [];
  let accountItems: IAppNews[] = [];
  let owner = access.accountId();
  let seen: TNewsReadState = {};
  let offline = false;
  let generation = 0;
  let pending = false;
  let asking: Promise<void> | undefined;
  let inFlight: AbortController | undefined;
  let disposed = false;
  let sent = '';
  try {
    const saved: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    if (isRecord(saved)) {
      publicItems = parseAppNews(saved.items).filter(
        (item) => item.audience === 'everyone',
      );
      seen = readNewsReadState(saved.seen);
    }
  } catch {
    // A missing or damaged local cache is replaced after the next successful read.
  }

  const persist = () => {
    try {
      // Account-only copy never enters the shared disk cache.
      writeFileAtomically(
        filePath,
        JSON.stringify({ items: publicItems.map(newsRow), seen }),
      );
    } catch (error) {
      logger?.warn(`App news could not be remembered: ${String(error)}`);
    }
  };
  const state = (): IAppNewsState => {
    const account = access.accountId();
    const items = currentAppNews([
      ...publicItems,
      ...(account && account === owner ? accountItems : []),
    ]);
    return {
      items,
      offline,
      unread: items
        .filter(
          (item) =>
            !newsWasRead(
              seen,
              item.audience === 'everyone' ? 'public' : `account:${account}`,
              item,
            ),
        )
        .map((item) => item.id),
    };
  };
  const announce = () => {
    if (disposed) {
      return;
    }
    const next = state();
    const serialized = JSON.stringify(next);
    if (serialized !== sent) {
      sent = serialized;
      getMainWindow()?.webContents.send('app-news-changed', next);
    }
  };
  const identityChanged = () => {
    if (owner !== access.accountId()) {
      owner = access.accountId();
      accountItems = [];
      generation += 1;
      inFlight?.abort();
      // Remove the former account's news before waiting on any network request.
      announce();
    }
  };
  const ask = async () => {
    identityChanged();
    const account = owner;
    const ticket = generation;
    const controller = new AbortController();
    inFlight = controller;
    try {
      // A displaced account's token refresh must not hold the new account's
      // feed in the queue. The session still owns that refresh; its result is ignored.
      const accountAuth = () => {
        const aborted = new Promise<never>((_resolve, reject) => {
          if (controller.signal.aborted) {
            reject(controller.signal.reason);
          } else {
            controller.signal.addEventListener(
              'abort',
              () => reject(controller.signal.reason),
              { once: true },
            );
          }
        });
        return Promise.race([
          Promise.resolve().then(() => access.auth()),
          aborted,
        ]);
      };
      const auth = account ? await accountAuth() : undefined;
      const response = auth
        ? await rpc(auth, 'current_app_news', {}, controller.signal)
        : await fetch(
            new URL('/rest/v1/rpc/current_app_news', config.supabaseUrl),
            {
              method: 'POST',
              headers: {
                apikey: config.supabaseAnonKey,
                'Content-Type': 'application/json',
                Accept: 'application/json',
              },
              body: '{}',
              signal: controller.signal,
            },
          );
      if (ticket !== generation || account !== access.accountId()) {
        return;
      }
      if (!response.ok) {
        if (response.status === 404) {
          publicItems = [];
          accountItems = [];
          offline = false;
          persist();
        } else {
          offline = true;
        }
        return;
      }
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) {
        throw new Error('Invalid app news response');
      }
      if (ticket !== generation || account !== access.accountId()) {
        return;
      }
      const items = parseAppNews(rows);
      publicItems = items.filter((item) => item.audience === 'everyone');
      accountItems =
        account && auth
          ? items.filter((item) => item.audience === 'accounts')
          : [];
      offline = false;
      persist();
    } catch (error) {
      if (ticket !== generation || disposed) {
        return;
      }
      offline = true;
      logger?.warn(`App news could not be read: ${String(error)}`);
    }
  };
  const refresh = async () => {
    if (disposed) {
      return;
    }
    identityChanged();
    pending = true;
    if (!asking) {
      asking = (async () => {
        while (pending) {
          pending = false;
          await ask();
          announce();
        }
      })().finally(() => {
        asking = undefined;
      });
    }
    await asking;
  };

  ipcMain.handle('app-news', async (_event, renew: unknown) => {
    if (renew === true) {
      await refresh();
    }
    return state();
  });
  ipcMain.handle('app-news-seen', (_event, id: unknown) => {
    const { items } = state();
    const shown = items.find((item) => item.id === id);
    if (shown) {
      // Putting away the newest also puts away its backlog: no burst of old cards.
      const account = access.accountId();
      seen = rememberNewsRead(
        seen,
        ['public', ...(account ? [`account:${account}`] : [])],
        shown,
      );
      persist();
    }
    announce();
    return state();
  });
  return {
    refresh,
    dispose: () => {
      disposed = true;
      pending = false;
      generation += 1;
      inFlight?.abort();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
