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

import fs from 'fs';
import path from 'path';
import { app, BrowserWindow } from 'electron';
import log from 'electron-log';
import { DEFAULT_LOCALE, LocaleCode } from '../common/i18n';
import { createElectronTraySurface } from './trayElectron';
import { trayMenuEntries, trayTooltip } from './trayMenu';
import type {
  ITraySurface,
  ITrayTintedIcon,
  TTrayAction,
  TTraySurfaceFactory,
} from './trayView';

/**
 * The notification-area icon, and the window closing into it.
 *
 * WHY THE WINDOW OUTLIVES ITS CLOSE BUTTON. FluidEQ writes an equaliser chain
 * that Equalizer APO reads, and it keeps working with no window on screen —
 * but the app is also the only thing that can change it back, watch the config
 * for outside edits, or keep a Karaoke session alive. Quitting on the close
 * button meant the ordinary way to get the window out of the way was also the
 * way to shut down everything behind it, and there was no cheaper gesture.
 *
 * So the close button hides, and this is where the app goes when it does.
 * Quitting is still one click away — the tray menu has it — and it is now a
 * deliberate one rather than the thing that happens by default.
 *
 * This decides what the tray shows and what a press does; a surface draws it
 * (`trayView.ts`): FluidEQ-Tray where it runs, Electron's own tray elsewhere.
 */

/**
 * Held at module scope because the tray dies with its last reference: an
 * Electron `Tray` whose object is collected takes its icon with it, which
 * presents as "the tray icon vanishes after a while" and looks like a
 * Windows problem when it is not.
 */
let surface: ITraySurface | undefined;

/**
 * Whether a quit is genuinely under way.
 *
 * The window's `close` handler cannot tell on its own why it is being closed:
 * the close button, the tray's Quit item, `app.quit()` from the disclaimer
 * gate and a Windows shutdown all arrive as the same event. Without this flag
 * the handler cancels every one of them and the app cannot be quit at all —
 * including by the installer, which is how an update ends up failing to
 * replace a file that is still open.
 */
let isQuitting = false;

/** The language the renderer is showing, for the tray's menu. */
let locale: LocaleCode = DEFAULT_LOCALE;

/**
 * Whether the tray should advertise that an update is waiting.
 *
 * Held here rather than passed on every rebuild, because the state only ever
 * changes when the updater says so — nativeUpdatePrompt flips this on 'ready'
 * and back off on a failure or the start of a new cycle. Callers that rebuild
 * the menu for other reasons (a language change) get the current state without
 * having to know what the updater is doing.
 */
let isUpdateReady = false;

/**
 * The update actions the tray offers, captured once at setup.
 *
 * Held at module scope rather than passed on every menu rebuild, because a
 * language change and a "check now" click both rebuild the menu and neither
 * of the callers has any business knowing about updates. Without this, a
 * `setTrayLocale` from the language picker would rebuild the template with
 * no callbacks and quietly drop the update items — the tray would fall back
 * to Open/Quit only, exactly the failure mode this whole feature is meant to
 * prevent.
 */
let updateActions: {
  onInstallUpdate?: () => void;
  onCheckForUpdates?: () => void;
  onRecoverWindow?: () => void;
} = {};

/**
 * Builds the window again when there is none to show: one let go in the tray
 * (`windowUnload.ts`). Kept beside the actions above, so every way back —
 * the icon, its menu and the update notifications — builds it the same way.
 */
let buildWindow: (() => void) | undefined;

/** What `setUpTray` was handed, for the presses that bring the window back. */
let windowOf: () => BrowserWindow | null = () => null;

/**
 * Whether this build can actually update itself.
 *
 * FALSE UNTIL PROVEN, and that is the whole point. The updater is built
 * asynchronously behind an Authenticode check, and it stays unbuilt for a
 * development build, an unsigned fork, or a signed one whose publisher or
 * feed does not verify. Having a callback wired in says nothing about any of
 * that — main.ts always passes one — so the presence of the function is not
 * evidence the menu item can do anything.
 *
 * Without this the tray offered "Check for updates" in every one of those
 * cases and the click reached a `return` and a log line. That is the failure
 * this project names outright: a click that visibly does nothing.
 */
let areUpdatesEnabled = false;

/**
 * The two icons the notification area swaps between, resolved at setup.
 *
 * Null until the tray is built, and `update` falls back to the plain mark
 * when the badged asset is not on disk — see the note where it is assigned.
 */
let trayIcons: { plain: string; update: string } | null = null;

/** Where the shipped icons are, for a surface built after setup. */
let assetsPath = '';

