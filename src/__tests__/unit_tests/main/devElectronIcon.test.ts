/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The development Electron binary carries the app's name and icon
 * (`name-dev-electron.ts`). It used to be skipped once it carried the name,
 * so the icon went in at the first install and a new one never reached the
 * taskbar (Ivan, 2026-09-26: "and the app icon?"). Importing the script
 * stamps nothing: only the install and `pnpm dev` call it.
 */

import fs from 'fs';
import path from 'path';
import {
  ICON_KEY,
  iconFingerprint,
  isStamped,
} from '../../../../.erb/scripts/name-dev-electron';

const ICON = fs.readFileSync(
  path.join(__dirname, '..', '..', '..', '..', 'assets', 'icon.ico'),
);

describe('whether the development binary needs stamping', () => {
  const current = iconFingerprint(ICON);

  it('leaves a binary that carries the name and this icon', () => {
    expect(
      isStamped({ FileDescription: 'FluidEQ', [ICON_KEY]: current }, current),
    ).toBe(true);
  });

  // The case the old check missed: named already, icon from before.
  it('stamps a binary named FluidEQ that carries another icon', () => {
    const before = iconFingerprint(Buffer.from('the icon before this one'));
    expect(before).not.toBe(current);
    expect(
      isStamped({ FileDescription: 'FluidEQ', [ICON_KEY]: before }, current),
    ).toBe(false);
    // And one stamped before icons were fingerprinted at all.
    expect(isStamped({ FileDescription: 'FluidEQ' }, current)).toBe(false);
  });

  it('stamps a binary that still calls itself Electron', () => {
    expect(
      isStamped({ FileDescription: 'Electron', [ICON_KEY]: current }, current),
    ).toBe(false);
  });

  it('asks only for the name in a tree with no icon', () => {
    expect(isStamped({ FileDescription: 'FluidEQ' }, undefined)).toBe(true);
  });

  it('tells icons apart by their bytes, in sixteen hex digits', () => {
    expect(current).toMatch(/^[0-9a-f]{16}$/);
    expect(iconFingerprint(ICON)).toBe(current);
  });
});
