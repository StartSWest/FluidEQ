/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The actions menu's startup row: "Start with Windows" on Windows, "Open at
 * login" on a Mac, in each system's own words. A Mac once showed the Windows
 * row and, switched on, said Windows had it off in Startup apps — Electron
 * reports that switch on Windows only. On Ubuntu Electron has no login items
 * for it to write, so there is no row.
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

it("is Open at login on a Mac, in macOS's own words", async () => {
  onPlatform('darwin');
  const fresh = await rendered();

  expect(
    fresh.screen.getByRole('checkbox', { name: en['startup.labelMac'] }),
  ).not.toBeChecked();
  expect(
    fresh.screen.queryByRole('checkbox', { name: en['startup.label'] }),
  ).not.toBeInTheDocument();
  expect(startWithWindows).toHaveBeenCalledTimes(1);
});

it('says when macOS is waiting for the login item to be allowed', async () => {
  onPlatform('darwin');
  startWithWindows.mockResolvedValueOnce({
    on: true,
    blockedByWindows: false,
    needsApproval: true,
  });
  const fresh = await rendered();

  expect(fresh.screen.getByRole('status')).toHaveTextContent(
    en['startup.approvalMac'],
  );
});

it('has no row on linux, and never asks for one', async () => {
  onPlatform('linux');
  const fresh = await rendered();

  expect(fresh.screen.queryByRole('checkbox')).not.toBeInTheDocument();
  expect(startWithWindows).not.toHaveBeenCalled();
});

it.each(['win32', 'darwin'])(
  'has no row in a development build on %s, which the system cannot start',
  async (platform) => {
    onPlatform(platform);
    startWithWindows.mockResolvedValueOnce({
      on: false,
      blockedByWindows: false,
      unavailable: true,
    });
    const fresh = await rendered();

    expect(startWithWindows).toHaveBeenCalledTimes(1);
    expect(fresh.screen.queryByRole('checkbox')).not.toBeInTheDocument();
  },
);
