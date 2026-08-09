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

export default class MenuBuilder {
  mainWindow: BrowserWindow;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  buildMenu(): void {
    // Before the production early return below, because zoom has to work in a
    // packaged build and that path removes the menu entirely — an accelerator
    // hung off a menu item would only ever fire in development.
    this.installZoomShortcuts();

    if (
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
    ) {
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

    webContents.on('before-input-event', (event, input) => {
      // `control` is set by AltGr on some layouts, which is how a European
      // keyboard types the characters these shortcuts use.
      if (input.type !== 'keyDown' || !input.control || input.alt) {
        return;
      }

      const current = webContents.getZoomLevel();
      let next: number | undefined;

      // The plus key is unshifted `=` on most layouts and `+` on the numpad or
      // with shift, so all three mean zoom in. Matching on `code` as well
      // covers layouts where the character is somewhere else entirely.
      if (
        input.key === '+' ||
        input.key === '=' ||
        input.code === 'NumpadAdd'
      ) {
        next = Math.min(ZOOM_MAX_LEVEL, current + ZOOM_STEP);
      } else if (
        input.key === '-' ||
        input.key === '_' ||
        input.code === 'NumpadSubtract'
      ) {
        next = Math.max(ZOOM_MIN_LEVEL, current - ZOOM_STEP);
      } else if (input.key === '0' || input.code === 'Numpad0') {
        next = 0;
      }

      if (next === undefined) {
        return;
      }

      // Swallowed either way. Letting it through means the keystroke also
      // reaches whatever is focused, and at the limits it would type a bare
      // `+` into a preset name the user was only trying to zoom past.
      event.preventDefault();

      if (next !== current) {
        webContents.setZoomLevel(next);
      }
    });
  }

  setupDevelopmentEnvironment(): void {
    this.mainWindow.webContents.on('context-menu', (_, props) => {
      const { x, y } = props;

      Menu.buildFromTemplate([
        {
          label: 'Inspect element',
          click: () => {
            this.mainWindow.webContents.inspectElement(x, y);
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
            this.mainWindow.webContents.toggleDevTools();
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

    const subMenuView =
      process.env.NODE_ENV === 'development' ||
      process.env.DEBUG_PROD === 'true'
        ? subMenuViewDev
        : subMenuViewProd;

    return [subMenuAbout, subMenuEdit, subMenuView, subMenuWindow, subMenuHelp];
  }

  buildDefaultTemplate() {
    const templateDefault = [
      {
        label: '&View',
        submenu:
          process.env.NODE_ENV === 'development' ||
          process.env.DEBUG_PROD === 'true'
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
                    this.mainWindow.webContents.toggleDevTools();
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
