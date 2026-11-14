/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import {
  app,
  Menu,
  shell,
  BrowserWindow,
  MenuItemConstructorOptions,
} from 'electron';
import { PRODUCT_NAME, REPOSITORY_URL } from '../common/branding';
import { zoomKeyOf } from '../common/readingZoom';
import { inspectDetached, toggleDetachedDevTools } from './devTools';

interface DarwinMenuItemConstructorOptions extends MenuItemConstructorOptions {
  selector?: string;
  submenu?: DarwinMenuItemConstructorOptions[] | Menu;
}

/*
 * How far one press moves, and it is half a browser step.
 *
 * Chromium's own ramp is a factor of 1.2 per level, which is right for a page:
 * a browser zoom is usually reached for once, to make text readable, and the
 * next stop wants to be visibly different. This is an instrument panel, and the
 * thing people do with it is settle — find the size at which the graph and the
 * band row both fit the screen they have. A 20% jump steps straight over that
 * size, and the way back is another 20% jump to somewhere else.
 *
 * A half level puts a stop between each pair of browser sizes: about 9.5% a
 * press instead of 20%, twice as many stops across the same range. The range
 * itself is unchanged, so the smallest and largest the interface can get are
 * exactly what they were — this only adds places to stop on the way.
 *
 * Chromium takes a fractional level perfectly well; the integers are a
 * convention of the zoom menu, not a constraint of the API.
 */
const ZOOM_STEP = 0.5;
const ZOOM_MIN_LEVEL = -3;
const ZOOM_MAX_LEVEL = 4;

/** The builds `buildMenu` gives a menu of their own: reload, DevTools. */
const hasDevelopmentMenu = () =>
  process.env.NODE_ENV === 'development' || process.env.DEBUG_PROD === 'true';

/**
 * No application menu on Windows and Linux in a release, said before `ready`.
 *
 * Electron builds a default menu at launch for an app that has not set one —
 * File, Edit, View, Window, Help and their accelerators — and a release there
 * never shows it: the window is frameless and `buildMenu` takes its menu away
 * the moment the page has loaded. Said after `ready` it is too late, the
 * default has been built by then. macOS keeps Electron's default, because its
 * Edit menu is what makes Command+C, Command+V and Command+A work in a text
 * field; development builds its own menu later either way.
 */