/**
 * The taskbar button's icon drawn in the window's colours, the same .ico
 * (`taskbarIcon.ts`), while "Tint app icon" is on; undefined for the
 * installed one (Ivan, 2026-10-26: "also I am not seeing the systray tints").
 * The update badge still wins: that mark is the only sign in the tray that
 * an update is waiting, and it exists as the installed icon alone.
 */
let tintedIcon: ITrayTintedIcon | undefined;

/** Read by the window's `close` handler; see the note on the flag. */
export const isAppQuitting = () => isQuitting;

/**
 * What language main-process UI (tray, native notifications) should use.
 *
 * The renderer owns this — see the note on `setTrayLocale`. Other main-side
 * surfaces read it at the moment they render, so a language change taking
 * effect between one call and the next never leaves a mixed screen.
 */
export const getTrayLocale = (): LocaleCode => locale;

/**
 * Arm a real quit.
 *
 * Every path that means to end the process calls this before asking for it,
 * and `before-quit` calls it as the backstop for the ones that come from
 * outside the app — the installer, a session logout, Task Manager's End Task.
 */
export const beginQuit = () => {
  isQuitting = true;
};

export interface ITrayDeps {
  getMainWindow: () => BrowserWindow | null;
  /**
   * Run the "install the downloaded update and restart" path.
   *
   * Optional so a build with no updater (development, unsigned dev branch)
   * can still have a tray with only Open and Quit. When present, and only
   * when `isUpdateReady` is on, a prominent item at the top of the menu calls
   * this. The install path itself lives in signedAutoUpdates' controller —
   * this is only a wire.
   */
  onInstallUpdate?: () => void;
  /**
   * Run an update check outside the periodic schedule.
   *
   * Optional for the same reason as onInstallUpdate. Rejections are the
   * caller's to log — the menu click has no UI to report back to.
   */
  onCheckForUpdates?: () => void;
  /**
   * Put the window back where it can be used: the full app, in the middle of
   * the screen it is nearest.
   *
   * The tray is the only surface that survives a window nobody can reach — a
   * player dragged off the side of the screen, one left on a display that has
   * since been unplugged, or one whose own controls cannot be got at. Optional
   * so a build without the window modes still gets a tray with Open and Quit
   * (Ivan, 2026-09-22).
   */
  onRecoverWindow?: () => void;
  /** Builds a window when there is none: one let go in the tray. */
  onWindowMissing?: () => void;
  /**
   * FluidEQ-Tray, where it runs (`nativeTray/`); Electron's own tray draws
   * the same thing wherever it does not.
   */
  nativeSurface?: TTraySurfaceFactory;
}

const revealWindow = (getMainWindow: () => BrowserWindow | null) => {
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) {
    buildWindow?.();
    return;
  }
  // Three different ways of being out of sight, and each needs its own call.
  // A window hidden into the tray is not minimised, and a window minimised
  // before it was hidden stays minimised through `show()` unless it is
  // restored first — which is the case that reads as the tray icon doing
  // nothing at all.
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
};

/**
 * Bring the window back, from anywhere in the main process.
 *
 * The tray's own presses go through `press`; this is the same act exposed
 * for the update notifications, whose whole premise is that there may be no
 * window on screen to talk to.
 */
export const revealMainWindow = (getMainWindow: () => BrowserWindow | null) => {
  revealWindow(getMainWindow);
};

/** What a press on the icon or one of its items does. */
const press = (action: TTrayAction) => {
  switch (action) {
    case 'open':
      revealWindow(windowOf);
      break;
    case 'recover-window':
      revealWindow(windowOf);
      updateActions.onRecoverWindow?.();
      break;
    case 'install-update':
      updateActions.onInstallUpdate?.();
      break;
    case 'check-updates':
      updateActions.onCheckForUpdates?.();
      break;
    case 'quit':
      beginQuit();
      app.quit();
      break;
    default:
      break;
  }
};

/** The surface shown what the tray is now; nothing before setup. */
const render = () => {
  if (!surface || !trayIcons) {
    return;
  }
  surface.show({
    icon: isUpdateReady
      ? trayIcons.update
      : (tintedIcon?.file ?? trayIcons.plain),
    tooltip: trayTooltip({ locale, updateReady: isUpdateReady }),
    menu: trayMenuEntries({
      locale,
      updatesEnabled: areUpdatesEnabled,
      updateReady: isUpdateReady,
      can: {
        installUpdate: Boolean(updateActions.onInstallUpdate),
        checkForUpdates: Boolean(updateActions.onCheckForUpdates),
        recoverWindow: Boolean(updateActions.onRecoverWindow),
      },
    }),
    marks: {
      plain: trayIcons.plain,
      update: trayIcons.update,
      tinted: tintedIcon,
    },
  });
};

