/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

/**
 * The rules the built-in player runs under.
 *
 * Embedding Chromium in a desktop app means the app now has an attack surface
 * the size of the web, and none of the things a real browser has grown to
 * defend it — no omnibox showing where you actually are, no Safe Browsing, no
 * separate process boundary the user understands. So the player is not given
 * the web: it is given six sites, no downloads, no permissions worth having,
 * and a page that tries to leave simply does not.
 *
 * Every one of these is enforced here, in the main process. The renderer half
 * of the player checks the same list, but only so it can say something useful
 * when a link goes nowhere — a compromised renderer could skip its check, and
 * this file is what makes that not matter.
 */

import { app, ipcMain, session, shell, WebContents } from 'electron';
import log from 'electron-log';
import path from 'path';
import {
  VIDEO_BROWSER_PARTITION,
  VIDEO_SITES,
  isAllowedVideoUrl,
  VIDEO_LINK_BLOCKED,
} from '../common/videoSites';
import {
  VIDEO_AD_BLOCK_CHANGED,
  VIDEO_AD_BLOCK_DEFAULT,
  VIDEO_AD_BLOCK_REQUEST,
} from '../common/videoAdBlock';

/**
 * The only thing the player is allowed to ask for.
 *
 * Fullscreen, because the fullscreen button is most of the point of a video.
 * Everything else — camera, microphone, location, notifications, MIDI, USB,
 * serial, clipboard reads, screen capture — is refused without being shown to
 * the user at all. A permission prompt raised by a web page inside an
 * equalizer is not a decision anyone can make well, and none of these sites
 * needs one to play a video.
 */
const GRANTED_PERMISSIONS = new Set(['fullscreen']);

/** Where a player is sent when it has to be pulled back from somewhere else. */
const HOME_SITE = VIDEO_SITES[0];

/** Whether the blocker is on. Mirrored from the window, which persists it. */
let isAdBlockEnabled = VIDEO_AD_BLOCK_DEFAULT;

const videoPreloadPath = () =>
  app.isPackaged
    ? path.join(__dirname, 'video-preload.js')
    : path.join(__dirname, '../../.erb/dll/video-preload.js');

/**
 * A user agent with FluidEQ's fingerprints filed off.
 *
 * Electron's default advertises both `Electron/43.2.0` and the app's own name
 * and version. YouTube reads that and serves a degraded page — and it is also
 * gratuitous: telling every site which build of which audio utility somebody
 * is running identifies them far more precisely than a plain Chrome string.
 * What is left is what the underlying Chromium really is.
 */
const browserUserAgent = () =>
  app.userAgentFallback
    .replace(/\s(Electron|FluidEQ|fluideq)\/[\d.]+/gi, '')
    .trim();

/** Every attached player, for pushing a settings change out to all of them. */
const attachedPlayers = new Set<WebContents>();

const broadcastAdBlockSetting = () => {
  attachedPlayers.forEach((contents) => {
    if (!contents.isDestroyed()) {
      contents.send(VIDEO_AD_BLOCK_CHANGED, isAdBlockEnabled);
    }
  });
};

/**
 * Lock down the player's session.
 *
 * Separate from the app's own session, so a site's cookies never sit in the
 * same jar as anything FluidEQ stores, and so none of this leaks onto the
 * window's own web contents.
 */
