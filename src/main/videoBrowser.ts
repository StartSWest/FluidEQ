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

/**
 * The rules the built-in player runs under.
 *
 * Embedding Chromium in a desktop app means the app now has an attack surface
 * the size of the web, and none of the things a real browser has grown to
 * defend it — no omnibox showing where you actually are, no Safe Browsing, no
 * separate process boundary the user understands. So the player is not given
 * the web: it is given six sites, no silent downloads, no permissions worth
 * having, and a page that tries to leave simply does not. A download only
 * proceeds through the OS Save As dialog and is reported back to FluidEQ.
 *
 * Every one of these is enforced here, in the main process. The renderer half
 * of the player checks the same list, but only so it can say something useful
 * when a link goes nowhere — a compromised renderer could skip its check, and
 * this file is what makes that not matter.
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  session,
  shell,
  WebContents,
} from 'electron';
import log from 'electron-log';
import fs from 'fs';
import path from 'path';
import { openExternalIfSafe } from './safeExternal';
import {
  VIDEO_BROWSER_PARTITION,
  VIDEO_LINK_BLOCKED,
  VIDEO_SITES,
  isNavigableVideoUrl,
} from '../common/videoSites';
import {
  VIDEO_AD_BLOCK_CHANGED,
  VIDEO_AD_BLOCK_DEFAULT,
  VIDEO_AD_BLOCK_REQUEST,
} from '../common/videoAdBlock';
import {
  IVideoDownloadUpdate,
  TVideoDownloadPhase,
  VIDEO_DOWNLOAD_CHANGED,
  VIDEO_DOWNLOAD_REVEAL,
} from '../common/videoDownloads';

const completedVideoDownloads = new Set<string>();
let nextVideoDownloadId = 0;

const sendVideoDownloadUpdate = (
  source: WebContents,
  update: IVideoDownloadUpdate,
) => {
  const host = source.hostWebContents;
  if (host && !host.isDestroyed()) {
    host.send(VIDEO_DOWNLOAD_CHANGED, update);
    return;
  }
  BrowserWindow.getAllWindows().forEach((window) => {
    if (!window.isDestroyed()) {
      window.webContents.send(VIDEO_DOWNLOAD_CHANGED, update);
    }
  });
};

const rememberCompletedVideoDownload = (filePath: string) => {
  completedVideoDownloads.add(path.resolve(filePath));
  if (completedVideoDownloads.size > 100) {
    const oldest = completedVideoDownloads.values().next().value;
    if (typeof oldest === 'string') {
      completedVideoDownloads.delete(oldest);
    }
  }
};

const revealVideoDownload = (candidate: unknown) => {
  if (typeof candidate !== 'string') {
    return false;
  }
  const resolved = path.resolve(candidate);
  if (!completedVideoDownloads.has(resolved) || !fs.existsSync(resolved)) {
    return false;
  }
  shell.showItemInFolder(resolved);
  return true;
};

/**
 * What a page in the player may ask for and be given.
 *
 * `fullscreen` is the video button, and was once the whole list. A permission
 * prompt raised by a web page inside an equalizer is not a decision anybody can
 * make well, so the rest are answered without being shown to the user at all.
 *
 * THE TWO STORAGE ONES ARE HOW A SIGN-IN THAT IS NOT THE SITE'S OWN COMPLETES.
 * SoundCloud's "continue with Google" runs Google's identity code in a frame
 * belonging to Google inside a page belonging to SoundCloud, and that frame has
 * to reach its own cookies to know who you are. The Storage Access API is how a
 * frame asks for that, this handler answers every request, and the answer to
 * everything was no — so the frame came back not knowing, and the flow died as
 * `FedCM get() rejects with NetworkError`, which reads like a network fault and
 * is a permission refusal.
 *
 * Granting it automatically rather than prompting, because the prompt this
 * stands in for is a browser's and there is nowhere here to show one.
 *
 * THE ORIGIN IS CHECKED, AND THE COMMENT THAT SAID SO USED TO BE WRONG. It
 * claimed the allow-list already meant only intended frames could ask. It does
 * not: the navigation guards are main-frame events, and subframe navigation is
 * unrestricted by design — it has to be, or every embed on these sites breaks.
 * So the grant reached any third-party iframe on any page the player had open,
 * which in a partition now holding live sign-ins is exactly the cross-site
 * tracking the API exists to gate. Found in review, and the reasoning was mine.
 *
 * So it asks who is calling. Both handlers are told the requesting origin, and
 * the storage pair is answered yes only for an origin the list already allows.
 * `fullscreen` is not origin-checked because it grants nothing but a shape.
 *
 * Everything else stays refused: no camera, no microphone, no location, no
 * notifications, no MIDI, no clipboard, no device enumeration.
 */
