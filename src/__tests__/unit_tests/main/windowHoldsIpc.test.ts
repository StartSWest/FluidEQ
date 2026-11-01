/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the app's page says it holds, from that page only, and the page
 * leaving without a word (`ipc/windowHolds.ts`).
 */
import { EventEmitter } from 'events';
import type { BrowserWindow, WebContents } from 'electron';
import { WINDOW_HOLD_CHANNEL } from '../../../common/windowHold';
import {
  followWindowPage,
  registerWindowHoldsIpc,
} from '../../../main/ipc/windowHolds';

const mockListeners = new Map<string, (...args: unknown[]) => void>();

jest.mock('electron', () => ({
  ipcMain: {
    on: (channel: string, listener: (...args: unknown[]) => void) =>
      mockListeners.set(channel, listener),
    removeListener: jest.fn(),
  },
}));

const fakeWindow = () => {
  const page = new EventEmitter();
  const window = {
    webContents: page,
    isDestroyed: () => false,
  } as unknown as BrowserWindow;
  return { window, page };
};

describe('what the page says it holds', () => {
  const said = (sender: unknown, raw: unknown) =>
    mockListeners.get(WINDOW_HOLD_CHANNEL)?.({ sender }, raw);

  it('is taken from the app window’s page, and nothing else', () => {
    const { window, page } = fakeWindow();
    const pageSaid = jest.fn();
    registerWindowHoldsIpc(() => window, { pageSaid });

    said(new EventEmitter(), [['player']]);
    expect(pageSaid).not.toHaveBeenCalled();

    said(page, [['player', 'maker']]);
    expect(pageSaid).toHaveBeenCalledWith(['player', 'maker']);
    said(page, [[]]);
    expect(pageSaid).toHaveBeenLastCalledWith([]);
  });

  it('ignores what is not a list of holds', () => {
    const { window, page } = fakeWindow();
    const pageSaid = jest.fn();
    registerWindowHoldsIpc(() => window, { pageSaid });
    said(page, [['player', 'everything']]);
    said(page, ['player']);
    said(page, undefined);
    expect(pageSaid).not.toHaveBeenCalled();
    // POSITIVE CONTROL: the same page, well formed.
    said(page, [['player']]);
    expect(pageSaid).toHaveBeenCalledWith(['player']);
  });

  it('hears nothing while there is no window', () => {
    const { page } = fakeWindow();
    const pageSaid = jest.fn();
    registerWindowHoldsIpc(() => null, { pageSaid });
    said(page, [[]]);
    expect(pageSaid).not.toHaveBeenCalled();
  });
});

describe('the page leaving without a word', () => {
  it('is every reload, crash and destroyed page of the window', () => {
    const { window, page } = fakeWindow();
    const pageLeft = jest.fn();
    followWindowPage(window, page as unknown as WebContents, () => window, {
      pageLeft,
    });

    // A move inside the page, and a frame inside it, are not the page.
    page.emit('did-start-navigation', {}, 'x#y', true, true);
    page.emit('did-start-navigation', {}, 'frame', false, false);
    expect(pageLeft).not.toHaveBeenCalled();

    page.emit('did-start-navigation', {}, 'x', false, true);
    page.emit('render-process-gone', {}, { reason: 'crashed' });
    page.emit('destroyed');
    expect(pageLeft).toHaveBeenCalledTimes(3);
  });

  it('never erases what a newer window’s page has said', () => {
    const old = fakeWindow();
    const next = fakeWindow();
    let current: BrowserWindow | null = old.window;
    const pageLeft = jest.fn();
    followWindowPage(
      old.window,
      old.page as unknown as WebContents,
      () => current,
      { pageLeft },
    );

    current = next.window;
    old.page.emit('destroyed');
    expect(pageLeft).not.toHaveBeenCalled();

    // POSITIVE CONTROL: with no window yet, the old page going counts.
    current = null;
    old.page.emit('render-process-gone', {}, { reason: 'killed' });
    expect(pageLeft).toHaveBeenCalledTimes(1);
  });
});