const lockDownSession = () => {
  const videoSession = session.fromPartition(VIDEO_BROWSER_PARTITION);

  videoSession.setUserAgent(browserUserAgent());

  videoSession.setPermissionRequestHandler(
    (_contents, permission, callback) => {
      callback(GRANTED_PERMISSIONS.has(permission));
    },
  );

  videoSession.setPermissionCheckHandler((_contents, permission) =>
    GRANTED_PERMISSIONS.has(permission),
  );

  // Nothing here may enumerate a HID, serial or USB device.
  videoSession.setDevicePermissionHandler(() => false);

  // The app's own window is allowed to capture system audio — that is the
  // spectrum analyser, and the handler for it is in main.ts. A web page inside
  // the player must never get near that API: it would hand a site a recording
  // of whatever the machine is playing.
  videoSession.setDisplayMediaRequestHandler((_request, callback) => {
    callback({});
  });

  // A download started by a web page is a file arriving on someone's disk
  // because of markup they did not read. There is no download UI here, no
  // scanning and no way to show where it went, so the answer is no.
  videoSession.on('will-download', (event) => {
    event.preventDefault();
  });
};

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
const hardenPlayer = (contents: WebContents) => {
  attachedPlayers.add(contents);
  contents.once('destroyed', () => {
    attachedPlayers.delete(contents);
  });

  const blockDisallowed = (details: Electron.Event<{ url: string }>) => {
    if (!isAllowedVideoUrl(details.url)) {
      details.preventDefault();
    }
  };

  contents.on('will-navigate', blockDisallowed);
  contents.on('will-redirect', blockDisallowed);

  contents.on('did-start-navigation', (details) => {
    // Same-document moves are YouTube's own routing pushing a new path onto a
    // page that is already loaded and already allowed. There is no request to
    // stop, and stopping one would break ordinary navigation around the site.
    if (
      !details.isMainFrame ||
      details.isSameDocument ||
      isAllowedVideoUrl(details.url)
    ) {
      return;
    }

    // Past the point of cancelling — this fires once the navigation has begun.
    // Stopping it and returning to somewhere known is the honest recovery:
    // leaving a half-loaded page from an unlisted host on screen would be
    // worse than either allowing it or refusing it cleanly.
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
      contents.loadURL(HOME_SITE.home).catch(() => {
        // Nothing further to try if even the home page will not load.
      });
    });
  });

  contents.setWindowOpenHandler(({ url }) => {
    // These sites open plenty of things in a new tab — a video from a channel
    // page, a track from a search result. There is only ever one player, so an
    // allowed destination is loaded into it rather than lost.
    //
    // Deferred: this runs inside Chromium's own window-open handling, and
    // navigating the contents that is being asked about, from inside the
    // answer, is a re-entrant call.
    if (isAllowedVideoUrl(url)) {
      setImmediate(() => {
        if (!contents.isDestroyed()) {
          contents.loadURL(url).catch(() => {
            // A navigation that loses a race with another is not an error.
          });
        }
      });
    } else {
      // Say so, rather than dropping it in silence.
      //
      // `will-navigate` has a listener in the renderer that raises the notice
      // naming the host; a popup denied here had nothing of the kind, so a
      // click that opened a new window to somewhere unlisted simply did
      // nothing at all. That is indistinguishable from a broken page — it is
      // exactly how Vimeo reads when a video refuses to open — and the whole
      // point of the allow-list is that a boundary should be legible.
      //
      // `about:blank` is the one to watch for: a site that opens an empty
      // window and then navigates it asks about the blank, which is never on
      // the list, so this is the only place that behaviour is visible at all.
      log.info(`Video player refused a popup to ${url}`);
      contents.hostWebContents?.send(VIDEO_LINK_BLOCKED, url);
    }

    // Never a real popup. Anything not on the list is dropped here, and the
    // renderer says so — it is watching the same navigations.
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
const hardenAttachment = (
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
  if (src && src !== 'about:blank' && !isAllowedVideoUrl(src)) {
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
  delete params.allowpopups;
};

/**
 * Wire the player up. Call once, after the app is ready.
 *
 * `session.fromPartition` creates the session on first use, so calling this
 * before `whenReady` would build it too early.
 */
export const setUpVideoBrowser = () => {
  lockDownSession();

  app.on('web-contents-created', (_event, contents) => {
    if (contents.getType() === 'webview') {
      hardenPlayer(contents);
      return;
    }

    contents.on('will-attach-webview', hardenAttachment);
  });

  // Asked by each player as it loads, so a reload or a new page starts in
  // whatever state the switch is actually in.
  ipcMain.handle(VIDEO_AD_BLOCK_REQUEST, () => isAdBlockEnabled);
};

/** Called from the window's IPC handler when the switch moves. */
export const setVideoAdBlockEnabled = (enabled: boolean) => {
  isAdBlockEnabled = enabled;
  broadcastAdBlockSetting();
};

/**
 * Open a blocked address in the user's real browser.
 *
 * Reached only from the notice the player shows after refusing to navigate,
 * which prints the address first and needs a press to go anywhere. The scheme
 * is checked again here rather than trusted: this is an IPC endpoint, so what
 * arrives is whatever the renderer sent, and `shell.openExternal` hands its
 * argument to the OS — which will happily act on `file:` or on any custom
 * protocol some other installed application has registered.
 */
export const openVideoLinkExternally = (url: string) => {
  let protocol: string;
  try {
    protocol = new URL(url).protocol;
  } catch {
    return;
  }

  if (protocol !== 'https:' && protocol !== 'http:') {
    return;
  }

  shell.openExternal(url).catch(() => {
    // The OS refused to open it; there is nothing useful to say about that.
  });
};
