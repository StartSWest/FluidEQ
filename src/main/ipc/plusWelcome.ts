/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app, ipcMain, type BrowserWindow } from 'electron';
import type { IEntitlement } from '../account/entitlement';
import {
  forgetPlusWelcomeSeen,
  PLUS_WELCOME_EDITION,
  readPlusWelcomeSeen,
  writePlusWelcomeSeen,
} from '../account/plusWelcomeSeen';
import type { IAccountSession } from '../account/session';

/**
 * The welcome a member sees the first time this app knows they are one.
 *
 * Paying happens at the merchant, in a browser, and the app learns of it when
 * the membership check comes back — which is a moment nothing on screen used
 * to mark: everything simply became available, and somebody who had just paid
 * was left to discover what for. This is the mark.
 *
 * The decision is here rather than in the window because both facts it rests
 * on are: whether the membership is live, and whether this account has been
 * welcomed on this computer. The renderer draws what it is sent and says when
 * it was closed.
 *
 * It waits for the membership rather than for the payment, so it is the same
 * moment however Plus arrived — paid for here, gifted, or already on when the
 * app was installed on a second computer.
 */

export interface IPlusWelcomeIpcDeps {
  getMainWindow: () => BrowserWindow | null;
  userDataDir: string;
  session: IAccountSession;
  entitlement: IEntitlement;
  logger?: { info(message: string): void; warn(message: string): void };
}

export interface IPlusWelcomeRegistration {
  dispose(): void;
}

/** What crosses to the renderer: the edition to welcome with, or null. */
export type TPlusWelcomeState = { edition: number } | null;

const CHANNELS = ['plus-welcome', 'plus-welcome-seen'] as const;

export const registerPlusWelcomeIpc = ({
  getMainWindow,
  userDataDir,
  session,
  entitlement,
  logger,
}: IPlusWelcomeIpcDeps): IPlusWelcomeRegistration => {
  // Closed this session. The file is the record that outlives it, but a disk
  // that refuses the write must not put the welcome back on screen after
  // somebody closed it.
  const closedNow = new Set<string>();
  let sent = JSON.stringify(null);

  const accountId = () => session.state().identity?.id;

  const state = (): TPlusWelcomeState => {
    const id = accountId();
    if (!id || entitlement.status().state === 'none') {
      return null;
    }
    if (closedNow.has(id)) {
      return null;
    }
    return readPlusWelcomeSeen(userDataDir, id) >= PLUS_WELCOME_EDITION
      ? null
      : { edition: PLUS_WELCOME_EDITION };
  };

  // Sent only when it changed: the membership is re-read on every come-back
  // and almost always says the same thing.
  const announce = () => {
    const current = state();
    const serialised = JSON.stringify(current);
    if (serialised === sent) {
      return;
    }
    sent = serialised;
    getMainWindow()?.webContents.send('plus-welcome-changed', current);
  };

  ipcMain.handle('plus-welcome', () => state());

  // The renderer names the edition it showed, so a window running older code
  // than this process cannot record a welcome it never gave.
  ipcMain.handle('plus-welcome-seen', (_event, edition: unknown) => {
    const id = accountId();
    if (id && edition === PLUS_WELCOME_EDITION) {
      closedNow.add(id);
      try {
        writePlusWelcomeSeen(userDataDir, id, PLUS_WELCOME_EDITION);
      } catch (error) {
        logger?.warn(`The Plus welcome could not be remembered: ${error}`);
      }
    }
    announce();
    return state();
  });

  /**
   * A membership that has gone takes its welcome with it.
   *
   * The record belongs to the membership, not to the account: somebody who
   * cancels and comes back a year later is arriving at Plus again and is
   * welcomed again, and the development pair — pretend a payment, pretend a
   * cancellation — walks the whole path each time instead of once ever. Only
   * while somebody is signed in, so signing out (which reads as no membership
   * from here) never clears anybody's.
   */
  const forgetIfMembershipGone = () => {
    const id = accountId();
    if (!id || entitlement.status().state !== 'none') {
      return;
    }
    closedNow.delete(id);
    try {
      forgetPlusWelcomeSeen(userDataDir, id);
    } catch (error) {
      logger?.warn(`The Plus welcome could not be forgotten: ${error}`);
    }
  };

  // Signing in, signing out, and a membership starting or ending all arrive
  // here as a change of membership — including the one that lands when
  // somebody comes back from paying.
  const unsubscribe = entitlement.subscribe(() => {
    forgetIfMembershipGone();
    announce();
  });
  // `ready` rather than now, for the reason `ipc/account.ts` gives: before it
  // the stored session cannot be read, and nobody would seem signed in.
  app
    .whenReady()
    .then(() => {
      announce();
      return undefined;
    })
    .catch(() => undefined);

  return {
    dispose: () => {
      unsubscribe();
      CHANNELS.forEach((channel) => ipcMain.removeHandler(channel));
    },
  };
};
