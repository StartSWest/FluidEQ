/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Tint app icon" (Ivan, 2026-10-26: "we need a toggle if user wants to tint
 * the icon with theme or keep the original", "default is off", "put that in
 * both full app and amp settings"): off keeps the installed icon on the
 * taskbar and in the tray whatever the window's colours, on draws it in them.
 */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { TTaskbarIconRequest } from 'common/taskbarIcon';
import AppIconTintSwitch from 'renderer/graph/AppIconTintSwitch';
import {
  APP_ICON_TINT_KEY,
  isAppIconTinted,
  setAppIconTinted,
} from 'renderer/utils/appIconTint';
import { resetSettings } from 'renderer/utils/settingsReset';
import { startTaskbarIconSync } from 'renderer/utils/taskbarIconSync';

const readColours = jest.fn();

jest.mock('renderer/utils/I18nContext', () => ({
  __esModule: true,
  useTranslation: () => ({ locale: 'en', t: (key: string) => key }),
}));

// A window wearing a Tint, so the icon would be drawn were the switch on.
jest.mock('renderer/utils/sceneTintStore', () => ({
  __esModule: true,
  getShownSceneSky: () => ({ hue: 300, chroma: 0.1, lightness: 0.6 }),
}));

jest.mock('renderer/utils/taskbarIconArt', () => ({
  __esModule: true,
  readTaskbarIconColours: () => readColours(),
  drawTaskbarIcons: () => [{ size: 16, rgba: new Uint8Array(1024) }],
}));

const nextFrame = () =>
  act(
    () =>
      new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
      }),
  );

let sent: TTaskbarIconRequest[] = [];
const send = (request: TTaskbarIconRequest) => {
  sent.push(request);
  return Promise.resolve();
};

beforeEach(() => {
  sent = [];
  readColours.mockReset();
  readColours.mockReturnValue({ tile: [1, 2, 3], logo: [4, 5, 6] });
  setAppIconTinted(false);
  window.localStorage.removeItem(APP_ICON_TINT_KEY);
});

describe('the taskbar and tray icon under the switch', () => {
  it('starts off, keeping the installed icon without reading the colours', async () => {
    const stop = startTaskbarIconSync(send);
    await nextFrame();
    expect(sent).toEqual([{ kind: 'stock' }]);
    expect(readColours).not.toHaveBeenCalled();
    stop();
  });

  it('draws the icon once switched on, and puts the installed one back at once when off', async () => {
    const stop = startTaskbarIconSync(send);
    await nextFrame();
    act(() => setAppIconTinted(true));
    await nextFrame();
    // A microtask for the set before it, which the next change waits on.
    await act(async () => {
      await Promise.resolve();
    });
    expect(sent[sent.length - 1]).toMatchObject({ kind: 'drawn' });
    act(() => setAppIconTinted(false));
    await nextFrame();
    expect(sent[sent.length - 1]).toEqual({ kind: 'stock' });
    stop();
  });
});

describe('the switch', () => {
  it('is off on a new install, and on where it was left on', () => {
    const fresh = () => {
      let answer: boolean | undefined;
      jest.isolateModules(() => {
        // eslint-disable-next-line global-require, @typescript-eslint/no-var-requires -- a fresh copy of the module reads storage as a new launch does
        const store = require('renderer/utils/appIconTint') as {
          isAppIconTinted: () => boolean;
        };
        answer = store.isAppIconTinted();
      });
      return answer;
    };
    expect(fresh()).toBe(false);
    window.localStorage.setItem(APP_ICON_TINT_KEY, 'on');
    expect(fresh()).toBe(true);
  });

  it('is one setting wherever it stands, remembered as on', () => {
    render(
      <>
        <AppIconTintSwitch />
        <AppIconTintSwitch />
      </>,
    );
    const [first, second] = screen.getAllByRole('checkbox', {
      name: 'graph.sceneTint.appIcon',
    });
    expect(first).not.toBeChecked();
    fireEvent.click(first);
    expect(second).toBeChecked();
    expect(isAppIconTinted()).toBe(true);
    expect(window.localStorage.getItem(APP_ICON_TINT_KEY)).toBe('on');
  });

  it('is forgotten by Reset all settings, which leaves the installed icon', () => {
    window.localStorage.setItem(APP_ICON_TINT_KEY, 'on');
    resetSettings(window.localStorage);
    expect(window.localStorage.getItem(APP_ICON_TINT_KEY)).toBeNull();
  });
});
