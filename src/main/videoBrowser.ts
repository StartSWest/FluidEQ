/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
  VIDEO_LINK_BLOCKED,
  VIDEO_SITES,
  isNavigableVideoUrl,
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
/*
 * What a page in the player may ask for and be given.
 *
 * `fullscreen` is the video button, and was the whole list.
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
 * stands in for is a browser's, and there is nowhere here to show one. What
 * makes that acceptable is the allow-list: the only frames that can ask are
 * frames on hosts this file already decided to load. It is not a general
 * "third-party storage is fine" — it is "the five sites offered, and Google's
 * sign-in, may use their own cookies", which is the thing being asked for.
 *
 * Everything else stays refused: no camera, no microphone, no location, no
 * notifications, no MIDI, no clipboard, no device enumeration.
 */
const GRANTED_PERMISSIONS = new Set([
  'fullscreen',
  'storage-access',
  'top-level-storage-access',
]);

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

/** Every attached player, for pushing a settings change out to all of them. */
const attachedPlayers = new Set<WebContents>();

/** How much of a guest's console line is worth keeping. See where it is used. */
const CONSOLE_MESSAGE_LIMIT = 200;

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
      log.info(`Video player refused a navigation to ${details.url}`);
    }
  };

  contents.on('will-navigate', blockDisallowed);
  contents.on('will-redirect', blockDisallowed);

  /**
   * What the page itself is complaining about.
   *
   * A guest has its own console, and nobody has it open. So when a site does
   * not work in here — and only in here — the one account of why was going
   * straight into a devtools window that does not exist, and every diagnosis
   * started from a screenshot and a guess.
   *
   * Warnings and errors only. A video page logs hundreds of informational lines
   * a minute and none of them has ever explained anything.
   */
  contents.on('console-message', (details) => {
    if (details.level !== 'error' && details.level !== 'warning') {
      return;
    }
    const where = details.sourceId
      ? ` (${details.sourceId}:${details.lineNumber})`
      : '';
    // Truncated, because an ad tracker's URL is not a diagnosis.
    //
    // A blocked doubleclick request logs its entire query string — click ids,
    // consent tokens, viewability telemetry — which runs to two or three
    // kilobytes per line, several times a second on a video page. It rotated a
    // megabyte of log inside an hour and buried every line that was actually
    // worth reading, which is the opposite of what this listener is for. The
    // first two hundred characters carry the error and the origin; the rest has
    // never explained anything.
    const message =
      details.message.length > CONSOLE_MESSAGE_LIMIT
        ? `${details.message.slice(0, CONSOLE_MESSAGE_LIMIT)}…`
        : details.message;
    /*
     * ITS OWN TAG FAMILY, because none of this is ours.
     *
     * Everything on this line was written by the embedded page — YouTube's
     * player, its ad stack, whatever a video decides to complain about. It used
     * to arrive under `[player]`, which reads like a FluidEQ subsystem and put
     * somebody else's noise in the same visual class as our own diagnostics.
     *
     * `[page:warn]` says both things at once: not ours, and how loud. One grep
     * silences the chatter — YouTube emits three preload warnings every few
     * seconds while a video plays, which is exactly when the log is most likely
     * to be read for another reason — and `[page:error]` survives it.
     */
    log.info(`[page:${details.level}] ${message}${where}`);
  });

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
        `Video player navigating to ${details.url}${
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
      log.info(`Video player refused a popup to ${url}`);
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
      log.info(`Video player opened a popup window to ${url}`);
      return {
        action: 'allow',
        overrideBrowserWindowOptions: {
          width: 520,
          height: 720,
          autoHideMenuBar: true,
          // Stated rather than inherited. A popup takes the opener's
          // preferences when nothing is said, which is safe today only because
          // `hardenAttachment` made the opener safe — and a security posture
          // that holds by inheritance is one edit away from not holding. No
          // preload: the ad blocker has no business inside a login form.
          webPreferences: {
            nodeIntegration: false,
            nodeIntegrationInSubFrames: false,
            contextIsolation: true,
            sandbox: true,
            webSecurity: true,
            allowRunningInsecureContent: false,
            experimentalFeatures: false,
          },
        },
      };
    }

    // Deferred: this runs inside Chromium's own window-open handling, and
    // navigating the contents that is being asked about, from inside the
    // answer, is a re-entrant call.
    log.info(`Video player took a popup to ${url} into the player`);
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
      log.info(`Sign-in popup refused a navigation to ${details.url}`);
    }
  };

  contents.on('will-navigate', blockDisallowed);
  contents.on('will-redirect', blockDisallowed);

  // A popup opening a further popup is not a flow any of these sites uses, and
  // is what a hijacked one would try. One window deep is the whole allowance.
  contents.setWindowOpenHandler(({ url }) => {
    log.info(`Sign-in popup refused a popup to ${url}`);
    return { action: 'deny' };
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
