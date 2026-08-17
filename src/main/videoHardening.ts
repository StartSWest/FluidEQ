/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import type { WebContents } from 'electron';
import log from 'electron-log';
import {
  VIDEO_BROWSER_PARTITION,
  VIDEO_LINK_BLOCKED,
  isNavigableVideoUrl,
} from '../common/videoSites';
import {
  HOME_SITE,
  POPUP_WINDOW_OPTIONS,
  attachedPlayers,
  forLog,
  forwardConsole,
  videoPreloadPath,
} from './videoSessionBasics';

/**
 * What a video page is allowed to do.
 *
 * Four hundred and thirty lines, and the whole security posture of the Video
 * tab: which navigations are permitted, what a popup may become, what an
 * attached player may open. Everything else in videoBrowser.ts is plumbing —
 * downloads, console forwarding, the session's own settings — and this is the
 * part where a mistake means a video site running with more reach than it
 * should have.
 *
 * Its own file for that reason rather than for its length. Somebody asking "can
 * this page navigate somewhere it should not" should find one file that
 * answers, not a section of a longer one.
 *
 * The guards are deliberately overlapping and none of them is redundant:
 * `will-navigate` and `will-redirect` catch renderer-initiated moves,
 * `setWindowOpenHandler` catches `target="_blank"`, and
 * `did-start-navigation` is the backstop for a navigation started through the
 * API. Removing any one of them leaves a path open that the others do not see.
 */
/**
 * Apply the rules to one attached player.
 *
 * Navigation is checked in four places, because there are four ways a page can
 * move and no single event sees them all:
 *
 *  - `will-navigate`, for following a link.
 *  - `will-redirect`, for being sent somewhere mid-flight — this is the one
 *    that catches an allowed URL that answers with a 302 to somewhere else.
 *  - the window-open handler, for `target="_blank"`.
 *  - `did-start-navigation`, for everything else. The three above are all
 *    renderer-initiated; a navigation started through the API — our own
 *    `loadURL` — raises none of them. That call is made from FluidEQ's own
 *    code with a URL from the list above, so this is a backstop rather than a
 *    hole being plugged, but it is the difference between "the renderer is
 *    trusted" and "it does not have to be".
 *
 * The `details` object is read rather than the positional `url` argument: the
 * latter is deprecated in Electron 43, and `isMainFrame` is only on the object.
 */
