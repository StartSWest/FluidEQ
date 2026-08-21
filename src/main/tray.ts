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
import { app, BrowserWindow, Menu, Tray } from 'electron';
import log from 'electron-log';
import { PRODUCT_NAME } from '../common/branding';
import { DEFAULT_LOCALE, LocaleCode, translate } from '../common/i18n';

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
 */

/**
 * Held at module scope because the tray dies with its last reference.
 *
 * `new Tray()` returns an object whose icon disappears from the notification
 * area the moment it is collected, and a local inside a setup function is
 * collectable as soon as that function returns. This is the documented shape
 * of the bug and it presents as "the tray icon vanishes after a while", which
 * looks like a Windows problem and is not.
 */
let tray: Tray | null = null;

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
 * The two update actions the tray offers, captured once at setup.
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
} = {};

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

/**
 * Put the right mark in the notification area for the current state.
 *
 * THE ONLY PART OF THIS THE USER SEES WITHOUT DOING ANYTHING. The tooltip
 * needs a hover and the menu item needs a right-click, so before this the
 * whole "an update is waiting" state was invisible to somebody glancing at
 * their taskbar — and the toast that announced it is gone within seconds.
 */
const applyTrayIcon = () => {
  if (!tray || tray.isDestroyed() || !trayIcons) {
    return;
  }
  tray.setImage(isUpdateReady ? trayIcons.update : trayIcons.plain);
};

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
}

