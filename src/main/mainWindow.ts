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
import { BrowserWindow, app, desktopCapturer, ipcMain, screen } from 'electron';
import log from 'electron-log';
import { PRODUCT_NAME } from '../common/branding';
import {
  RENDERER_READY_EVENT,
  WINDOW_MIN_HEIGHT,
  WINDOW_MIN_WIDTH,
} from '../common/constants';
import { resolveHtmlPath, waitForRenderer } from './util';
import { openExternalIfSafe } from './safeExternal';
import { contentSecurityPolicy } from './contentSecurityPolicy';
import MenuBuilder from './menu';
import { IAuthorizedAutoUpdater } from './signedAutoUpdates';
import { isAppQuitting } from './tray';

/**
 * The desktop, blurred, behind the app's own floor.
 *
 * Windows 11 draws this itself: DWM composites the blur once for the whole
 * window, out of process, so it costs the app nothing per frame. A blur done
 * in the page cannot do this at all — CSS can only sample what is inside the
 * window, and the desktop is not.
 *
 * It rules out a see-through window, which is the trade. Windows will not put
 * a backdrop material behind a transparent window, so the app cannot draw its
 * own corners over one either: DWM rounds the window at the system radius
 * instead, which is about 8px and not adjustable. The stylesheet follows —
 * `$window-backdrop` there — and the two have to agree, or the shell paints
 * an opaque floor over a blur nobody can see.
 *
 * Acrylic: a live blur of whatever is behind the window, which is the one
 * that actually shows the desktop. Windows switches it off while the window
 * is not focused and leaves a flat grey in its place — the shell over it is
 * opaque enough (see `$window-backdrop`) that what remains is a shade rather
 * than a slab, which is the trade for having the real thing while working.
 *
 * Only Windows 11 has it. Older Windows, macOS and Linux ignore the option
 * and get the opaque floor the stylesheet falls back to.
 */
const WINDOW_BACKDROP_MATERIAL = 'acrylic' as const;

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
  /**
   * Was this launch the app restarting itself to finish an update?
   *
   * If so the window is built and loaded but never shown: an unattended update
   * only ever runs when FluidEQ was already out of the way, and putting a
   * window — plus the What's New dialog on top of it — in front of somebody
   * who minimised the app a minute ago is the interruption the whole
   * unattended path exists to avoid. The tray icon is there, and opening from
   * it works exactly as it does for any hidden window.
   */
  startsHidden: () => boolean;

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
  startsHidden,
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
      // Windows 11 rounds a frameless window itself, at the system radius.
      // Not adjustable, and not negotiable while there is a backdrop
      // material: see `WINDOW_BACKDROP_MATERIAL`.
      roundedCorners: true,
      backgroundMaterial: WINDOW_BACKDROP_MATERIAL,
      // Chromium paints white until the first frame of the page arrives. On a
      // frameless dark window that is a full-size white flash, and it happens
      // before any CSS has loaded, so no stylesheet can prevent it. Matching the
      // shell's own background means the gap is invisible. This is
      // `$surface-base` in _theme.scss; the two move together.
      // Fully transparent, so the backdrop material is what shows through
      // wherever the page does not paint. It is also what Chromium fills the
      // window with before the first frame arrives, which used to be a
      // full-size white flash and is now the blurred desktop.
      backgroundColor: '#00000000',
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
    // `created?.webContents` throws once the window has been destroyed —
    // Electron's accessors on a dead BrowserWindow raise "Object has been
    // destroyed" rather than returning undefined. The session outlives the
    // window, so these handlers keep firing during teardown and on a dev
    // reload, and an uncaught throw here takes the whole main process with it.
    const isOwnMainFrame = (
      contents: Electron.WebContents | null,
      details: { isMainFrame: boolean },
    ) => {
      if (!created || created.isDestroyed()) {
        return false;
      }
      return contents === created.webContents && details.isMainFrame;
    };
    appSession.setPermissionRequestHandler(
      (contents, _permission, callback, details) => {
        callback(isOwnMainFrame(contents, details));
      },
    );
    appSession.setPermissionCheckHandler(
      (contents, _permission, _origin, details) =>
        isOwnMainFrame(contents, details),
    );

    // The policy itself, and the reasoning behind every directive in it,
    // are in ./contentSecurityPolicy — where they can be tested.
    const policy = contentSecurityPolicy(isDebug);

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

      if (startsHidden()) {
        // Nothing at all: no show, no minimize. A minimized window would still
        // put an entry on the taskbar and flash it, which is the same
        // interruption in a smaller font.
        //
        // The maximise cannot happen here — `maximize()` shows the window, so
        // doing it now would defeat the whole point — and it cannot be
        // skipped either: a window that was never on screen answers
        // `isMaximized()` false, and saveWindowState writes that answer down.
        // Somebody who keeps FluidEQ maximised would be un-maximised by every
        // update, permanently. So it waits for the tray to open the window and
        // happens then, one frame late and visible as a snap, which is the
        // cost of not flashing a window at somebody who put it away.
        if (restored.isMaximized) {
          created.once('show', () => created.maximize());
        }
        if (isDebug) {
          created.webContents.openDevTools();
        }
        return;
      }

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
    created.on('enter-full-screen', () => {
      // The backdrop comes off for the duration.
      //
      // Windows draws a backdrop material by extending the window frame into
      // the client area, and that frame keeps its margins through the
      // full-screen transition: measured on a 2560x1440 display, the window
      // came to 2544x1424 at 8,8 with a strip of desktop down all four edges.
      // Full screen has nothing behind it to blur anyway — the window is the
      // screen — so the material is not being given up for anything.
      created.setBackgroundMaterial('none');
      sendWindowState();
    });

    created.on('leave-full-screen', () => {
      if (!created.isDestroyed()) {
        created.setBackgroundMaterial(WINDOW_BACKDROP_MATERIAL);
      }
      sendWindowState();
    });
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

    created.on('close', (event) => {
      // Synchronously, before the window goes: a pending debounce would never
      // fire, so closing right after a resize would lose that resize.
      //
      // Runs on both paths on purpose. Hiding into the tray is where the
      // window stops being looked at, so it is exactly as good a moment to
      // write down its size and position as a real close is — and if the
      // process is later ended without another close, this is the only chance
      // there was.
      if (saveTimer) {
        clearTimeout(saveTimer);
      }
      saveWindowState();

      // THE CLOSE BUTTON HIDES; IT DOES NOT QUIT. See tray.ts for why, and for
      // what sets the flag — every genuine quit arms it first, so this cancels
      // only the ones that came from somebody pressing the X.
      if (!isAppQuitting()) {
        event.preventDefault();
        created.hide();
      }
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
