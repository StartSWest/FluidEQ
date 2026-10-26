/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every way the development menu opens the developer tools opens them in a
 * window of their own (`devTools.ts`): the View menu's toggle on Windows and
 * Linux, the Mac's, and the page's own Inspect element. Docked inside the
 * window they decide how wide the page is, not the window.
 */

import { EventEmitter } from 'events';
import type { BrowserWindow, MenuItemConstructorOptions } from 'electron';

const mockTemplates: MenuItemConstructorOptions[][] = [];

jest.mock('electron', () => ({
  app: { name: 'FluidEQ', quit: jest.fn() },
  shell: { openExternal: jest.fn() },
  BrowserWindow: class {},
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => {
      mockTemplates.push(template);
      return { popup: jest.fn() };
    },
    setApplicationMenu: jest.fn(),
  },
}));

// eslint-disable-next-line import/first -- the mock above must be in place first
import MenuBuilder from 'main/menu';

const DETACHED = { mode: 'detach', activate: false };

const originalPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
const originalNodeEnv = process.env.NODE_ENV;

/** The app's window in development, its tools closed. */
const buildFor = (platform: NodeJS.Platform) => {
  Object.defineProperty(process, 'platform', { value: platform });
  process.env.NODE_ENV = 'development';
  let isOpen = false;
  const webContents = Object.assign(new EventEmitter(), {
    isDevToolsOpened: jest.fn(() => isOpen),
    openDevTools: jest.fn(() => {
      isOpen = true;
    }),
    closeDevTools: jest.fn(() => {
      isOpen = false;
    }),
    toggleDevTools: jest.fn(),
    inspectElement: jest.fn(),
    reload: jest.fn(),
  });
  const window = {
    webContents,
    setMenu: jest.fn(),
    setFullScreen: jest.fn(),
    isFullScreen: () => false,
  };
  new MenuBuilder(window as unknown as BrowserWindow, jest.fn()).buildMenu();
  return webContents;
};

/** The item of that label anywhere in the last application menu built. */
const itemCalled = (label: string) => {
  const items = mockTemplates
    .flat()
    .flatMap((top) =>
      Array.isArray(top.submenu) ? [top, ...top.submenu] : [top],
    );
  const item = items.find((candidate) => candidate.label === label);
  if (!item?.click) {
    throw new Error(`no menu item called ${label}`);
  }
  return item;
};

const press = (item: MenuItemConstructorOptions) =>
  (item.click as () => void)();

beforeEach(() => {
  mockTemplates.length = 0;
});

afterEach(() => {
  if (originalPlatform) {
    Object.defineProperty(process, 'platform', originalPlatform);
  }
  process.env.NODE_ENV = originalNodeEnv;
});

describe('the development menu', () => {
  it.each([
    ['win32', 'Toggle &Developer Tools'],
    ['darwin', 'Toggle Developer Tools'],
  ] as const)(
    'on %s, opens the tools detached and closes them',
    (platform, label) => {
      const page = buildFor(platform);
      press(itemCalled(label));
      expect(page.openDevTools).toHaveBeenCalledWith(DETACHED);
      press(itemCalled(label));
      expect(page.closeDevTools).toHaveBeenCalledTimes(1);
      // Never Electron's own toggle, which opens them where they were docked.
      expect(page.toggleDevTools).not.toHaveBeenCalled();
    },
  );

  it("inspects an element in tools of their own, from the page's menu", () => {
    const page = buildFor('win32');
    page.emit('context-menu', {}, { x: 40, y: 50 });
    press(itemCalled('Inspect element'));
    expect(page.openDevTools).toHaveBeenCalledWith(DETACHED);
    expect(page.inspectElement).toHaveBeenCalledWith(40, 50);
  });
});