const GRANTED_PERMISSIONS = new Set(['fullscreen']);

/** Granted, but only to a frame on a host the allow-list already names. */
const ORIGIN_CHECKED_PERMISSIONS = new Set([
  'storage-access',
  'top-level-storage-access',
]);

/**
 * Whether this permission may be given to whoever is asking.
 *
 * An origin arrives as a bare `https://host` with no path, which
 * `isNavigableVideoUrl` parses and checks exactly as it checks a navigation —
 * same list, same label-boundary rule, same https-only rule. One predicate for
 * "may the player deal with this host" rather than a second one to keep in
 * step.
 */
const isPermissionGranted = (
  permission: string,
  origin: string | undefined,
) => {
  if (GRANTED_PERMISSIONS.has(permission)) {
    return true;
  }
  if (!ORIGIN_CHECKED_PERMISSIONS.has(permission)) {
    return false;
  }
  return Boolean(origin) && isNavigableVideoUrl(origin as string);
};

/**
 * Size and chrome for a sign-in window. See `hardenPopup` for its guards.
 *
 * WHY IT SAYS NOTHING ELSE. A popup inherits its opener's web preferences, and
 * the opener is a player guest that `hardenAttachment` has already forced into
 * sandboxed, context-isolated, node-free, `webSecurity: true` — so every value
 * this used to repeat is applied to the window either way.
 *
 * Repeating them made the window subtly not a popup. Chromium treats one whose
 * preferences differ from its opener's differently, and a sign-in is built
 * entirely on the relationship between the two: SoundCloud's callback script
 * crashed reading something off it, `Cannot read properties of undefined
 * (reading 'substring')` in `secure.sndcdn.com/web_auth.js`, three milliseconds
 * before the window closed itself. Found by reading the log rather than by
 * guessing, which took six guesses to start doing.
 *
 * The guards that matter are not preferences and did not move: `hardenPopup`
 * still checks every navigation and redirect against the allow-list, still
 * refuses a popup from a popup, and the session is still the locked-down one.
 */
const POPUP_WINDOW_OPTIONS = {
  width: 520,
  height: 720,
  autoHideMenuBar: true,
  // Identity pages commonly leave their root canvas transparent while their
  // own stylesheet arrives. Without a light fallback that exposes FluidEQ's
  // navy window behind dark form text; Apple is the visible example.
  backgroundColor: '#ffffff',
};

/** Where a player is sent when it has to be pulled back from somewhere else. */
const HOME_SITE = VIDEO_SITES[0];

/** Whether the blocker is on. Mirrored from the window, which persists it. */
let isAdBlockEnabled = VIDEO_AD_BLOCK_DEFAULT;

const videoPreloadPath = () =>
  app.isPackaged
    ? path.join(__dirname, 'video-preload.js')
    : path.join(__dirname, '../../.erb/dll/video-preload.js');

/*
 * THE USER AGENT IS NO LONGER TOUCHED, AND THAT IS THE FIX RATHER THAN A
 * REGRESSION.
 *
 * It used to have FluidEQ's fingerprints filed off: `Electron/43.2.0` and the
 * app's own name and version stripped out of `app.userAgentFallback`, on the
 * reasoning that YouTube reads them and serves a degraded page, and that naming
 * the exact build of an audio utility identifies somebody far more precisely
 * than a plain Chrome string does. Both of those are still true as far as they
 * go. The problem is what the edit could not reach.
 *
 * `setUserAgent` rewrites the header and nothing else. Chromium keeps sending
 * user-agent client hints — `Sec-CH-UA`, `Sec-CH-UA-Platform`, and
 * `navigator.userAgentData` in the page — and those are built from the real
 * brand list, which still said Electron. So the player arrived claiming to be
 * plain Chrome in one channel and Electron in another, at the same moment.
 *
 * A disagreement like that is a far louder "embedded or automated browser"
 * signal than an honest answer, and Google's sign-in refuses on exactly that
 * kind of signal: "this browser or app may not be secure". Stripping the string
 * did not hide the player. It marked it.
 *
 * The evidence for that being the actual cause, rather than a guess: another
 * Electron 43 application on this machine loads Google sign-in in an ordinary
 * `<webview>` and completes it, and it does nothing at all to its user agent —
 * it says `Electron/43.2.0` outright, agreeing with its own client hints.
 *
 * So this session now sends Electron's default, unmodified. If a site really
 * does serve a worse page for it, that is a trade worth reopening — but it is
 * worth reopening against the client hints as well, because changing only the
 * header is what caused this.
 */