export const declineDefaultMenu = (): void => {
  if (process.platform === 'darwin' || hasDevelopmentMenu()) {
    return;
  }
  Menu.setApplicationMenu(null);
};

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  /**
   * Told after every zoom step. The player's floor is its layout's size in
   * CSS pixels, so it is a different number of window pixels at each zoom.
   */
  onZoom: () => void;

  /**
   * A reading page has the keyboard (the Forum, `common/readingZoom.ts`):
   * Ctrl and +, − and 0 size its text, so they pass through to it instead
   * of zooming the window. Back to false whenever the page is replaced, so a
   * renderer that went away holding the keys cannot keep the window's zoom
   * from working.
   */
  private readingHasKeys = false;

  constructor(mainWindow: BrowserWindow, onZoom: () => void) {
    this.mainWindow = mainWindow;
    this.onZoom = onZoom;
  }

  buildMenu(): void {
    // Before the production early return below, because zoom has to work in a
    // packaged build and that path removes the menu entirely — an accelerator
    // hung off a menu item would only ever fire in development.
    this.installZoomShortcuts();

    if (hasDevelopmentMenu()) {
      this.setupDevelopmentEnvironment();
    } else {
      this.mainWindow.setMenu(null);
      return;
    }

    const template =
      process.platform === 'darwin'
        ? this.buildDarwinTemplate()
        : this.buildDefaultTemplate();

    const menu = Menu.buildFromTemplate(template);
    Menu.setApplicationMenu(menu);
  }

  /**
   * Ctrl and plus, minus or zero, scaling the whole interface.
   *
   * Chromium's own zoom rather than a CSS transform, so it scales layout the
   * way a browser does — text reflows and the graph is redrawn at the new size
   * instead of being blown up and going soft.
   *
   * Read off `before-input-event` rather than a menu accelerator because a
   * packaged FluidEQ has no menu to hang one off. Deliberately keyboard only:
   * the response graph and every slider already read the wheel, and a control
   * that resizes the window out from under a drag when a modifier slips is
   * worse than not having it.
   */
  installZoomShortcuts(): void {
    const { webContents } = this.mainWindow;

    webContents.on(
      'did-start-navigation',
      (_event, _url, isInPlace, isMainFrame) => {
        if (isMainFrame && !isInPlace) {
          this.readingHasKeys = false;
        }
      },
    );
    webContents.on('render-process-gone', () => {
      this.readingHasKeys = false;
    });

    webContents.on('before-input-event', (event, input) => {
      if (input.type !== 'keyDown') {
        return;
      }
      const key = zoomKeyOf(input);
      // A reading page with the keyboard sizes its own text with these.
      if (key === undefined || this.readingHasKeys) {
        return;
      }

      const current = webContents.getZoomLevel();
      let next = 0;
      if (key === 'in') {
        next = Math.min(ZOOM_MAX_LEVEL, current + ZOOM_STEP);
      } else if (key === 'out') {
        next = Math.max(ZOOM_MIN_LEVEL, current - ZOOM_STEP);
      }

      // Swallowed either way. Letting it through means the keystroke also
      // reaches whatever is focused, and at the limits it would type a bare
      // `+` into a preset name the user was only trying to zoom past.
      event.preventDefault();

      if (next !== current) {
        webContents.setZoomLevel(next);
        this.onZoom();
      }
    });
  }

  /** Whether a reading page has the keyboard; see `readingHasKeys`. */
  setReadingHasKeys(hasKeys: boolean): void {
    this.readingHasKeys = hasKeys;
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            inspectDetached(this.mainWindow.webContents, x, y);
          },
        },
      ]).popup({ window: this.mainWindow });
    });
  }

  buildDarwinTemplate(): MenuItemConstructorOptions[] {
    const subMenuAbout: DarwinMenuItemConstructorOptions = {
      label: PRODUCT_NAME,
      submenu: [
        {
          label: `About ${PRODUCT_NAME}`,
          selector: 'orderFrontStandardAboutPanel:',
        },
        { type: 'separator' },
        { label: 'Services', submenu: [] },
        { type: 'separator' },
        {
          label: `Hide ${PRODUCT_NAME}`,
          accelerator: 'Command+H',
          selector: 'hide:',
        },
        {
          label: 'Hide Others',
          accelerator: 'Command+Shift+H',
          selector: 'hideOtherApplications:',
        },
        { label: 'Show All', selector: 'unhideAllApplications:' },
        { type: 'separator' },
        {
          label: 'Quit',
          accelerator: 'Command+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    };
    const subMenuEdit: DarwinMenuItemConstructorOptions = {
      label: 'Edit',
      submenu: [
        { label: 'Undo', accelerator: 'Command+Z', selector: 'undo:' },
        { label: 'Redo', accelerator: 'Shift+Command+Z', selector: 'redo:' },
        { type: 'separator' },
        { label: 'Cut', accelerator: 'Command+X', selector: 'cut:' },
        { label: 'Copy', accelerator: 'Command+C', selector: 'copy:' },
        { label: 'Paste', accelerator: 'Command+V', selector: 'paste:' },
        {
          label: 'Select All',
          accelerator: 'Command+A',
          selector: 'selectAll:',
        },
      ],
    };
    const subMenuViewDev: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Reload',
          accelerator: 'Command+R',
          click: () => {
            this.mainWindow.webContents.reload();
          },
        },
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'Alt+Command+I',
          click: () => {
            toggleDetachedDevTools(this.mainWindow.webContents);
          },
        },
      ],
    };
    const subMenuViewProd: MenuItemConstructorOptions = {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Full Screen',
          accelerator: 'Ctrl+Command+F',
          click: () => {
            this.mainWindow.setFullScreen(!this.mainWindow.isFullScreen());
          },
        },
      ],
    };
    const subMenuWindow: DarwinMenuItemConstructorOptions = {
      label: 'Window',
      submenu: [
        {
          label: 'Minimize',
          accelerator: 'Command+M',
          selector: 'performMiniaturize:',
        },
        { label: 'Close', accelerator: 'Command+W', selector: 'performClose:' },
        { type: 'separator' },
        { label: 'Bring All to Front', selector: 'arrangeInFront:' },
      ],
    };
    const subMenuHelp: MenuItemConstructorOptions = {
      label: 'Help',
      submenu: [
        {
          label: 'Learn More',
          click() {
            shell.openExternal('https://electronjs.org');
          },
        },
        {
          label: 'Documentation',
          click() {
            shell.openExternal(
              'https://github.com/electron/electron/tree/main/docs#readme',
            );
          },
        },
        {
          label: 'Community Discussions',
          click() {
            shell.openExternal('https://www.electronjs.org/community');
          },
        },
        {
          label: 'Search Issues',
          click() {
            shell.openExternal('https://github.com/electron/electron/issues');
          },
        },
      ],
    };

    const subMenuView = hasDevelopmentMenu() ? subMenuViewDev : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&View',
        submenu: hasDevelopmentMenu()
          ? [
              {
                label: '&Reload',
                accelerator: 'Ctrl+R',
                click: () => {
                  this.mainWindow.webContents.reload();
                },
              },
              {
                label: 'Toggle &Full Screen',
                accelerator: 'F11',
                click: () => {
                  this.mainWindow.setFullScreen(
                    !this.mainWindow.isFullScreen(),
                  );
                },
              },
              {
                label: 'Toggle &Developer Tools',
                accelerator: 'Alt+Ctrl+I',
                click: () => {
                  toggleDetachedDevTools(this.mainWindow.webContents);
                },
              },
            ]
          : [
              {
                label: 'Toggle &Full Screen',
                accelerator: 'F11',
                click: () => {
                  this.mainWindow.setFullScreen(
                    !this.mainWindow.isFullScreen(),
                  );
                },
              },
            ],
      },
      {
        label: 'Help',
        submenu: [
          {
            label: 'Documentation',
            click() {
              shell.openExternal(REPOSITORY_URL);
            },
          },
        ],
      },
    ];

    return templateDefault;
  }
}
