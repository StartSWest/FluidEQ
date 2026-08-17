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

import path from 'path';
import { BrowserWindow, app, desktopCapturer, ipcMain } from 'electron';
import log from 'electron-log';
import { PRODUCT_NAME } from '../common/branding';
import {
  RENDERER_READY_EVENT,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
} from '../common/constants';
import { resolveHtmlPath, waitForRenderer } from './util';
import { openExternalIfSafe } from './safeExternal';
import MenuBuilder from './menu';
import { IAuthorizedAutoUpdater } from './signedAutoUpdates';

/**
 * How long a renderer gets to paint before the window is shown anyway.
 *
 * The renderer says when it is ready (see RENDERER_READY_EVENT) and this is
 * only the fallback for one that never does. Showing a blank window late is
 * bad; never showing it at all is worse.
 */
const RENDERER_PAINT_GRACE_MS = 1500;

/**
 * Building the window, and everything that has to be true before it opens.
 *
 * Two hundred and eighty lines of main.ts: the BrowserWindow itself, its
 * security posture, the state it is restored into, what it does when it is
 * closed, and the four background jobs that only start once there is something
 * to show. They came out together because they are one sequence — none of it
 * means anything without a window, and all of it has to happen exactly once.
 *
 * The window and the updater are written back through setters rather than
 * returned. Both are module state in main.ts with readers all over it, and an
 * imported binding cannot be assigned to; handing back a value would mean every
 * caller remembering to store it.
 */
export interface IMainWindowDeps {
  isDebug: boolean;
  setMainWindow: (next: BrowserWindow | null) => void;
  setActiveAutoUpdater: (next: IAuthorizedAutoUpdater | undefined) => void;

  /** Where a window with no remembered position should open. */
  firstRunPlacement: () => {
    maximize: boolean;
    width: number;
    height: number;
  };
  loadWindowState: () => {
    width?: number;
    height?: number;
    x?: number;
    y?: number;
    isMaximized?: boolean;
  };
  saveWindowState: () => void;
  /** Tells the renderer whether it is maximised, so its chrome can match. */
  sendWindowState: () => void;

  /** Started only once a window exists — see the note on the interface. */
  syncDatabasesOnStartup: () => Promise<void>;
  setUpAutoUpdates: () => Promise<void>;
  startMemoryProbe: () => void;
  setUpMemoryTraceTrigger: () => void;
}