/**
 * A URL with everything after the path taken off, for the log.
 *
 * THESE LINES LEAVE THE MACHINE. The bug reporter attaches the tail of
 * `main.log` and offers to open a prefilled GitHub issue with it — a public one
 * — so anything written here is one helpful bug report away from being
 * published.
 *
 * And the query and the fragment of a sign-in URL ARE the credential. That is
 * not incidental: the redirect line exists precisely to capture the hop back
 * from an identity provider, which is the hop carrying `code=`, `state=` and,
 * on the implicit flow, a signed `id_token` in the fragment. Somebody who signs
 * in and then reports an unrelated bug would be handing a live session over
 * with it.
 *
 * The host and the path are what every diagnosis made from this file actually
 * rested on — which host it stopped at, which callback it reached. Not one of
 * them needed a token.
 *
 * Anything unparseable comes back whole. `about:blank` carries nothing and a
 * popup opening blank is a step worth seeing.
 */
const forLog = (url: string): string => {
  try {
    const { origin, pathname } = new URL(url);
    return `${origin}${pathname}`;
  } catch {
    return url;
  }
};

/** Every attached player, for pushing a settings change out to all of them. */
const attachedPlayers = new Set<WebContents>();

/** How much of a guest's console warning is worth keeping. See its use. */
const CONSOLE_MESSAGE_LIMIT = 200;

/**
 * The same for an error, which is worth a great deal more.
 *
 * Errors are rare and are the reason anybody opens this log; warnings are the
 * ad stack talking to itself. A CORS refusal in particular puts the reason last,
 * after the origin and the whole URL, so the warning-sized cap removed exactly
 * the part being looked for.
 */
const CONSOLE_ERROR_LIMIT = 1200;

/**
 * Send a guest's console to the log, since nobody has its devtools open.
 *
 * A guest has a console and no reader. When a site does not work in here — and
 * only in here — the one account of why went into a devtools window that does
 * not exist, and every diagnosis started from a screenshot and a guess.
 *
 * Warnings and errors only. A video page logs hundreds of informational lines a
 * minute and not one of them has ever explained anything.
 *
 * A function rather than the inline block it used to be because the sign-in
 * popup needs it too. That window had no instrumentation whatsoever, which is
 * precisely why several attempts at fixing sign-in were guesses: it opened, and
 * then the log said nothing at all until something was refused.
 */
