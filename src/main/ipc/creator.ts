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
  TCreatorFailure,
  TCreatorOutcome,
} from '../../common/creatorPayouts';
import { isCheckoutLocale } from '../../common/sceneStore';
import type { IAccountSession } from '../account/session';
import { onAppLink } from '../appLinks';
import {
  fetchCreatorStatus,
  openCreatorDashboard,
  refreshCreatorAccount,
  startCreatorSignUp,
} from '../plus/creatorApi';
import type { IGalleryAuth } from '../plus/galleryAccess';

/**
 * A creator's payouts as the window sees them: the figures, signing up on
 * Stripe's pages, and the creator's Stripe dashboard. The window decides
 * nothing; the pages are opened here, and only when they are Stripe's.
 *
 * Back from Stripe's sign-up, fluideq.com's page opens a `fluideq://creators`
 * link (`appLinks.ts`): Stripe is asked what the account can do now and the
 * window told, whether or not it has the focus.
 */

const CHANNELS = [
  'creator-get',
  'creator-sign-up',
  'creator-dashboard',
  'creator-refresh',
] as const;

export type TCreatorOpened =
  { ok: true } | { ok: false; reason: TCreatorFailure };

type TPage = { ok: true; url: string } | { ok: false; reason: TCreatorFailure };

export const registerCreatorIpc = ({
  getMainWindow,
  config,
  session,
  openExternal,
  fetchImpl,
}: {
  getMainWindow: () => BrowserWindow | null;
  config: IAccountConfig;
  session: Pick<IAccountSession, 'state' | 'accessToken'>;
  /** `safeExternal`'s gate; the page is Stripe's by then (`creatorApi.ts`). */
  openExternal: (url: string) => boolean;
  fetchImpl?: typeof fetch;
}) => {
  const accountId = () => session.state().identity?.id;

  /** Who is asking, or why nobody can. */
  const authNow = async (): Promise<
    | { ok: true; auth: IGalleryAuth; userId: string }
    | { ok: false; reason: TCreatorFailure }
  > => {
    if (!isAccountConfigured(config)) {
      return { ok: false, reason: 'unavailable' };
    }
    const userId = accountId();
    if (!userId) {
      return { ok: false, reason: 'signed-out' };
    }
    try {
      const accessToken = await session.accessToken();
      return accessToken && accountId() === userId
        ? {
            ok: true,
            auth: { config, accessToken, ...(fetchImpl ? { fetchImpl } : {}) },
            userId,
          }
        : { ok: false, reason: 'signed-out' };
    } catch {
      return { ok: false, reason: 'signed-out' };
    }
  };

  /** An answer for the account that asked, never for the one after it. */
  const forTheSame = (
    userId: string,
    outcome: TCreatorOutcome,
  ): TCreatorOutcome =>
    accountId() === userId ? outcome : { ok: false, reason: 'signed-out' };

  const status = async (): Promise<TCreatorOutcome> => {
    const asking = await authNow();
    if (!asking.ok) {
      return asking;
    }
    return forTheSame(asking.userId, await fetchCreatorStatus(asking.auth));
  };

  /** Stripe asked, then the server, and the window told. */
  const refreshed = async (): Promise<TCreatorOutcome> => {
    const asking = await authNow();
    if (!asking.ok) {
      return asking;
    }
    // A refusal here is no reason to keep the figures back: an account not
    // begun has nothing at Stripe to ask about, and the status says so.
    await refreshCreatorAccount(asking.auth);
    const outcome = forTheSame(
      asking.userId,
      await fetchCreatorStatus(asking.auth),
    );
    if (outcome.ok) {
      getMainWindow()?.webContents.send('creator-changed', outcome.status);
    }
    return outcome;
  };

  const opened = (page: TPage): TCreatorOpened => {
    if (!page.ok) {
      return page;
    }
    return openExternal(page.url)
      ? { ok: true }
      : { ok: false, reason: 'server' };
  };

  const offLinks = onAppLink((link) => {
    if (link === 'creators-ready' || link === 'creators-continue') {
      refreshed().catch(() => undefined);
    }
  });

  ipcMain.handle('creator-get', (): Promise<TCreatorOutcome> => status());

  ipcMain.handle(
    'creator-sign-up',
    async (
      _event,
      country: unknown,
      locale: unknown,
    ): Promise<TCreatorOpened> => {
      const asking = await authNow();
      if (!asking.ok) {
        return asking;
      }
      return opened(
        await startCreatorSignUp(
          asking.auth,
          typeof country === 'string' ? country : undefined,
          isCheckoutLocale(locale) ? locale : 'en',
        ),
      );
    },
  );

  ipcMain.handle('creator-dashboard', async (): Promise<TCreatorOpened> => {
    const asking = await authNow();
    if (!asking.ok) {
      return asking;
    }
    return opened(await openCreatorDashboard(asking.auth));
  });

  ipcMain.handle('creator-refresh', (): Promise<TCreatorOutcome> =>
    refreshed(),
  );

  return {
    dispose: () => {
      offLinks();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