const revealWindow = (getMainWindow: () => BrowserWindow | null) => {
  const mainWindow = getMainWindow();
  if (!mainWindow || mainWindow.isDestroyed()) {
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
 * The tray's own click handlers use the local `revealWindow`; this is the
 * same act exposed for the update notifications, whose whole premise is that
 * there may be no window on screen to talk to.
 */
export const revealMainWindow = (getMainWindow: () => BrowserWindow | null) => {
  revealWindow(getMainWindow);
};

const buildMenu = (getMainWindow: () => BrowserWindow | null) => {
  const { onInstallUpdate, onCheckForUpdates } = updateActions;
  const template: Electron.MenuItemConstructorOptions[] = [];

  // AT THE TOP WHEN THERE IS AN UPDATE TO INSTALL. Position is the only
  // emphasis available: Electron's menu template has no weight, colour or
  // icon for a default item on Windows, so first-with-a-separator-under-it is
  // what makes it read as the thing to press. The whole point of raising the
  // tray badge is to draw the eye here, and burying the action underneath
  // Open would waste the notification that got the user to this menu.
  if (areUpdatesEnabled && isUpdateReady && onInstallUpdate) {
    template.push({
      label: translate(locale, 'app.tray.installUpdate'),
      click: () => onInstallUpdate(),
    });
    template.push({ type: 'separator' });
  }

  template.push({
    label: translate(locale, 'app.tray.open', { product: PRODUCT_NAME }),
    click: () => revealWindow(getMainWindow),
  });

  if (areUpdatesEnabled && onCheckForUpdates && !isUpdateReady) {
    // Only when there is not one already staged. With "Install update and
    // restart" already at the top, offering a check as well reads as "did
    // you mean this or that" for the same subject; picking it would also
    // discard the download that is ready to go.
    template.push({
      label: translate(locale, 'app.tray.checkForUpdates'),
      click: () => onCheckForUpdates(),
    });
  }

  template.push({ type: 'separator' });
  template.push({
    label: translate(locale, 'app.tray.quit', { product: PRODUCT_NAME }),
    click: () => {
      beginQuit();
      app.quit();
    },
  });

  return Menu.buildFromTemplate(template);
};

const currentTooltip = () =>
  translate(
    locale,
    isUpdateReady ? 'app.tray.tooltip.updateReady' : 'app.tray.tooltip',
    { product: PRODUCT_NAME },
  );

/**
 * Rebuild the menu in the language the window is using.
 *
 * The chosen language lives in the renderer — it is a preference in local
 * storage, not something the main process can read — so it has to be pushed
 * across. Called once when the renderer starts and again whenever the picker
 * changes it, so the tray never sits in a language the rest of the app has
 * left behind.
 */
export const setTrayLocale = (
  next: LocaleCode,
  { getMainWindow }: Pick<ITrayDeps, 'getMainWindow'>,
) => {
  locale = next;
  if (!tray || tray.isDestroyed()) {
    return;
  }
  tray.setToolTip(currentTooltip());
  tray.setContextMenu(buildMenu(getMainWindow));
};

/**
 * Say whether this build has a working updater behind it.
 *
 * Called once the Authenticode and feed checks have settled, which happens
 * after the tray may already exist — so this rebuilds the menu rather than
 * assuming it can be read at setup. Until it is called, and forever in a
 * build that cannot update, the tray offers only Open and Quit.
 */
export const setTrayUpdatesEnabled = (
  next: boolean,
  { getMainWindow }: Pick<ITrayDeps, 'getMainWindow'>,
) => {
  if (areUpdatesEnabled === next) {
    return;
  }
  areUpdatesEnabled = next;
  if (!tray || tray.isDestroyed()) {
    return;
  }
  tray.setContextMenu(buildMenu(getMainWindow));
};

/**
 * Advertise (or stop advertising) that an update is waiting to install.
 *
 * Rebuilds the menu and the tooltip so somebody who opens the tray between
 * a background check finishing and the notification landing sees the same
 * "install update and restart" item without having to close and reopen it.
 * A no-op when the tray has failed to initialize — nothing to update.
 */
export const setTrayUpdateReady = (
  next: boolean,
  { getMainWindow }: Pick<ITrayDeps, 'getMainWindow'>,
) => {
  if (isUpdateReady === next) {
    return;
  }
  isUpdateReady = next;
  if (!tray || tray.isDestroyed()) {
    return;
  }
  applyTrayIcon();
  tray.setToolTip(currentTooltip());
  tray.setContextMenu(buildMenu(getMainWindow));
};

export const setUpTray = (deps: ITrayDeps) => {
  const { getMainWindow, onInstallUpdate, onCheckForUpdates } = deps;
  updateActions = { onInstallUpdate, onCheckForUpdates };
  if (tray) {
    return;
  }

  const assetsPath = app.isPackaged
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
  // each swap, and only if it is really on disk: `setImage` with a path
  // Electron cannot read does not throw, it sets an empty image — so a
  // missing asset would make the tray icon disappear entirely, which is a
  // great deal worse than not having a badge. Windows only, because the
  // generator emits an .ico and nothing else needs one.
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

  try {
    tray = new Tray(iconPath);
  } catch (error) {
    // A missing or unreadable icon must not take the app down with it. Without
    // a tray the close button has nowhere to hide the window, which is why
    // `isAppQuitting` reports true from here on: the window goes back to
    // closing for real rather than vanishing with no way to bring it back.
    log.error(`Could not create the ${PRODUCT_NAME} tray icon`, error);
    isQuitting = true;
    return;
  }

  // Before the first paint, because a download can finish before the tray
  // is built — setUpTray runs after createMainWindow resolves, and the
  // updater starts inside it.
  applyTrayIcon();
  tray.setToolTip(currentTooltip());
  tray.setContextMenu(buildMenu(getMainWindow));

  // Windows convention: left click opens the thing, right click opens the menu
  // (which Electron wires to the context menu by itself). On macOS a left
  // click opens the menu instead, so this only ever fires where it is wanted.
  tray.on('click', () => revealWindow(getMainWindow));
  // Double click is the older Windows habit and still what a lot of people do.
  tray.on('double-click', () => revealWindow(getMainWindow));
};

/**
 * Let the icon go on the way out.
 *
 * Windows keeps a dead tray icon on screen until something makes it repaint,
 * so a process that exits without this leaves a ghost the user can click on
 * and get nothing from.
 */
export const destroyTray = () => {
  if (tray && !tray.isDestroyed()) {
    tray.destroy();
  }
  tray = null;
};
