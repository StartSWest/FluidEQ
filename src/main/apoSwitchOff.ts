/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The two questions asked before Equalizer APO is switched off or put back.
 *
 * Both are reads no administrator is needed for, and both exist to keep a
 * Windows prompt off the screen of somebody it would do nothing for: a switch
 * to the FluidEQ Engine on a machine where Equalizer APO is on no output at
 * all has nothing to switch off, and a switch back on a machine this app
 * never switched it off on has nothing to put back.
 *
 * The record of what was switched off belongs to the setup helper, which
 * writes one file per output under `<engine root>\apo-off` (`backup.cpp`).
 * This only counts them.
 */

import fs from 'fs';
import path from 'path';
import { discoverAudioDevices } from './audioDevices';
import { getFluidEngineConfigDir } from './registry';

/** `%ProgramData%\FluidEQ\engine\apo-off`. */
export const apoSwitchOffDir = (): string =>
  path.join(path.dirname(getFluidEngineConfigDir()), 'apo-off');

/**
 * Whether Equalizer APO is registered on any output Windows currently has.
 *
 * Unknown reads as no: this decides whether to ask for administrator rights,
 * and a registry the app could not read is not a reason to put a prompt in
 * front of somebody. The switch works either way — it is the other engine's
 * removal that waits.
 */
export const isApoOnAnyOutput = async (): Promise<boolean> => {
  if (process.platform !== 'win32') {
    return false;
  }
  try {
    const devices = await discoverAudioDevices();
    return devices.some((device) => device.isEqualizerApoAttached === true);
  } catch {
    return false;
  }
};

/** Whether this app has Equalizer APO switched off on any output. */
export const isApoSwitchedOff = async (): Promise<boolean> => {
  if (process.platform !== 'win32') {
    return false;
  }
  try {
    const names = await fs.promises.readdir(apoSwitchOffDir());
    return names.some((name) => name.toLowerCase().endsWith('.json'));
  } catch {
    // No directory: it has never been switched off on this machine.
    return false;
  }
};