export const setTrayTintedIcon = (icon: ITrayTintedIcon | undefined) => {
  tintedIcon = icon;
  render();
};

/**
 * Rebuild the menu in the language the window is using.
 *
 * The chosen language lives in the renderer — it is a preference in local
 * storage, not something the main process can read — so it has to be pushed
 * across. Called once when the renderer starts and again whenever the picker
 * changes it, so the tray never sits in a language the rest of the app has
 * left behind.
 */
export const setTrayLocale = (next: LocaleCode) => {
  locale = next;
  render();
};

/**
 * Say whether this build has a working updater behind it.
 *
 * Called once the Authenticode and feed checks have settled, which happens
 * after the tray may already exist — so this rebuilds the menu rather than
 * assuming it can be read at setup. Until it is called, and forever in a
 * build that cannot update, the tray offers only Open and Quit.
 */
export const setTrayUpdatesEnabled = (next: boolean) => {
  if (areUpdatesEnabled === next) {
    return;
  }
  areUpdatesEnabled = next;
  render();
};

/**
 * Advertise (or stop advertising) that an update is waiting to install.
 *
 * Rebuilds the menu and the tooltip so somebody who opens the tray between
 * a background check finishing and the notification landing sees the same
 * "install update and restart" item without having to close and reopen it.
 * A no-op when the tray has failed to initialize — nothing to update.
 */
export const setTrayUpdateReady = (next: boolean) => {
  if (isUpdateReady === next) {
    return;
  }
  isUpdateReady = next;
  render();
};

/**
 * Electron's tray in place of the one that drew until now: FluidEQ-Tray
 * ended while FluidEQ runs (`nativeTray/`), and the icon must not go with it.
 */
export const fallBackToElectronTray = () => {
  if (!trayIcons) {
    return;
  }
  surface?.destroy();
  surface = createElectronTraySurface(assetsPath, trayIcons.plain, press);
  if (!surface) {
    // As at setup: with nowhere to hide the window, closing it closes FluidEQ.
    isQuitting = true;
    return;
  }
  render();
};

export const setUpTray = (deps: ITrayDeps) => {
  const {
    getMainWindow,
    onInstallUpdate,
    onCheckForUpdates,
    onRecoverWindow,
    onWindowMissing,
    nativeSurface,
  } = deps;
  updateActions = { onInstallUpdate, onCheckForUpdates, onRecoverWindow };
  buildWindow = onWindowMissing;
  windowOf = getMainWindow;
  if (surface) {
    return;
  }

  assetsPath = app.isPackaged
    ? path.join(process.resourcesPath, 'assets')
    : path.join(__dirname, '../../assets');

  // The .ico rather than a png, and for the same reason the window uses it:
  // Windows asks the notification area for a 16px icon at 100% and a 20 or 24
  // at the scalings most laptops actually run at, and picking those out of a
  // multi-resolution icon is the difference between a crisp mark and a
  // resampled smudge. macOS and Linux have no .ico, so they take the png.
  const iconPath = path.join(
    assetsPath,
    process.platform === 'win32' ? 'icon.ico' : 'icon.png',
  );

  // The same mark with the update dot on it, built by
  // .erb/scripts/make-tray-badge-icon.ts. Resolved once here rather than at
  // each swap, and only if it is really on disk: an icon path that cannot be
  // read sets an empty image rather than throwing — so a missing asset would
  // make the tray icon disappear entirely, which is a great deal worse than
  // not having a badge. Windows only, because the generator emits an .ico
  // and nothing else needs one.
  const badgedPath = path.join(assetsPath, 'icon-update.ico');
  trayIcons = {
    plain: iconPath,
    update:
      process.platform === 'win32' && fs.existsSync(badgedPath)
        ? badgedPath
        : iconPath,
  };
  if (trayIcons.update === iconPath && process.platform === 'win32') {
    log.warn(
      'Tray update badge is missing (assets/icon-update.ico); the icon will not change when an update is ready.',
    );
  }

  surface =
    nativeSurface?.(press) ??
    createElectronTraySurface(assetsPath, iconPath, press);
  if (!surface) {
    // A missing or unreadable icon must not take the app down with it. Without
    // a tray the close button has nowhere to hide the window, which is why
    // `isAppQuitting` reports true from here on: the window goes back to
    // closing for real rather than vanishing with no way to bring it back.
    isQuitting = true;
    return;
  }

  // Before the first paint, because a download can finish before the tray
  // is built — setUpTray runs after createMainWindow resolves, and the
  // updater starts inside it.
  render();
};

/** Let the icon go on the way out. */
export const destroyTray = () => {
  surface?.destroy();
  surface = undefined;
};
