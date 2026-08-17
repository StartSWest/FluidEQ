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

import path from 'path';
import { app } from 'electron';
import log from 'electron-log';
import type { WebContents } from 'electron';
import { VIDEO_SITES, isNavigableVideoUrl } from '../common/videoSites';
import { VIDEO_AD_BLOCK_DEFAULT } from '../common/videoAdBlock';

/**
 * The floor the video browser is built on.
 *
 * What a page may ask for and be given, what a popup window is allowed to be,
 * where the preload lives, and the log plumbing every attached player shares.
 * None of it decides anything on its own; all of it is needed by the code that
 * does.
 *
 * A separate file because both halves above it need these. Without a floor,
 * `videoHardening` would import `videoBrowser` and `videoBrowser` would import
 * `videoHardening` — a cycle that works until an import order changes.
 */
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
export const GRANTED_PERMISSIONS = new Set(['fullscreen']);

/** Granted, but only to a frame on a host the allow-list already names. */
export const ORIGIN_CHECKED_PERMISSIONS = new Set([
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
export const isPermissionGranted = (
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
export const POPUP_WINDOW_OPTIONS = {
  width: 520,
  height: 720,
  autoHideMenuBar: true,
  // Identity pages commonly leave their root canvas transparent while their
  // own stylesheet arrives. Without a light fallback that exposes FluidEQ's
  // navy window behind dark form text; Apple is the visible example.
  backgroundColor: '#ffffff',
};

/** Where a player is sent when it has to be pulled back from somewhere else. */
export const HOME_SITE = VIDEO_SITES[0];

/** Whether the blocker is on. Mirrored from the window, which persists it. */
let adBlockEnabled = VIDEO_AD_BLOCK_DEFAULT;

export const videoPreloadPath = () =>
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
export const forLog = (url: string): string => {
  try {
    const { origin, pathname } = new URL(url);
    return `${origin}${pathname}`;
  } catch {
    return url;
  }
};

/** Every attached player, for pushing a settings change out to all of them. */
export const attachedPlayers = new Set<WebContents>();

/** How much of a guest's console warning is worth keeping. See its use. */
export const CONSOLE_MESSAGE_LIMIT = 200;

/**
 * The same for an error, which is worth a great deal more.
 *
 * Errors are rare and are the reason anybody opens this log; warnings are the
 * ad stack talking to itself. A CORS refusal in particular puts the reason last,
 * after the origin and the whole URL, so the warning-sized cap removed exactly
 * the part being looked for.
 */
export const CONSOLE_ERROR_LIMIT = 1200;

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
export const forwardConsole = (contents: WebContents, tag: string) => {
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

/**
 * Change the remembered ad-block setting.
 *
 * A setter because an imported binding cannot be assigned to, and the window is
 * what persists this — the flag here is a mirror of that, read by every
 * attached player when it asks whether to inject.
 */
export const setAdBlockEnabled = (next: boolean) => {
  adBlockEnabled = next;
};

/** Whether the blocker is on, read fresh each time it is asked. */
export const isAdBlockEnabled = () => adBlockEnabled;
