/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The development build's own Windows identity (Ivan, 2026-09-26: "it shows
 * in tray but taskbar still old icon"): under the installed app's id the
 * taskbar drew a `pnpm dev` window with the installed shortcut's icon.
 */

import fs from 'fs';
import path from 'path';
import { APP_ID } from '../../../common/branding';
import {
  APP_USER_MODEL_ID,
  DEV_APP_ID,
  appUserModelIdFor,
} from '../../../main/appIdentity';

describe('the id Windows files this process under', () => {
  it('is its own in development, never the installed app’s', () => {
    expect(appUserModelIdFor(true)).toBe(DEV_APP_ID);
    expect(DEV_APP_ID).not.toBe(APP_ID);
  });

  // The control: an installed build keeps the id its installer's shortcut
  // carries, or it would lose its own taskbar icon and pins instead.
  it('is the installer’s own for an installed build', () => {
    expect(appUserModelIdFor(false)).toBe(APP_ID);
    const { build } = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', '..', '..', '..', 'package.json'),
        'utf8',
      ),
    ) as { build: { appId: string } };
    expect(build.appId).toBe(APP_ID);
  });

  it('reads as installed where Electron did not start an app itself', () => {
    expect(process.defaultApp).toBeUndefined();
    expect(APP_USER_MODEL_ID).toBe(APP_ID);
  });
});
