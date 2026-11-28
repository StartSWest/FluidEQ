/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import {
  PLUS_SUBSCRIPTION_CHANNELS,
  type TPlusReturn,
} from '../../common/subscription';
import type { ISubscriptionService } from '../account/subscriptionService';
import { onAppLink, type TAppLink } from '../appLinks';

/**
 * Plus's channels, for the main window's own page and nothing else. What
 * crosses from the window is a plan, a language, the terms revision it
 * showed and an offer's id, each a short value by the time the service sees
 * it (the service then checks each against its rules); what goes back is
 * the outcome and the state. No token, and never a page's address: main
 * opens Stripe's pages itself.
 */

const RETURNS: ReadonlyMap<TAppLink, TPlusReturn> = new Map<
  TAppLink,
  TPlusReturn
>([
  ['plus-subscribed', 'subscribed'],
  ['plus-cancelled', 'cancelled'],
  ['plus-managed', 'managed'],
]);

/** Longer than any plan, language or offer id the service takes. */
const MAX_ARGUMENT_LENGTH = 80;

/** A string from the window, or '' (which the service refuses). */
const argument = (value: unknown): string =>
  typeof value === 'string' && value.length <= MAX_ARGUMENT_LENGTH ? value : '';

/** A revision number from the window, or undefined (which reads as changed). */
const revision = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;

const registerPlusSubscriptionIpc = ({
  getMainWindow,
  subscription,
  readAgain,
}: {
  getMainWindow: () => BrowserWindow | null;
  subscription: ISubscriptionService;
  /**
   * The account's Plus asked of the server now, focus or not: back from
   * Stripe's page, the person is looking for the answer.
   */
  readAgain: () => void;
}) => {
  const fromMainWindow = (event: IpcMainInvokeEvent) => {
    const window = getMainWindow();
    return (
      window !== null &&
      !window.isDestroyed() &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    );
  };

  const C = PLUS_SUBSCRIPTION_CHANNELS;

  ipcMain.handle(C.state, (event) => {
    if (!fromMainWindow(event)) {
      throw new Error('Only the main window may ask about Plus');
    }
    return subscription.state();
  });
  ipcMain.handle(
    C.subscribe,
    (event, plan: unknown, locale: unknown, termsShown: unknown) => {
      if (!fromMainWindow(event)) {
        throw new Error('Only the main window may get Plus');
      }
      return subscription.subscribe(
        argument(plan),
        argument(locale),
        revision(termsShown),
      );
    },
  );
  ipcMain.handle(C.manage, (event, locale: unknown) => {
    if (!fromMainWindow(event)) {
      throw new Error('Only the main window may manage Plus');
    }
    return subscription.manage(argument(locale));
  });
  ipcMain.handle(C.dismissLapse, (event, id: unknown) => {
    if (!fromMainWindow(event)) {
      throw new Error('Only the main window may put the offer away');
    }
    subscription.dismissLapse(argument(id));
  });

  const offChange = subscription.onChange(() => {
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(C.changed, subscription.state());
    }
  });

  // Back from Stripe through fluideq.com's "Back to FluidEQ"
  // (`appLinks.ts`). A webhook still on its way leaves Plus as it was; the
  // change stays expected and the next come-back asks again.
  const offLinks = onAppLink((link) => {
    const returned = RETURNS.get(link);
    if (!returned) {
      return;
    }
    readAgain();
    const window = getMainWindow();
    if (window && !window.isDestroyed()) {
      window.webContents.send(C.returned, returned);
    }
  });

  return {
    dispose: () => {
      offChange();
      offLinks();
      [C.state, C.subscribe, C.manage, C.dismissLapse].forEach((channel) =>
        ipcMain.removeHandler(channel),
      );
    },
  };
};

export default registerPlusSubscriptionIpc;
