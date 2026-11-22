/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every page the app opens gets a text field's right-click menu
 * (`main/editContextMenu.ts`), reported by Electron's `context-menu` — which
 * Chromium sends only for a click the page left alone. A page drawing its own
 * menu (the bands, the Library rows) calls `preventDefault` on `contextmenu`
 * and is never reported, so nothing here can open over it.
 */

import { EventEmitter } from 'events';
import type { MenuItemConstructorOptions } from 'electron';

const mockApp = new EventEmitter();
const mockTemplates: MenuItemConstructorOptions[][] = [];
const mockPopup = jest.fn();
const mockWindow = { id: 1 };

jest.mock('electron', () => ({
  app: mockApp,
  BrowserWindow: {
    fromWebContents: (contents: { isGuest?: boolean }) =>
      contents.isGuest ? null : mockWindow,
  },
  Menu: {
    buildFromTemplate: (template: MenuItemConstructorOptions[]) => {
      mockTemplates.push(template);
      return { popup: mockPopup };
    },
  },
}));

// The tray's language, which needs a tray; English here, as before the
// window names its language.
jest.mock('main/mainText', () => {
  const { translate } = jest.requireActual('common/i18n');
  return {
    __esModule: true,
    default: (key: string) => translate('en', key),
  };
});

// eslint-disable-next-line import/first -- the mocks above must be in place first
import installEditContextMenus from 'main/editContextMenu';

/** A page's contents: what the menu calls on it, and its events. */
const page = (url = 'file:///index.html', extra: object = {}) =>
  Object.assign(new EventEmitter(), {
    getURL: () => url,
    undo: jest.fn(),
    redo: jest.fn(),
    cut: jest.fn(),
    copy: jest.fn(),
    paste: jest.fn(),
    pasteAndMatchStyle: jest.fn(),
    selectAll: jest.fn(),
    replaceMisspelling: jest.fn(),
    isDevToolsOpened: jest.fn(() => false),
    openDevTools: jest.fn(),
    inspectElement: jest.fn(),
    hostWebContents: null,
    ...extra,
  });

const FIELD = {
  x: 40,
  y: 50,
  frame: null,
  isEditable: true,
  selectionText: '',
  misspelledWord: '',
  dictionarySuggestions: [],
  formControlType: 'text-area',
  editFlags: {
    canUndo: true,
    canRedo: false,
    canCut: false,
    canCopy: false,
    canPaste: true,
    canSelectAll: true,
    canDelete: false,
    canEditRichly: false,
  },
};

const CANVAS = { ...FIELD, isEditable: false, formControlType: 'none' };

const lastMenu = () => mockTemplates[mockTemplates.length - 1];

const press = (label: string) => {
  const item = lastMenu().find((entry) => entry.label === label);
  if (!item?.click) {
    throw new Error(`no menu item called ${label}`);
  }
  (item.click as () => void)();
};

const created = (contents: EventEmitter) =>
  mockApp.emit('web-contents-created', {}, contents);

beforeEach(() => {
  mockApp.removeAllListeners();
  mockTemplates.length = 0;
  mockPopup.mockClear();
});

describe('the right-click menu on every page', () => {
  it('opens over the window on a text field, and pastes into that page', () => {
    installEditContextMenus({ canInspect: false });
    const window = page();
    created(window);

    window.emit('context-menu', {}, FIELD);

    expect(mockPopup).toHaveBeenCalledTimes(1);
    expect(mockPopup).toHaveBeenCalledWith({
      window: mockWindow,
      frame: undefined,
    });
    press('Paste');
    expect(window.paste).toHaveBeenCalledTimes(1);
    press('Select all');
    expect(window.selectAll).toHaveBeenCalledTimes(1);
  });

  it('reaches a Media page too, opening over the window that embeds it', () => {
    installEditContextMenus({ canInspect: false });
    const guest = page('https://www.youtube.com/', {
      isGuest: true,
      hostWebContents: {},
    });
    created(guest);

    guest.emit('context-menu', {}, FIELD);

    expect(mockPopup).toHaveBeenCalledWith({
      window: mockWindow,
      frame: undefined,
    });
    press('Undo');
    expect(guest.undo).toHaveBeenCalledTimes(1);
  });

  it('opens nothing where there is nothing to edit or copy', () => {
    installEditContextMenus({ canInspect: false });
    const window = page();
    created(window);

    window.emit('context-menu', {}, CANVAS);

    expect(mockPopup).not.toHaveBeenCalled();
  });

  it('leaves the developer tools’ own menus alone', () => {
    installEditContextMenus({ canInspect: true });
    const tools = page('devtools://devtools/bundled/devtools_app.html');
    created(tools);

    tools.emit('context-menu', {}, FIELD);

    expect(mockPopup).not.toHaveBeenCalled();
  });

  it('carries development’s Inspect element, one menu for one click', () => {
    installEditContextMenus({ canInspect: true });
    const window = page();
    created(window);

    window.emit('context-menu', {}, CANVAS);

    expect(mockPopup).toHaveBeenCalledTimes(1);
    press('Inspect element');
    // In tools of their own, never docked (`devTools.ts`).
    expect(window.openDevTools).toHaveBeenCalledWith({
      mode: 'detach',
      activate: false,
    });
    expect(window.inspectElement).toHaveBeenCalledWith(40, 50);

    window.emit('context-menu', {}, FIELD);
    expect(mockPopup).toHaveBeenCalledTimes(2);
    expect(lastMenu().map((entry) => entry.label)).toContain('Paste');
  });
});