export const hardenPlayer = (contents: WebContents) => {
  attachedPlayers.add(contents);
  contents.once('destroyed', () => {
    attachedPlayers.delete(contents);
  });

  const blockDisallowed = (details: Electron.Event<{ url: string }>) => {
    if (!isNavigableVideoUrl(details.url)) {
      details.preventDefault();
      // Named in the log, every time.
      //
      // The allow-list is the right shape for this app and the wrong thing to
      // debug blind: when a site stops working the only question that matters
      // is which host it wanted, and until now the answer was nowhere. A
      // refusal is not an error — it is the feature working — so this is
      // `info`, and it is the difference between diagnosing the next site in a
      // minute and guessing at it for an afternoon.
      log.info(`Video player refused a navigation to ${forLog(details.url)}`);
    }
  };

  contents.on('will-navigate', blockDisallowed);
  contents.on('will-redirect', blockDisallowed);

  forwardConsole(contents, 'page');

  /**
   * And a page that never arrived.
   *
   * Distinct from a refusal: this is the network or the site failing, which
   * looks identical from the outside — a click that does nothing — and has an
   * entirely different cause. `-3` is an aborted load, which is what every
   * navigation replaced by a newer one reports, so it is not worth a line.
   */
  contents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
    if (errorCode === -3) {
      return;
    }
    log.info(`Video player failed to load ${url}: ${errorDescription}`);
  });

  contents.on('did-start-navigation', (details) => {
    // Every main-frame move, before any judgement is passed on it.
    //
    // The refusals above are only half a diagnosis. When a click does nothing,
    // the question that decides everything is whether the page tried to go
    // anywhere at all — a refusal means the allow-list is wrong, and silence
    // means the click never reached a link and the allow-list is innocent.
    // Logging only the refusals cannot tell those apart: both look like an
    // empty log. So the successes are named too, and `same-document` is on the
    // line because a site whose routing is client-side moves without ever
    // asking for a page.
    if (details.isMainFrame) {
      log.info(
        `Video player navigating to ${forLog(details.url)}${
          details.isSameDocument ? ' (same-document)' : ''
        }`,
      );
    }

    // Same-document moves are YouTube's own routing pushing a new path onto a
    // page that is already loaded and already allowed. There is no request to
    // stop, and stopping one would break ordinary navigation around the site.
    if (
      !details.isMainFrame ||
      details.isSameDocument ||
      isNavigableVideoUrl(details.url)
    ) {
      return;
    }

    // Past the point of cancelling — this fires once the navigation has begun.
    // Stopping it is the recovery: leaving a half-loaded page from an unlisted
    // host on screen would be worse than either allowing it or refusing it
    // cleanly.
    //
    // Deferred, for the same reason `setWindowOpenHandler` below is. This runs
    // inside Chromium's own navigation dispatch, and tearing that navigation
    // down and starting another one from within the notification that it began
    // is re-entrant — it took the whole app down, not just the guest, when
    // YouTube's sign-in link sent the player at `accounts.google.com`. By the
    // next tick the navigation has a state to be stopped from.
    setImmediate(() => {
      if (contents.isDestroyed()) {
        return;
      }
      contents.stop();

      // Home is for when there is nowhere to stay, and only then.
      //
      // This used to load the home page unconditionally, which meant pressing
      // Join on one site put you on a different site's front page — a refusal
      // that reads as the app wandering off. Almost every refusal happens on a
      // page that is itself perfectly allowed: a sign-in link, an advert, a
      // link out to somewhere unlisted. Stopping leaves that page exactly as it
      // was, which is what a browser does and what the notice the renderer
      // raises is written to accompany.
      //
      // The exception is a player with nothing behind it — a refusal on the
      // very first load, where stopping alone would leave a blank guest and no
      // way back. That, and only that, goes home.
      const here = contents.getURL();
      if (!here || !isNavigableVideoUrl(here)) {
        contents.loadURL(HOME_SITE.home).catch(() => {
          // Nothing further to try if even the home page will not load.
        });
      }
    });
  });

  contents.setWindowOpenHandler(({ url, disposition }) => {
    /*
     * AN EMPTY WINDOW, OPENED TO BE FILLED IN A MOMENT.
     *
     * Sign-in flows do not call `window.open` with their address. They open a
     * blank window inside the click handler — synchronously, which is the only
     * way a browser will let a popup through at all — and set its location once
     * the request that decides the address comes back. So the URL this handler
     * is asked about is `about:blank`, which is on no list and never will be,
     * and the answer was to refuse it and raise a notice naming a host that
     * `about:blank` does not have. An unnamed refusal with a button that could
     * not act on it either, since `shell.openExternal` will not take `about:`.
     *
     * Allowed only as a window, and only because refusing it protects nothing.
     * The window arrives empty; there is no content in it to be wary of. What
     * the site then puts in it is a navigation on the popup's own contents, and
     * `hardenPopup` has `will-navigate` and `will-redirect` on that, checked
     * against the same list as everything else. The boundary did not move — it
     * just stopped being enforced one step too early, at the moment a window
     * was asked for rather than at the moment it was pointed somewhere.
     */
    const isBlankPopup = disposition === 'new-window' && url === 'about:blank';

    if (isBlankPopup) {
      log.info('Video player opened an empty popup window, to be navigated');
      return {
        action: 'allow',
        overrideBrowserWindowOptions: POPUP_WINDOW_OPTIONS,
      };
    }

    if (!isNavigableVideoUrl(url)) {
      // Say so, rather than dropping it in silence.
      //
      // `will-navigate` has a listener in the renderer that raises the notice
      // naming the host; a popup denied here had nothing of the kind, so a
      // click that opened a new window to somewhere unlisted simply did
      // nothing at all. That is indistinguishable from a broken page, and the
      // whole point of the allow-list is that a boundary should be legible.
      //
      // `about:blank` is the one to watch for: a site that opens an empty
      // window and then navigates it asks about the blank, which is never on
      // the list, so this is the only place that behaviour is visible at all.
      log.info(`Video player refused a popup to ${forLog(url)}`);
      contents.hostWebContents?.send(VIDEO_LINK_BLOCKED, url);
      return { action: 'deny' };
    }

    /*
     * A LINK THAT WANTED A TAB BECOMES THE PLAYER. A WINDOW THAT WANTED TO BE A
     * WINDOW GETS TO BE ONE.
     *
     * Everything used to be denied and loaded into the player instead, which is
     * right for the common case — these sites open a video from a channel page
     * or a track from a search result in a new tab, there is only ever one
     * player, and losing the click would be worse than reusing it.
     *
     * It is wrong for the other case, and the other case is signing in.
     * `window.open` returns `null` to a page whose popup was denied, and a site
     * reads that as the browser having a popup blocker turned on. SoundCloud
     * says so out loud — "Please enable popup windows and try again" — and
     * Spotify simply does nothing, which is the same failure without the
     * courtesy. Navigating the opener out from under the flow does not help
     * either: the popup is supposed to hand its result back through
     * `window.opener`, and there is no opener left if the opener has gone
     * somewhere else.
     *
     * `disposition` separates them exactly. A `target="_blank"` link arrives as
     * a tab; `window.open` with a size, which is what every sign-in flow uses,
     * arrives as `new-window`.
     */
    if (disposition === 'new-window') {
      log.info(`Video player opened a popup window to ${forLog(url)}`);
      return {
        action: 'allow',
        overrideBrowserWindowOptions: POPUP_WINDOW_OPTIONS,
      };
    }

    // Deferred: this runs inside Chromium's own window-open handling, and
    // navigating the contents that is being asked about, from inside the
    // answer, is a re-entrant call.
    log.info(`Video player took a popup to ${forLog(url)} into the player`);
    setImmediate(() => {
      if (!contents.isDestroyed()) {
        contents.loadURL(url).catch(() => {
          // A navigation that loses a race with another is not an error.
        });
      }
    });
    return { action: 'deny' };
  });

  // Not `shell.openExternal`, deliberately. Handing a URL chosen by a web page
  // to the user's real browser is exactly the escape this file exists to
  // prevent; the only thing that may do that is a button the user pressed in
  // FluidEQ's own UI, showing the address it is about to open.
};

