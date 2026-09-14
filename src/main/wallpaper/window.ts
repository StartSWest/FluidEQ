import { app, BrowserWindow, session, type Rectangle } from 'electron';
import path from 'path';
import { resolveHtmlPath } from '../util';

const PARTITION = 'fluideq-wallpaper';
let sessionReady = false;

/** Every monitor's surface shares one locked-down session, set up once. */
const wallpaperSession = () => {
  const isolated = session.fromPartition(PARTITION);
  if (sessionReady) {
    return isolated;
  }
  sessionReady = true;
  isolated.setPermissionRequestHandler((_contents, _permission, answer) =>
    answer(false),
  );
  isolated.setPermissionCheckHandler(() => false);
  isolated.webRequest.onHeadersReceived((details, answer) => {
    const development = !app.isPackaged;
    answer({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'none'; " +
            `script-src 'self'${development ? " 'unsafe-eval'" : ''}; ` +
            "style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; " +
            "worker-src 'self' blob:; " +
            `connect-src 'self'${development ? ' ws://localhost:* ws://127.0.0.1:*' : ''};`,
        ],
      },
    });
  });
  return isolated;
};

/** Separate session/preload: a scene has no account or playback authority. */
export const createWallpaperWindow = (bounds: Rectangle): BrowserWindow => {
  const window = new BrowserWindow({
    ...bounds,
    show: false,
    paintWhenInitiallyHidden: true,
    frame: false,
    // No resize border: the desktop helper strips it anyway, and Electron
    // re-adds WS_THICKFRAME on some calls unless it knows the window has none.
    thickFrame: false,
    transparent: false,
    backgroundColor: '#090b12',
    skipTaskbar: true,
    focusable: false,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    title: 'FluidEQ Desktop',
    webPreferences: {
      session: wallpaperSession(),
      preload: app.isPackaged
        ? path.join(__dirname, 'wallpaper-preload.js')
        : path.join(app.getAppPath(), '.erb/dll/wallpaper-preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
      // Wallpaper visibility is owned by desktop/fullscreen/power events.
      // Chromium sees a window behind Explorer and otherwise throttles it.
      backgroundThrottling: false,
    },
  });
  window.setIgnoreMouseEvents(true);
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) =>
    event.preventDefault(),
  );
  return window;
};

export const wallpaperUrl = () => resolveHtmlPath('wallpaper.html');
