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
 * The notification area is module-scope state — the tray handle, the language,
 * whether an update is waiting, and the two icons it swaps between all live at
 * the top of tray.ts and are mutated by callers that know nothing about each
 * other. That is the shape of bug this project keeps shipping, so the tests
 * here are mostly about interference: does a language change survive an update
 * badge, does a missing asset degrade instead of blanking the icon.
 */
import type { BrowserWindow } from 'electron';

interface IMenuItem {
  label?: string;
  type?: string;
  click?: () => void;
}

const trayInstances: {
  setImage: jest.Mock;
  setToolTip: jest.Mock;
  setContextMenu: jest.Mock;
  isDestroyed: jest.Mock;
  destroy: jest.Mock;
  on: jest.Mock;
}[] = [];
let builtMenus: IMenuItem[][] = [];
let existingFiles = new Set<string>();

jest.mock('fs', () => ({
  __esModule: true,
  default: { existsSync: (target: string) => existingFiles.has(target) },
  existsSync: (target: string) => existingFiles.has(target),
}));

jest.mock('electron', () => ({
  app: { isPackaged: false, quit: jest.fn() },
  Menu: {
    buildFromTemplate: (template: IMenuItem[]) => {
      builtMenus.push(template);
      return { template };
    },
  },
  Tray: jest.fn().mockImplementation(() => {
    const instance = {
      setImage: jest.fn(),
      setToolTip: jest.fn(),
      setContextMenu: jest.fn(),
      isDestroyed: jest.fn(() => false),
      destroy: jest.fn(),
      on: jest.fn(),
    };
    trayInstances.push(instance);
    return instance;
  }),
}));

jest.mock('electron-log', () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
}));

/* eslint-disable global-require, @typescript-eslint/no-var-requires */
type TrayModule = typeof import('../../../main/tray');

const PLAIN = 'icon.ico';
const BADGED = 'icon-update.ico';

const pathEndsWith = (value: unknown, name: string) =>
  typeof value === 'string' && value.replace(/\\/g, '/').endsWith(`/${name}`);

const labels = () =>
  (builtMenus[builtMenus.length - 1] ?? [])
    .filter((item) => item.type !== 'separator')
    .map((item) => item.label);

const loadTray = (options?: { withBadgeAsset?: boolean }): TrayModule => {
  jest.resetModules();
  deps.onInstallUpdate.mockClear();
  deps.onCheckForUpdates.mockClear();
  trayInstances.length = 0;
  builtMenus = [];
  existingFiles = new Set(
    options?.withBadgeAsset === false ? [] : [`/assets/${BADGED}`],
  );
  // The module resolves the badge path with path.join against __dirname, so
  // match on the tail rather than trying to predict the absolute path.
  const realHas = existingFiles.has.bind(existingFiles);
  existingFiles.has = ((target: string) =>
    options?.withBadgeAsset === false
      ? false
      : realHas(target) || pathEndsWith(target, BADGED)) as never;
  return require('../../../main/tray') as TrayModule;
};

/**
 * setUpTray plus the "this build can update" signal main.ts sends once the
 * Authenticode check settles. Most tests want a working updater; the ones
 * about a build that cannot update call setUpTray on its own.
 */
const setUpWorkingTray = (tray: TrayModule) => {
  tray.setUpTray(deps);
  tray.setTrayUpdatesEnabled(true, deps);
};

const deps = {
  getMainWindow: () => null as BrowserWindow | null,
  onInstallUpdate: jest.fn(),
  onCheckForUpdates: jest.fn(),
};

const currentTray = () => trayInstances[trayInstances.length - 1];

/** The path handed to the most recent setImage, if there was one. */
const lastImage = (): unknown => {
  const { calls } = currentTray().setImage.mock;
  return calls.length ? calls[calls.length - 1][0] : undefined;
};

