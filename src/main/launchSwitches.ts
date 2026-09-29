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

import { app } from 'electron';

/** The development build, or the one production build with source maps. */
export const isDebug =
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

/**
 * What Chromium and the debugging tools are told before the app is ready:
 * source maps, the sandbox in a container, the DevTools port, and the features
 * this build must not claim to have.
 */
export const applyLaunchSwitches = () => {
  // Only in the build that has source maps: DEBUG_PROD is the one production
  // build the main webpack config gives a `devtool`, and every other one has
  // its maps deleted. Installed without them it still read the whole of
  // main.js into its cache on the first stack it formatted, and kept it, to
  // map nothing. Both halves of the test fold at build time, so a release
  // does not bundle it.
  if (
    process.env.NODE_ENV === 'production' &&
    process.env.DEBUG_PROD === 'true'
  ) {
    // eslint-disable-next-line global-require -- only the source-mapped build loads it, and a release must not bundle it
    const sourceMapSupport = require('source-map-support');
    sourceMapSupport.install();
  }

  // Containerized development environments often run as root and do not
  // expose Chromium's setuid sandbox. This is never enabled in packaged
  // production.
  if (isDebug && process.getuid?.() === 0) {
    app.commandLine.appendSwitch('no-sandbox');
    app.commandLine.appendSwitch('disable-setuid-sandbox');
  }

  /**
   * A DevTools protocol port while developing, and only while developing.
   *
   * Without it the running window can only be inspected by a person looking at
   * it: tests say the markup is right and the stylesheet says the rules
   * compiled, but neither can see a control that renders invisibly or a panel
   * that collapses. Several defects shipped that way — an icon with no size
   * that filled the tab, buttons with no class, two sections that sat side by
   * side. Every one passed the whole suite.
   *
   * Bound to the loopback address on purpose, and gated on `isDebug` so it can
   * never reach a packaged build — an open protocol port is remote control of
   * the browser, not merely a diagnostic.
   */
  if (process.env.NODE_ENV === 'development') {
    app.commandLine.appendSwitch('remote-debugging-port', '9222');
    app.commandLine.appendSwitch('remote-debugging-address', '127.0.0.1');
  }

  /**
   * A packaged build will not run with a DevTools port somebody else asked
   * for. `--remote-debugging-port` or `--remote-debugging-pipe` on the command
   * line opens the same remote control of the window — and through it the
   * whole preload bridge, signed in as the member — to anything on the machine
   * that can start FluidEQ with arguments. Chromium reads those switches
   * itself, so no fuse turns them off; the Node inspector's own flags are off
   * by fuse (`electronFuses` in package.json). Refused before the app is
   * ready, while no window exists.
   */
  if (
    app.isPackaged &&
    (app.commandLine.hasSwitch('remote-debugging-port') ||
      app.commandLine.hasSwitch('remote-debugging-pipe'))
  ) {
    app.exit(1);
  }

  /*
   * WINDOWS' OWN DRM WAS TRIED HERE AND DOES NOT WORK. DO NOT TRY IT AGAIN.
   *
   * Spotify in the Video tab fails at play with `EMEError: No supported
   * keysystem was found`, which everyone reads as "Electron ships no Widevine
   * CDM". True, and its log shows Widevine is not the only thing it asks for
   * on Windows: it probes `com.microsoft.playready.recommendation` and
   * `.recommendation.3000` as well. PlayReady is part of Windows and nobody
   * has to ship it, so that looked like a way to the same place without a
   * forked Electron.
   *
   * It is not, and the experiment is recorded rather than repeated:
   * `app.commandLine.appendSwitch('enable-features', 'HardwareSecureDecryption')`
   * on Chromium 150 changed nothing. Same EMEError, same
   * `local_player_disabled` after it, and the PlayReady console warnings that
   * look like progress were already there before the switch — Chromium emits
   * those when a page *asks* for the key system, not when it has one.
   *
   * The reason is the same shape as FedCM below. Registering the PlayReady key
   * system happens in Chrome's browser layer, not in the Chromium content
   * layer Electron builds on, so there is no switch in this process that can
   * conjure it. The upstream request to add it is open, and open is the
   * answer: castLabs' fork with production VMP signing remains the only route
   * to Spotify playback, and that is a decision about how this is built.
   */

  /*
   * SAY WE DO NOT HAVE FEDCM, BECAUSE WE DO NOT REALLY HAVE FEDCM.
   *
   * Signing in to SoundCloud with a Google account fails in the player, and
   * the page's own log gives the reason: `FedCM get() rejects with
   * NetworkError`.
   *
   * FedCM is browser-mediated by design. `navigator.credentials.get({identity})`
   * hands the whole exchange to the browser, which fetches the provider's
   * endpoints and shows its own account chooser — and that chooser lives in
   * Chrome's browser layer, not in the Chromium content layer Electron is
   * built on. So the API is present, answers, and cannot ever succeed.
   *
   * Which is the worst of the three possibilities. A site feature-detects:
   * absent means "use the old flow", working means "use this one", and
   * present-but-broken means it takes the new path and dies there — with an
   * error that reads like the network, so nobody looks at the browser.
   *
   * Turning it off is not giving something up. It is the same lesson as the
   * user agent one file over: claiming a capability we do not have is worse
   * than admitting the one we do. Google's identity library has a non-FedCM
   * path, it warns on every load that sites have not migrated to FedCM yet,
   * and that path needs a popup — which this build now allows.
   *
   * It has a shelf life. Google intend to make FedCM mandatory, and when they
   * do this stops helping and the answer becomes Electron implementing FedCM.
   * The warning in the page log is the countdown.
   */
  app.commandLine.appendSwitch('disable-features', 'FedCm');

  if (isDebug) {
    /*
     * SHORTCUTS AND THE INSPECT MENU, BUT NOT AN INSPECTOR ON EVERY WINDOW.
     *
     * `showDevTools` defaults to true and means "open DevTools on each created
     * BrowserWindow" — every one, including the sign-in popups the video
     * player now opens. That is worse than untidy on those: Google's abuse
     * page lists "use of developer or inspection tools" among its reasons for
     * refusing a sign-in, so the inspector opening by itself was helping to
     * cause the failure it was there to diagnose.
     *
     * Turning it off costs nothing at all, which is what makes this the right
     * place to fix it rather than closing the window's DevTools after the
     * fact. The main window opens its own explicitly, in the same debug
     * branch (`mainWindow.ts`) — so this option was only ever duplicating that
     * for the one window that wanted it, and supplying it to every window that
     * did not.
     *
     * F12 and the context menu are untouched; they come from the rest of the
     * package and still work on any window.
     */
    // eslint-disable-next-line global-require -- a development tool, loaded only in the builds that debug
    require('electron-debug').default({ showDevTools: false });
  }
};
