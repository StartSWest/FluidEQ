/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * "Start with Windows" in the actions menu's settings tray is a Windows row.
 * On a Mac it used to show under that name and, once switched on, say Windows
 * had it switched off in Startup apps — Electron reports that switch on
 * Windows only — and on Ubuntu Electron has no login items for it to write.
 */

import '@testing-library/jest-dom';
import type * as TestingLibrary from '@testing-library/react';
import type { ReactElement } from 'react';
import type { IStartWithWindows } from 'main/startWithWindows';
import en from 'common/i18n/en';
// Transformed while the file is collected, outside any test's time budget.
import '@testing-library/react/pure';
import '../../../renderer/components/StartupPicker';

let library: typeof TestingLibrary | undefined;
const startWithWindows = jest.fn(async (): Promise<IStartWithWindows> => ({
  on: false,
  blockedByWindows: false,
}));

const onPlatform = (platform: string) => {
  window.electron = {
    platform,
    ipcRenderer: { startWithWindows, setStartWithWindows: jest.fn() },
  } as unknown as typeof window.electron;
};

afterEach(() => {
  library?.cleanup();
  library = undefined;
  startWithWindows.mockClear();
});

/** The row from a fresh registry, so no answer kept by an earlier case. */
const rendered = async () => {
  let Picker: (() => ReactElement | null) | undefined;
  jest.isolateModules(() => {
    /* eslint-disable global-require -- a fresh module registry is the point */
    library = require('@testing-library/react/pure');
    Picker = require('../../../renderer/components/StartupPicker').default;
    /* eslint-enable global-require */
  });
  if (!Picker || !library) {
    throw new Error('StartupPicker did not load');
  }
  const fresh = library;
  fresh.render(<Picker />);
  await fresh.act(async () => undefined);
  return fresh;
};

it('shows the switch on Windows, as Windows answers it', async () => {
  onPlatform('win32');
  const fresh = await rendered();

  expect(
    fresh.screen.getByRole('checkbox', { name: en['startup.label'] }),
  ).not.toBeChecked();
  expect(startWithWindows).toHaveBeenCalledTimes(1);
});

it.each(['darwin', 'linux'])(
  'has no row on %s, and never asks for one',
  async (platform) => {
    onPlatform(platform);
    const fresh = await rendered();

    expect(
      fresh.screen.queryByRole('checkbox', { name: en['startup.label'] }),
    ).not.toBeInTheDocument();
    expect(startWithWindows).not.toHaveBeenCalled();
  },
);
