/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { app } from 'electron';

/**
 * Links that open FluidEQ: `fluideq://…`, the one thing a web page can hand
 * the app.
 *
 * A pack of credits is paid for in the browser, and the app hears of it only
 * when somebody comes back to its window (`plus/sceneOwnership.ts`). The page
 * Stripe returns to on fluideq.com has a "Back to FluidEQ" button that opens
 * one of these, which brings the window up and asks the server for the store
 * at once (Ivan, 2026-10-21: "make sure the app captures the payment").
 *
 * Only the credits' two returns are understood, and all either can do is ask
 * the server again and bring the window forward: a page that opens one on its
 * own costs a request, nothing more.
 */

export const APP_LINK_SCHEME = 'fluideq';

export type TAppLink = 'credits-paid' | 'credits-cancelled';

const LINKS: ReadonlyMap<string, TAppLink> = new Map<string, TAppLink>([
  ['credits/paid', 'credits-paid'],
  ['credits/cancelled', 'credits-cancelled'],
]);

/** What a `fluideq://` address asks for; anything else is not a link. */
export const appLinkOf = (value: string): TAppLink | undefined => {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return undefined;
  }
  // Only the `fluideq://credits/…` form the return pages write: without the
  // slashes there is no host, and the path alone would read the same.
  if (url.protocol !== `${APP_LINK_SCHEME}:` || url.host === '') {
    return undefined;
  }
  // `fluideq://credits/paid` parses with host "credits" and path "/paid".
  const path = `${url.host}${url.pathname}`.replace(/\/+$/, '').toLowerCase();
  return LINKS.get(path);
};

/**
 * The link among a launch's arguments: Windows and Linux start the app with
 * the address as one of them, and a second launch hands its own over.
 */
export const appLinkInArgs = (
  argv: readonly string[],
): TAppLink | undefined => {
  return argv
    .map(appLinkOf)
    .find((link): link is TAppLink => link !== undefined);
};

const listeners = new Set<(link: TAppLink) => void>();

/** Hear every link that opens the app from now on. */
export const onAppLink = (listener: (link: TAppLink) => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const deliverAppLink = (link: TAppLink): void => {
  listeners.forEach((listener) => listener(link));
};

/**
 * Tells the system FluidEQ opens `fluideq://`, installed builds only. A
 * development copy would take the links from the installed FluidEQ, which
 * shares the per-user registration. The installer registers the scheme as
 * well (`protocols` in the build config); this covers a copy installed before
 * it did, and is skipped when FluidEQ already holds it.
 */
export const registerAppLinks = (): void => {
  if (app.isPackaged && !app.isDefaultProtocolClient(APP_LINK_SCHEME)) {
    app.setAsDefaultProtocolClient(APP_LINK_SCHEME);
  }
  // macOS hands a link to the running app as an event, not an argument.
  app.on('open-url', (event, url) => {
    event.preventDefault();
    const link = appLinkOf(url);
    if (link) {
      deliverAppLink(link);
    }
  });
};