describe('the tray icon and what it advertises', () => {
  it('starts on the plain mark with no update item', () => {
    const tray = loadTray();
    setUpWorkingTray(tray);

    // Set explicitly rather than left to the constructor: a download can
    // finish before the tray is built, so setup has to paint the state it
    // finds rather than assume it is starting clean.
    expect(pathEndsWith(lastImage(), PLAIN)).toBe(true);
    expect(labels()).toEqual([
      'Open FluidEQ',
      'Check for updates',
      'Quit FluidEQ',
    ]);
  });

  it('swaps to the badged mark when an update is ready', () => {
    const tray = loadTray();
    setUpWorkingTray(tray);

    tray.setTrayUpdateReady(true, deps);

    // THE POINT OF THE WHOLE CHANGE: something visible without hovering or
    // right-clicking, because the toast is gone within seconds.
    expect(pathEndsWith(lastImage(), BADGED)).toBe(true);
    expect(labels()).toContain('Install update and restart');
    expect(currentTray().setToolTip).toHaveBeenLastCalledWith(
      'FluidEQ — update ready to install',
    );
  });

  it('goes back to the plain mark when the update stops being ready', () => {
    const tray = loadTray();
    setUpWorkingTray(tray);
    tray.setTrayUpdateReady(true, deps);

    tray.setTrayUpdateReady(false, deps);

    expect(pathEndsWith(lastImage(), PLAIN)).toBe(true);
    expect(labels()).not.toContain('Install update and restart');
  });

  it('keeps the plain mark, never a blank one, when the badge asset is missing', () => {
    const tray = loadTray({ withBadgeAsset: false });
    setUpWorkingTray(tray);

    tray.setTrayUpdateReady(true, deps);

    // setImage with an unreadable path does not throw, it sets an empty
    // image — so the failure mode being guarded against is the tray icon
    // vanishing altogether, which is far worse than having no badge.
    expect(pathEndsWith(lastImage(), PLAIN)).toBe(true);
    // The menu item still appears: the action is available even when the
    // decoration is not.
    expect(labels()).toContain('Install update and restart');
  });

  it('does not lose the update item when the language changes', () => {
    const tray = loadTray();
    setUpWorkingTray(tray);
    tray.setTrayUpdateReady(true, deps);

    tray.setTrayLocale('es', deps);

    // The language picker's IPC passes only getMainWindow, so a rebuild that
    // read the callbacks from its argument would silently drop both update
    // items and leave a Spanish tray with no way to install.
    expect(labels()).toEqual([
      'Instalar actualización y reiniciar',
      'Abrir FluidEQ',
      'Salir de FluidEQ',
    ]);
  });

  it('hides "check for updates" while one is already staged', () => {
    const tray = loadTray();
    setUpWorkingTray(tray);

    tray.setTrayUpdateReady(true, deps);

    // Running a fresh check would discard the download sitting ready to go.
    expect(labels()).not.toContain('Check for updates');
  });

  it('offers no update items at all when no updater was wired in', () => {
    const tray = loadTray();
    tray.setUpTray({ getMainWindow: () => null });

    tray.setTrayUpdateReady(true, deps);

    // A development or unsigned build has no controller, and a menu item that
    // cannot do anything is worse than no menu item.
    expect(labels()).toEqual(['Open FluidEQ', 'Quit FluidEQ']);
  });

  it('offers nothing about updates until the build is known to have an updater', () => {
    const tray = loadTray();

    // Callbacks ARE wired — main.ts always passes them — but the Authenticode
    // and feed checks have not settled yet. Having a function to call is not
    // evidence that calling it does anything.
    tray.setUpTray(deps);

    expect(labels()).toEqual(['Open FluidEQ', 'Quit FluidEQ']);
  });

  it('keeps quiet forever in a build whose updater failed verification', () => {
    const tray = loadTray();
    tray.setUpTray(deps);

    // What main.ts sends when setUpReleaseAutoUpdates returns undefined: an
    // unsigned fork, a bad publisher pin, an unreachable feed.
    tray.setTrayUpdatesEnabled(false, deps);
    tray.setTrayUpdateReady(true, deps);

    // Before the gate this showed "Check for updates", and clicking it hit a
    // bare `return` and a log line — the click that visibly does nothing.
    expect(labels()).toEqual(['Open FluidEQ', 'Quit FluidEQ']);
  });

  it('brings the items back once the updater checks out', () => {
    const tray = loadTray();
    tray.setUpTray(deps);
    expect(labels()).not.toContain('Check for updates');

    // The signal arrives after the tray already exists, so it has to rebuild
    // the menu rather than be read once at setup.
    tray.setTrayUpdatesEnabled(true, deps);

    expect(labels()).toEqual([
      'Open FluidEQ',
      'Check for updates',
      'Quit FluidEQ',
    ]);
  });

  it('runs the real check when the item is offered', () => {
    const tray = loadTray();
    setUpWorkingTray(tray);

    const item = (builtMenus[builtMenus.length - 1] ?? []).find(
      (entry) => entry.label === 'Check for updates',
    );
    item?.click?.();

    // The positive control for the three tests above: proves the item is not
    // merely absent everywhere, and that when shown it is genuinely wired.
    expect(deps.onCheckForUpdates).toHaveBeenCalledTimes(1);
  });
});