/**
 * Strip whatever the renderer asked for and impose what it gets.
 *
 * The renderer is trusted here, but this is the documented seam for a webview
 * and the cost of closing it is a dozen lines. Chief among them the preload:
 * left to the tag, the preload path is an attribute in the DOM, and a script
 * injection in the window would become code running next to the page.
 */
export const hardenAttachment = (
  event: Electron.Event,
  webPreferences: Electron.WebPreferences,
  params: Record<string, string>,
) => {
  // An unset or blank `src` is allowed through. React sets the attribute before
  // the element reaches the document, so in practice it is the home page — but
  // refusing the attachment outright on an empty string would mean one ordering
  // change upstream silently leaving the tab with no player in it at all, and
  // there is nothing dangerous about `about:blank`. A src that *is* set and is
  // not on the list is still refused, and every navigation after this point has
  // to pass the same check anyway.
  const src = params.src ?? '';
  if (src && src !== 'about:blank' && !isNavigableVideoUrl(src)) {
    event.preventDefault();
    return;
  }

  webPreferences.preload = videoPreloadPath();

  webPreferences.nodeIntegration = false;
  webPreferences.nodeIntegrationInSubFrames = false;
  webPreferences.contextIsolation = true;
  webPreferences.sandbox = true;
  webPreferences.webSecurity = true;
  webPreferences.allowRunningInsecureContent = false;
  webPreferences.experimentalFeatures = false;

  // The tag's own attributes, decided here rather than in markup.
  params.partition = VIDEO_BROWSER_PARTITION;

  /*
   * POPUPS ARE ALLOWED AT THE TAG, AND JUDGED ONE BY ONE ABOVE.
   *
   * This used to `delete params.allowpopups`, and that single line was the
   * reason signing in failed. Without the attribute a `<webview>` cannot open a
   * window at all: `window.open` returns `null` before Chromium ever asks the
   * window-open handler about it. So the handler's careful answers were being
   * given to a question nobody was asking, and the site saw exactly what a
   * popup blocker looks like — SoundCloud said so, Spotify just stopped.
   *
   * Deleting it looked like defence in depth and was not. Depth needs two
   * layers that fail differently; this was the same allow-list decision made
   * twice, once as "no, never" and once as "only these hosts" — and the blunt
   * one won, so the considered one never ran.
   *
   * The boundary is unchanged. Every popup still goes through
   * `setWindowOpenHandler`, is still checked against the allow-list, and is
   * still refused with a notice when it fails. What changed is that a window
   * that passes now actually opens.
   */
  params.allowpopups = 'true';
};

/**
 * Lock down a sign-in popup opened by a player.
 *
 * It is a window rather than a webview, so `hardenAttachment` never sees it and
 * its preferences came from the answer that allowed it. What it still needs is
 * the navigation guard: a login flow redirects several times, and every one of
 * those hops has to be held to the same list as the player's own.
 *
 * Not given the player's other treatment, deliberately. It is not added to
 * `attachedPlayers` — it holds no playback and a sign-out sending it "home" to
 * YouTube would be nonsense — and it has no home-page backstop, because the
 * right answer for a popup that tries to leave the list is to refuse the
 * navigation and let the window sit there, not to turn a login window into a
 * second video player.
 */
