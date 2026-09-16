/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * FluidEQ's version, as the main process reports it.
 *
 * `app.getVersion()` answers Electron's own version under `pnpm dev`, so
 * everything in main that named the app named it 43.2.0 while the About
 * dialog a few pixels away said 1.7.2. Both halves read the same
 * `FLUIDEQ_VERSION` now, and nothing in main may go back to asking Electron.
 */

import fs from 'fs';
import path from 'path';

const ELECTRON_VERSION = '43.2.0';

jest.mock('electron', () => ({ app: { getVersion: () => ELECTRON_VERSION } }));

const mainDir = path.join(__dirname, '..', '..', '..', 'main');

/**
 * `appVersion` with `PRODUCT_VERSION` set to `shipped`.
 *
 * Mocked rather than read: the version reaches both halves of the app from
 * `FLUIDEQ_VERSION`, which webpack inlines for a build and `dev-main.cjs`
 * fills for development — and Jest is neither, so it is empty here.
 */
const withShipped = (shipped: string): (() => string) => {
  jest.resetModules();
  jest.doMock('../../../common/branding', () => ({
    PRODUCT_VERSION: shipped,
  }));
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const loaded = require('../../../main/appVersion') as {
    appVersion: () => string;
  };
  return loaded.appVersion;
};

afterEach(() => {
  jest.dontMock('../../../common/branding');
  jest.resetModules();
});

/** Every `.ts` under `src/main`, which is where the version is reported from. */
const mainFiles = (folder: string): string[] =>
  fs.readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      return mainFiles(full);
    }
    return entry.isFile() && entry.name.endsWith('.ts') ? [full] : [];
  });

it('is the shipped version, not the Electron the app happens to run on', () => {
  expect(withShipped('1.7.2')()).toBe('1.7.2');
  expect(withShipped('1.7.2')()).not.toBe(ELECTRON_VERSION);
});

it('falls back to Electron rather than reporting no version at all', () => {
  // An empty version in a bug report, or in a restart marker the updater
  // compares against, is worse than Electron's.
  expect(withShipped('')()).toBe(ELECTRON_VERSION);
});

it('is asked for in every place main names the app', () => {
  const asking = mainFiles(mainDir).filter(
    (file) =>
      path.basename(file) !== 'appVersion.ts' &&
      fs.readFileSync(file, 'utf8').includes('app.getVersion()'),
  );
  // One place decides what the app calls itself. Four used to, and they
  // disagreed with the window and with each other about what "the version" is.
  expect(asking.map((file) => path.relative(mainDir, file))).toEqual([]);
});
