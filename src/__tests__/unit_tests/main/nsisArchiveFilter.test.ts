/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import configureNsisArchiveFilter from '../../../../.erb/scripts/nsis-archive-filter.cjs';
import manifest from '../../../../package.json';

const filter = 'ELECTRON_BUILDER_7Z_FILTER';
const initialFilter = process.env[filter];

afterEach(() => {
  if (initialFilter === undefined) {
    delete process.env[filter];
  } else {
    process.env[filter] = initialFilter;
  }
});

it('registers the filter hook in the normal packaging configuration', () => {
  expect(manifest.build.beforePack).toBe(
    '.erb/scripts/nsis-archive-filter.cjs',
  );
});

it.each(['nsis', 'nsis-web'])('selects a compatible filter for %s', (name) => {
  process.env[filter] = 'BCJ2';
  configureNsisArchiveFilter({
    electronPlatformName: 'win32',
    targets: [{ name }],
  });
  expect(process.env[filter]).toBe('BCJ');
});

it.each([
  ['win32', 'zip'],
  ['darwin', 'dmg'],
  ['linux', 'AppImage'],
])('leaves the filter alone for %s %s', (electronPlatformName, name) => {
  process.env[filter] = 'ARM64';
  configureNsisArchiveFilter({ electronPlatformName, targets: [{ name }] });
  expect(process.env[filter]).toBe('ARM64');
});