export const hardenPopup = (contents: WebContents) => {
  const blockDisallowed = (details: Electron.Event<{ url: string }>) => {
    if (!isNavigableVideoUrl(details.url)) {
      details.preventDefault();
      log.info(`Sign-in popup refused a navigation to ${forLog(details.url)}`);
    }
  };

  contents.on('will-navigate', blockDisallowed);
  contents.on('will-redirect', blockDisallowed);

  // A popup opening a further popup is not a flow any of these sites uses, and
  // is what a hijacked one would try. One window deep is the whole allowance.
  contents.setWindowOpenHandler(({ url }) => {
    log.info(`Sign-in popup refused a popup to ${forLog(url)}`);
    return { action: 'deny' };
  });

  /*
   * SAY WHAT THIS WINDOW IS DOING, NOT ONLY WHAT IT WAS STOPPED FROM DOING.
   *
   * Until now the only line a sign-in window ever wrote was a refusal. It
   * opened, and then the log went quiet — so "the popup opened and the sign-in
   * did not work" was the entire evidence available, and several attempts at
   * fixing it were guesses dressed up as diagnoses. The player has had this
   * treatment since it was written, which is why every problem on the player
   * side was found in one reading.
   *
   * A sign-in is a chain of redirects across three or four hosts, and where it
   * stops is the whole answer. That chain is now written down.
   */
  contents.on('did-start-navigation', (details) => {
    if (details.isMainFrame) {
      log.info(`Sign-in popup navigating to ${forLog(details.url)}`);
    }
  });

  // Redirects, which `did-start-navigation` does not repeat for.
  //
  // A server-side chain is one navigation with several hops, so the last run
  // showed the window going to Google and nothing after it — when what actually
  // happened was Google answering and redirecting back to SoundCloud's callback,
  // where the crash was. The hop that is not logged is the hop the bug is on.
  contents.on('did-redirect-navigation', (details) => {
    if (details.isMainFrame) {
      log.info(`Sign-in popup redirected to ${forLog(details.url)}`);
    }
  });

  contents.on('did-fail-load', (_event, errorCode, errorDescription, url) => {
    // `-3` is an aborted load, which every navigation replaced by a newer one
    // reports. A redirect chain is made of those.
    if (errorCode !== -3) {
      log.info(
        `Sign-in popup failed to load ${forLog(url)}: ${errorDescription}`,
      );
    }
  });

  /*
   * DO WHAT A BROWSER DOES: HAND THE WINDOW ITS OPENER'S SESSION STORAGE.
   *
   * The HTML spec says a browsing context created by `window.open` starts with
   * a copy of its opener's session storage. Chromium does it; Electron does not,
   * and the difference is invisible until a site leans on it.
   *
   * SoundCloud leans on it. Its "verifying device" step writes a nonce into
   * `sessionStorage`, then opens this window, then reads the nonce back in the
   * callback — and the callback found nothing, so it crashed on
   * `e.state.substring(2)` and closed itself. Measured, not guessed: this window
   * reported `{"opener":true,"keys":[],"local":17}` on every attempt. An opener
   * it had; local storage it had, seventeen keys of it; session storage was
   * empty every time.
   *
   * Seeded once, while the window is still `about:blank` and therefore still on
   * the opener's origin — which is exactly when a browser does it, and is what
   * makes the copy land under the right origin for the rest of the flow.
   *
   * The data goes across as JSON through a string literal rather than being
   * spliced into source, so a value that happens to contain a quote is a value
   * and not code. Nothing is read back and nothing is logged but a count: the
   * point is to move somebody's sign-in state from one window to another, not
   * to look at it.
   */
  const { opener } = contents;
  // Which frame Electron considers the opener, from the side that knows. The
  // page's own view of it can only ever be "same origin or not".
  log.info(
    `Sign-in popup opened by ${opener ? forLog(opener.url) : 'nothing'}`,
  );
  if (opener) {
    opener
      .executeJavaScript('JSON.stringify(sessionStorage)')
      .then((dump: unknown) =>
        contents.executeJavaScript(
          `(() => {
            const carried = JSON.parse(${JSON.stringify(String(dump))});
            const names = Object.keys(carried);
            names.forEach((name) => {
              try {
                sessionStorage.setItem(name, carried[name]);
              } catch (error) {
                // A full or unavailable store is not worth failing the whole
                // sign-in over; the site will say so itself if it matters.
              }
            });
            return names.length;
          })()`,
        ),
      )
      .then((carried) =>
        log.info(`Sign-in popup inherited ${carried} session-storage keys`),
      )
      .catch(() => {
        // Either window can go away mid-copy, and a sign-in that never opened
        // is not a failure worth a line of its own.
      });
  }

  forwardConsole(contents, 'signin');

  // How it ended. A flow that succeeded closes its own window, so this line is
  // the difference between "finished" and "gave up and closed it by hand" —
  // which are the same screenshot and different bugs.
  contents.on('destroyed', () => {
    log.info('Sign-in popup closed');
  });
};