export const createMainWindowFactory = ({
  firstRunPlacement,
  isDebug,
  loadWindowState,
  saveWindowState,
  sendWindowState,
  setActiveAutoUpdater,
  setMainWindow,
  setUpAutoUpdates,
  setUpMemoryTraceTrigger,
  startMemoryProbe,
  syncDatabasesOnStartup,
}: IMainWindowDeps) => {
  const installExtensions = async () => {
    // Required lazily on purpose, and only in the debug branch that calls this:
    // the installer pulls in a chunk of dependency on import, and a packaged
    // build must never pay for it. main.ts had this switched off for the whole
    // file; one line is enough.
    // eslint-disable-next-line global-require
    const installer = require('electron-devtools-installer');
    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;
    const extensions = ['REACT_DEVELOPER_TOOLS'];

    return installer
      .default(
        extensions.map((name) => installer[name]),
        forceDownload,
      )
      .catch(log.error);
  };

  const createMainWindow = async () => {
    // React DevTools are optional. Keeping them opt-in avoids invoking the
    // installer's legacy session APIs on every development launch.
    if (isDebug && process.env.INSTALL_EXTENSIONS === 'true') {
      await installExtensions();
    }

    const RESOURCES_PATH = app.isPackaged
      ? path.join(process.resourcesPath, 'assets')
      : path.join(__dirname, '../../assets');

    const getAssetPath = (...paths: string[]): string => {
      return path.join(RESOURCES_PATH, ...paths);
    };

    const restored = loadWindowState();
    const isFirstRun = restored.width === undefined;
    const firstRun = firstRunPlacement();

    const created = new BrowserWindow({
      show: false,
      width: restored.width ?? firstRun.width,
      minWidth: WINDOW_MIN_WIDTH,
      height: restored.height ?? firstRun.height,
      minHeight: WINDOW_MIN_HEIGHT,
      // A saved position if there is one and a screen still covers it —
      // otherwise the middle of the display.
      //
      // Omitting both leaves the placement to Chromium, which offsets each new
      // window down and right from the last one. On a first run that put FluidEQ
      // somewhere off-centre and slightly high for no reason anybody could see,
      // and it is the very first impression the app makes. `center` is ignored
      // when x and y are given, so the two cannot fight.
      ...(restored.x !== undefined && restored.y !== undefined
        ? { x: restored.x, y: restored.y }
        : { center: true }),
      // .ico carries every size Windows asks for — taskbar, alt-tab and the
      // window corner each want a different one, and scaling a single png for
      // all three is what makes it look soft.
      icon: getAssetPath(
        process.platform === 'win32' ? 'icon.ico' : 'icon.png',
      ),
      resizable: true,
      frame: false,
      // Chromium paints white until the first frame of the page arrives. On a
      // frameless dark window that is a full-size white flash, and it happens
      // before any CSS has loaded, so no stylesheet can prevent it. Matching the
      // shell's own background means the gap is invisible.
      backgroundColor: '#04090f',
      webPreferences: {
        preload: app.isPackaged
          ? path.join(__dirname, 'preload.js')
          : path.join(__dirname, '../../.erb/dll/preload.js'),
        // Chromium fetches a hunspell dictionary the first time a spellchecked
        // field is focused and then keeps it resident. The only text anyone
        // types here is a preset name, so it buys nothing and costs a download
        // and a couple of megabytes for the life of the process.
        spellcheck: false,
        // What lets the Video tab exist at all. Off by default in Electron, and
        // only half the story: the tag is enabled here, and every attachment it
        // makes is stripped and re-specified in videoBrowser.ts, which is where
        // the player's actual privileges are decided.
        webviewTag: true,
        // The default, stated rather than assumed because it is load-bearing:
        // minimised or fully occluded, Chromium drops timers and animation
        // frames to roughly one a second. The meter, the creature and the whole
        // of euphoria mode are driven by animation frames, so leaving this on is
        // what stops a window nobody is looking at from animating at full rate.
        backgroundThrottling: true,
      },
    });
    setMainWindow(created);

    const rendererUrl = resolveHtmlPath('index.html');
    const appSession = created.webContents.session;

    // Permission requests from FluidEQ's own renderer are deliberate UI
    // actions. In particular, Karaoke's mic switch must be able to complete the
    // getUserMedia handshake instead of depending on Electron's implicit
    // permission default. Remote Media pages use a different, locked-down
    // session in videoBrowser.ts, so this grant cannot leak into web content.
    const isOwnMainFrame = (
      contents: Electron.WebContents | null,
      details: { isMainFrame: boolean },
    ) => contents === created?.webContents && details.isMainFrame;
    appSession.setPermissionRequestHandler(
      (contents, _permission, callback, details) => {
        callback(isOwnMainFrame(contents, details));
      },
    );
    appSession.setPermissionCheckHandler(
      (contents, _permission, _origin, details) =>
        isOwnMainFrame(contents, details),
    );

    /**
     * A Content-Security-Policy for FluidEQ's own window.
     *
     * Deliberately not the strictest policy that can be written, because a
     * policy that breaks the app gets deleted by the next person who needs the
     * app to work. This is the strictest one that leaves every existing feature
     * running, and each loosening below says which feature needs it.
     *
     * What it does buy, and these are the ones worth having:
     *
     *  - `object-src 'none'` — no plugins, ever. Nothing here uses them and it
     *    closes the oldest hole in the list.
     *  - `base-uri 'self'` — an injected `<base>` cannot re-point every
     *    relative URL in the document at somewhere else.
     *  - `form-action 'none'` — nothing in this app submits a form, so nothing
     *    injected into it should be able to either.
     *  - `frame-src 'none'` — the video browser is a `<webview>` on its own
     *    locked-down session, not a frame in this one.
     *  - script-src without `'unsafe-inline'` — an injected `<script>` tag does
     *    not run.
     *
     * What it deliberately allows:
     *
     *  - `'unsafe-eval'` in development only. Webpack's hot reload compiles
     *    modules with eval; the packaged build has no dev server and no reason
     *    to permit it.
     *  - `style-src 'unsafe-inline'` — React style props are inline styles, and
     *    a dozen components use them.
     *  - `blob:` for workers, media and images. The Whisper worker, the
     *    analysis worker, every audio file the user opens and the look
     *    designer's previews are all object URLs.
     *  - `https://huggingface.co` in connect-src. That is where the speech
     *    model is fetched from, by the worker, on the user's own machine.
     *
     * Set as a response header rather than a meta tag so it also covers the
     * dev-server document, which FluidEQ does not author.
     */
    const scriptSrc = isDebug
      ? "script-src 'self' 'unsafe-eval'"
      : "script-src 'self'";
    const connectSrc = isDebug
      ? "connect-src 'self' ws: http://localhost:1212 https://huggingface.co https://cdn-lfs.huggingface.co"
      : "connect-src 'self' https://huggingface.co https://cdn-lfs.huggingface.co";
    const policy = [
      "default-src 'self'",
      scriptSrc,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "media-src 'self' blob: data: file:",
      "font-src 'self' data:",
      "worker-src 'self' blob:",
      connectSrc,
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'none'",
      "frame-src 'none'",
    ].join('; ');

    appSession.webRequest.onHeadersReceived((details, callback) => {
      // Only this window's own documents. The webview's session is separate, so
      // a policy applied here cannot reach a video site — and must not, since
      // those pages are not ours to constrain.
      callback({
        responseHeaders: {
          ...details.responseHeaders,
          'Content-Security-Policy': [policy],
        },
      });
    });

    // Keep the app session's normal Electron media handling. Chromium reports
    // the analyser's display-loopback handshake as a mixed media request even
    // though FluidEQ immediately discards its required video track. Applying an
    // audio-only policy to this session therefore disables the live spectrum.
    // Remote Media pages remain isolated in VIDEO_BROWSER_PARTITION, whose
    // permission and display-capture handlers are default-deny (videoBrowser.ts).
    appSession.setDisplayMediaRequestHandler((request, callback) => {
      if (
        !created ||
        request.frame !== created.webContents.mainFrame ||
        !request.audioRequested
      ) {
        callback({});
        return;
      }

      // Chromium still requires a video source for getDisplayMedia even when
      // the renderer only consumes the audio track. Use the FluidEQ window as
      // that source instead of a monitor: monitor capture is what triggers
      // WGC's CreateForMonitor/E_ACCESSDENIED failures on some Windows setups.
      // The loopback audio stream remains system-wide and is independent of
      // the video source.
      const provideLoopbackSource = async () => {
        try {
          const sources = await desktopCapturer.getSources({
            types: ['window'],
            thumbnailSize: { width: 0, height: 0 },
            fetchWindowIcons: false,
          });
          const windowSourceId = created?.getMediaSourceId();
          const source =
            sources.find((candidate) => candidate.id === windowSourceId) ||
            sources.find((candidate) =>
              // The window title, which is the product name. Derived from it
              // rather than spelled out, so a rename does not silently lose
              // the fallback and start capturing an arbitrary window.
              candidate.name.toLowerCase().includes(PRODUCT_NAME.toLowerCase()),
            ) ||
            sources[0];

          if (source) {
            callback({ video: source, audio: 'loopback' });
          } else {
            // A frame source is a valid final fallback if Windows does not
            // expose any capturable windows (for example while minimized).
            callback({ video: request.frame || undefined, audio: 'loopback' });
          }
        } catch {
          callback({ video: request.frame || undefined, audio: 'loopback' });
        }
      };
      provideLoopbackSource();
    });

    // Nothing to do on a first run any more. This used to force the graph-view
    // height when there was no saved size, which is what pushed the window off
    // the bottom of the screen; the first-run size is now nine tenths of the work
    // area, which has room for the graph without being told. A saved size is a
    // decision the user made and was never overridden here. Toggling the graph
    // in-session still resizes.

    let hasRevealedMainWindow = false;
    const revealMainWindow = () => {
      if (!created || hasRevealedMainWindow) {
        return;
      }
      hasRevealedMainWindow = true;

      if (process.env.START_MINIMIZED) {
        created.minimize();
      } else {
        // Maximize before showing, so the window does not appear at its restored
        // size and then visibly snap outward. A first run on a screen below 2K
        // takes the same path, for the same reason.
        if (restored.isMaximized || (isFirstRun && firstRun.maximize)) {
          created.maximize();
        }
        created.show();
      }

      if (isDebug) {
        // When in debug mode, show dev tools after the app loads.
        created.webContents.openDevTools();
      }
    };

    // `ready-to-show` fires when Chromium has a first frame, which for a React
    // app is an empty <div id="root"> — the window would appear, sit blank, and
    // then fill in. The renderer says when it has actually painted something
    // (see RENDERER_READY_EVENT); this is only the fallback for a renderer that
    // never gets that far, so a crashed bundle still shows a window with an
    // error in it rather than nothing at all.
    created.once('ready-to-show', () => {
      setTimeout(revealMainWindow, RENDERER_PAINT_GRACE_MS);
    });
    ipcMain.once(RENDERER_READY_EVENT, revealMainWindow);
    created.on('maximize', sendWindowState);
    created.on('unmaximize', sendWindowState);
    created.on('enter-full-screen', sendWindowState);
    created.on('leave-full-screen', sendWindowState);
    // Debounced: dragging a window fires 'resize' continuously, and writing a
    // file on every frame of that would be absurd. 400ms after the user stops.
    let saveTimer: NodeJS.Timeout | undefined;
    const scheduleSave = () => {
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      saveTimer = setTimeout(saveWindowState, 400);
    };
    created.on('resize', scheduleSave);
    created.on('move', scheduleSave);
    created.on('maximize', scheduleSave);
    created.on('unmaximize', scheduleSave);

    created.on('close', () => {
      // Synchronously, before the window goes: a pending debounce would never
      // fire, so closing right after a resize would lose that resize.
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      saveWindowState();
    });

    created.on('closed', () => {
      setMainWindow(null);
    });

    created.webContents.on('did-finish-load', sendWindowState);
    // Polling for the dev server is an optimisation, not a gate. Giving up used
    // to throw out of createMainWindow with nothing to catch it, so a slow bundle
    // produced an unhandled rejection and no window at all — while
    // webpack-dev-middleware was perfectly willing to hold the request until the
    // bundle finished. Load either way and let that happen.
    await waitForRenderer(rendererUrl).catch((error) => {
      log.warn(
        'Renderer was not ready in time; loading anyway and letting the dev server finish.',
        error,
      );
    });
    await created.loadURL(rendererUrl);

    // If ready-to-show was skipped by a fast dev-server response, reveal the
    // already-loaded window instead of leaving an invisible Electron process.
    revealMainWindow();

    // Keep both public measurement databases current without blocking the first
    // paint. The renderer receives an event when the background sync finishes
    // and refreshes whichever source is currently selected.
    syncDatabasesOnStartup().catch((error) => {
      log.warn('Database startup synchronization failed', error);
    });

    const menuBuilder = new MenuBuilder(created);
    menuBuilder.buildMenu();

    // Open urls in the user's browser, if they are urls for a browser.
    //
    // `edata.url` is whatever asked for the window — a `target="_blank"` link, a
    // `window.open`. Plenty of what this renderer draws did not originate here:
    // lyrics, profile names, changelog text, rows from a synced measurement
    // database. Handing any of that to the OS unchecked is how `file:` and every
    // registered custom protocol become reachable, so the scheme is checked the
    // same way the Remote Media player has always checked it.
    created.webContents.setWindowOpenHandler((edata) => {
      openExternalIfSafe(edata.url);
      return { action: 'deny' };
    });

    setUpAutoUpdates().catch((error) => {
      // A setup failure is still a disabled updater. Never recover by loading it
      // without the signature and feed checks that just failed.
      setActiveAutoUpdater(undefined);
      log.warn('Updates disabled: updater setup failed closed.', error);
    });
    startMemoryProbe();
    setUpMemoryTraceTrigger();
  };

  return createMainWindow;
};
