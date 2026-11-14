/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ctrl with +, − and 0 zoom the whole window, read by main before the page.
 * While the Forum has the keyboard they size its text instead, so main lets
 * them through (`common/readingZoom.ts`). Each case beside the same key with
 * the Forum not holding it, which zooms the window as it always did.
 */

import { EventEmitter } from 'events';
import type { BrowserWindow } from 'electron';

jest.mock('electron', () => ({
  app: { name: 'FluidEQ', quit: jest.fn() },
  shell: { openExternal: jest.fn() },
  BrowserWindow: class {},
  Menu: { buildFromTemplate: jest.fn(), setApplicationMenu: jest.fn() },
}));

// eslint-disable-next-line import/first -- the mock above must be in place first
import MenuBuilder from 'main/menu';
// eslint-disable-next-line import/first -- after the mock, like the menu
import { zoomKeyOf } from '../../../common/readingZoom';

const build = () => {
  let level = 0;
  const webContents = Object.assign(new EventEmitter(), {
    getZoomLevel: () => level,
    setZoomLevel: jest.fn((next: number) => {
      level = next;
    }),
  });
  const window = { webContents, setMenu: jest.fn() };
  const menu = new MenuBuilder(window as unknown as BrowserWindow, jest.fn());
  menu.installZoomShortcuts();
  const press = (key: string, code = '') => {
    const event = { preventDefault: jest.fn() };
    webContents.emit('before-input-event', event, {
      type: 'keyDown',
      key,
      code,
      control: true,
      alt: false,
    });
    return event;
  };
  return { menu, webContents, press, level: () => level };
};

describe('the window zoom keys and the Forum', () => {
  it('zooms the window while no reading page has the keys', () => {
    const { press, level } = build();
    expect(press('=').preventDefault).toHaveBeenCalled();
    expect(level()).toBeGreaterThan(0);
  });

  it('lets the keys through to the Forum while it has them', () => {
    const { menu, press, webContents } = build();
    menu.setReadingHasKeys(true);
    const event = press('=');
    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(press('-').preventDefault).not.toHaveBeenCalled();
    expect(press('0').preventDefault).not.toHaveBeenCalled();
    expect(webContents.setZoomLevel).not.toHaveBeenCalled();
  });

  it('takes the keys back when the page is replaced or gone', () => {
    const { menu, press, webContents, level } = build();
    menu.setReadingHasKeys(true);
    webContents.emit('render-process-gone');
    press('=');
    expect(level()).toBeGreaterThan(0);
    menu.setReadingHasKeys(true);
    webContents.emit('did-start-navigation', {}, 'file:///x', false, true);
    press('0');
    expect(level()).toBe(0);
  });
});

describe('which keystroke is a zoom key', () => {
  const ctrl = (key: string, code = '') => ({
    key,
    code,
    control: true,
    alt: false,
  });

  it('reads + = and the numpad as in, − _ as out, 0 as back', () => {
    expect(zoomKeyOf(ctrl('+'))).toBe('in');
    expect(zoomKeyOf(ctrl('='))).toBe('in');
    expect(zoomKeyOf(ctrl('x', 'NumpadAdd'))).toBe('in');
    expect(zoomKeyOf(ctrl('-'))).toBe('out');
    expect(zoomKeyOf(ctrl('_'))).toBe('out');
    expect(zoomKeyOf(ctrl('0'))).toBe('reset');
  });

  it('is none without Ctrl, with AltGr, or for another key', () => {
    expect(zoomKeyOf({ ...ctrl('='), control: false })).toBeUndefined();
    expect(zoomKeyOf({ ...ctrl('='), alt: true })).toBeUndefined();
    expect(zoomKeyOf(ctrl('s'))).toBeUndefined();
  });
});