const forwardConsole = (contents: WebContents, tag: string) => {
  contents.on('console-message', (details) => {
    if (details.level !== 'error' && details.level !== 'warning') {
      return;
    }
    const where = details.sourceId
      ? ` (${details.sourceId}:${details.lineNumber})`
      : '';
    /*
     * Truncated, because an ad tracker's URL is not a diagnosis — but errors
     * get far more room than warnings, and that difference was learned the hard
     * way.
     *
     * The cap exists for the chatter. A blocked doubleclick request logs its
     * entire query string — click ids, consent tokens, viewability telemetry —
     * two or three kilobytes a line, several times a second on a video page. It
     * rotated a megabyte of log inside an hour and buried everything worth
     * reading.
     *
     * Every one of those is a warning. Errors are rare, and an error is the
     * whole reason somebody is reading this file. A CORS refusal names the
     * origin, then the whole URL, then the reason — and the reason is last, so
     * the warning-sized cap cut off exactly the part being looked for.
     */
    const limit =
      details.level === 'error' ? CONSOLE_ERROR_LIMIT : CONSOLE_MESSAGE_LIMIT;
    const message =
      details.message.length > limit
        ? `${details.message.slice(0, limit)}…`
        : details.message;
    /*
     * ITS OWN TAG FAMILY, because none of this is ours.
     *
     * Everything on this line was written by the embedded page. It used to
     * arrive under `[player]`, which reads like a FluidEQ subsystem and put
     * somebody else's noise in the same visual class as our own diagnostics.
     *
     * `[page:warn]` says both things at once: not ours, and how loud. One grep
     * silences the chatter and `[page:error]` survives it. The sign-in window
     * takes a tag of its own so two windows can be told apart in one log.
     */
    log.info(`[${tag}:${details.level}] ${message}${where}`);
  });
};

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

  // No `setUserAgent` here on purpose. See the note above it in this file.

  videoSession.setPermissionRequestHandler(
    (_contents, permission, callback, details) => {
      // `requestingUrl` is the frame's own address, which is what has to be
      // judged — not the top document's, since the whole point is that a frame
      // deep inside a page is doing the asking.
      const asker = (details as { requestingUrl?: string } | undefined)
        ?.requestingUrl;
      callback(isPermissionGranted(permission, asker));
    },
  );

  videoSession.setPermissionCheckHandler((_contents, permission, origin) =>
    isPermissionGranted(permission, origin),
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

  // Every download needs an explicit destination chosen in the OS dialog.
  // FluidEQ never opens the downloaded file; it only reports progress and can
  // reveal the completed file in Explorer after the user asks.
  videoSession.on('will-download', (_event, item, source) => {
    nextVideoDownloadId += 1;
    const id = `video-download-${Date.now()}-${nextVideoDownloadId}`;
    const fileName = path.basename(item.getFilename() || 'download');
    const update = (phase: TVideoDownloadPhase) => {
      const receivedBytes = Math.max(0, item.getReceivedBytes());
      const rawTotalBytes = item.getTotalBytes();
      const totalBytes = rawTotalBytes > 0 ? rawTotalBytes : undefined;
      const savePath = item.getSavePath();
      sendVideoDownloadUpdate(source, {
        id,
        phase,
        fileName,
        filePath: savePath || undefined,
        receivedBytes,
        totalBytes,
        percent:
          totalBytes !== undefined
            ? Math.max(0, Math.min(100, (receivedBytes / totalBytes) * 100))
            : undefined,
      });
    };

    item.setSaveDialogOptions({
      title: 'Save download to your computer',
      defaultPath: path.join(app.getPath('downloads'), fileName),
      buttonLabel: 'Save',
    });
    update('choosing');

    item.on('updated', (_downloadEvent, state) => {
      update(state === 'interrupted' ? 'failed' : 'downloading');
    });
    item.once('done', (_downloadEvent, state) => {
      if (state === 'completed') {
        const savePath = item.getSavePath();
        if (savePath) {
          rememberCompletedVideoDownload(savePath);
          log.info(`Video download saved to ${savePath}`);
        }
        update('completed');
      } else if (state === 'cancelled') {
        update('cancelled');
      } else {
        log.warn(`Video download failed: ${fileName} (${state})`);
        update('failed');
      }
    });
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
const hardenPopup = (contents: WebContents) => {
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

    // A sign-in popup a player opened. Recognised by its session rather than by
    // its type — it is a `window`, exactly like FluidEQ's own, and the thing
    // that tells the two apart is that a popup inherits the player's partition
    // and nothing else in the application uses that partition.
    if (contents.session === session.fromPartition(VIDEO_BROWSER_PARTITION)) {
      hardenPopup(contents);
      return;
    }

    contents.on('will-attach-webview', hardenAttachment);
  });

  // Asked by each player as it loads, so a reload or a new page starts in
  // whatever state the switch is actually in.
  ipcMain.handle(VIDEO_AD_BLOCK_REQUEST, () => isAdBlockEnabled);
  ipcMain.handle(VIDEO_DOWNLOAD_REVEAL, (_event, filePath: unknown) =>
    revealVideoDownload(filePath),
  );
};

/** Called from the window's IPC handler when the switch moves. */
export const setVideoAdBlockEnabled = (enabled: boolean) => {
  isAdBlockEnabled = enabled;
  broadcastAdBlockSetting();
};

/**
 * Throw away everything the player has accumulated. Every account, at once.
 *
 * THIS IS WHAT MAKES A PERSISTENT SESSION DEFENSIBLE. Before it, the promise was
 * that nothing was kept; now the promise is that nothing is kept that was not
 * asked for and that all of it can be dropped in one press. A store somebody can
 * fill and cannot empty is the version of this feature that should not ship.
 *
 * `clearStorageData()` with no arguments rather than a list of quotas: the
 * default is every type it knows, which is the point. Naming types here would
 * mean this function silently stopped covering whatever Chromium adds next, and
 * the failure would be a login surviving a sign-out — the exact thing it exists
 * to prevent. Cache goes with it, since a cached authenticated page can still
 * show somebody's name and library after their cookies are gone.
 *
 * Every attached player is sent home afterwards. A tab left sitting on a
 * logged-in page would keep rendering it from memory, which looks precisely like
 * the sign-out having failed.
 */
export const clearVideoSession = async () => {
  const videoSession = session.fromPartition(VIDEO_BROWSER_PARTITION);

  await videoSession.clearStorageData();
  await videoSession.clearCache();
  await videoSession.clearAuthCache();

  attachedPlayers.forEach((contents) => {
    if (!contents.isDestroyed()) {
      contents.loadURL(HOME_SITE.home).catch(() => {
        // The player is going away, or already has. Nothing to say about it.
      });
    }
  });
};

/**
 * Open a blocked address in the user's real browser.
 *
 * Reached only from the notice the player shows after refusing to navigate,
 * which prints the address first and needs a press to go anywhere. The scheme
 * is checked rather than trusted: this is an IPC endpoint, so what arrives is
 * whatever the renderer sent. That check now lives in `safeExternal.ts`, which
 * is where the main window's window-open handler reads it from too — it was
 * passing its URL through unchecked while this half was careful.
 */
export const openVideoLinkExternally = (url: string) => {
  openExternalIfSafe(url);
};
