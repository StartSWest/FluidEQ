/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type BrowserWindow } from 'electron';
import {
  isAccountConfigured,
  type IAccountConfig,
} from '../../common/accountConfig';
import type {
  TBuyOutcome,
  TCheckoutOutcome,
  TSceneStoreOutcome,
  TStarterOutcome,
} from '../../common/sceneStore';
import { PACK_ID } from '../../common/scenePackFields';
import { isCheckoutLocale } from '../../common/sceneStore';
import { onAppLink } from '../appLinks';
import { sceneRefOf } from '../plus/galleryAccess';
import type { ISceneOwnership } from '../plus/sceneOwnership';

/**
 * The store as the window sees it: the balance and owned scenes, starter
 * credits, a scene bought, a pack paid for. The window decides nothing — a
 * buy is the server's answer, and the checkout page is opened here, from the
 * server's own address, never from one the page names.
 */

const CHANNELS = [
  'scene-store-get',
  'scene-store-claim',
  'scene-store-buy',
  'scene-store-checkout',
  'scene-store-set-free',
] as const;

export const registerSceneStoreIpc = ({
  getMainWindow,
  config,
  ownership,
  openExternal,
}: {
  getMainWindow: () => BrowserWindow | null;
  config: IAccountConfig;
  ownership: ISceneOwnership;
  /** `safeExternal`'s gate; the page is Stripe's by then (`sceneStoreApi.ts`). */
  openExternal: (url: string) => boolean;
}) => {
  const unavailable = { ok: false as const, reason: 'unavailable' as const };

  // Every change reaches the window as it is, so a buy in one place updates
  // every card that shows the scene.
  const offChanges = ownership.subscribe(() => {
    const store = ownership.known();
    getMainWindow()?.webContents.send('scene-store-changed', store ?? null);
  });

  // Back from Stripe's page through fluideq.com's "Back to FluidEQ"
  // (`appLinks.ts`): the server is asked at once, focus or not, and the
  // window told how the payment ended. A webhook still on its way leaves the
  // balance as it was; the checkout stays owed and the next come-back asks
  // again, as without the link.
  const offLinks = onAppLink((link) => {
    // A creator's return from Stripe is `ipc/creator.ts`'s, never a payment.
    if (link !== 'credits-paid' && link !== 'credits-cancelled') {
      return;
    }
    if (isAccountConfigured(config)) {
      ownership.refreshNow().catch(() => undefined);
    }
    getMainWindow()?.webContents.send(
      'scene-store-checkout-returned',
      link === 'credits-paid' ? 'paid' : 'cancelled',
    );
  });

  ipcMain.handle('scene-store-get', (): Promise<TSceneStoreOutcome> =>
    isAccountConfigured(config)
      ? ownership.refreshNow()
      : Promise.resolve(unavailable),
  );

  ipcMain.handle('scene-store-claim', (): Promise<TStarterOutcome> =>
    isAccountConfigured(config)
      ? ownership.claimStarter()
      : Promise.resolve(unavailable),
  );

  ipcMain.handle(
    'scene-store-buy',
    (_event, authorId: unknown, sceneId: unknown): Promise<TBuyOutcome> => {
      const ref = sceneRefOf(authorId, sceneId);
      if (!ref) {
        return Promise.resolve({ ok: false, reason: 'unknown-scene' });
      }
      return isAccountConfigured(config)
        ? ownership.buy({ authorId: ref.authorId, sceneId: ref.packId })
        : Promise.resolve(unavailable);
    },
  );

  ipcMain.handle(
    'scene-store-checkout',
    async (
      _event,
      packId: unknown,
      locale: unknown,
    ): Promise<TCheckoutOutcome> => {
      if (typeof packId !== 'string') {
        return { ok: false, reason: 'not-on-sale' };
      }
      if (!isAccountConfigured(config)) {
        return unavailable;
      }
      // The window's language, for Stripe's page and the page it returns
      // to; anything else is English rather than a refusal.
      const page = await ownership.checkout(
        packId,
        isCheckoutLocale(locale) ? locale : 'en',
      );
      if (!page.ok) {
        return page;
      }
      return openExternal(page.url)
        ? { ok: true }
        : { ok: false, reason: 'server' };
    },
  );

  // The admin's switch on one of FluidEQ's scenes; the server refuses anyone
  // else, so nothing here asks who is pressing it.
  ipcMain.handle(
    'scene-store-set-free',
    (_event, sceneId: unknown, free: unknown): Promise<TSceneStoreOutcome> =>
      typeof sceneId === 'string' &&
      PACK_ID.test(sceneId) &&
      typeof free === 'boolean' &&
      isAccountConfigured(config)
        ? ownership.setFree(sceneId, free)
        : Promise.resolve(unavailable),
  );

  return {
    dispose: () => {
      offChanges();
      offLinks();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
