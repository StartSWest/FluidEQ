/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Electron fuses a packaged build is flipped with. Each one turns off a
 * way to run arbitrary code under FluidEQ's own executable — and so under
 * its name, its signature and its signed-in member — that the app itself
 * never uses. Nothing at runtime would notice one going missing from the
 * build configuration, which is why this reads it.
 */

import { readFileSync } from 'fs';
import path from 'path';

const build = JSON.parse(
  readFileSync(path.join(__dirname, '../../../package.json'), 'utf8'),
).build as { asar?: boolean; electronFuses?: Record<string, boolean> };

describe('the packaged build’s fuses', () => {
  it('will not run as plain Node, take NODE_OPTIONS or open the Node inspector', () => {
    expect(build.electronFuses).toMatchObject({
      runAsNode: false,
      enableNodeOptionsEnvironmentVariable: false,
      enableNodeCliInspectArguments: false,
    });
  });

  it('loads the app only from its archive, which it is packed into', () => {
    expect(build.electronFuses?.onlyLoadAppFromAsar).toBe(true);
    // The control: without an archive that fuse would stop the app loading.
    expect(build.asar).toBe(true);
  });
});
