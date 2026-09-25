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
import log from 'electron-log';
import type { IAudioDevice } from '../common/constants';
import type { TAudioEngine } from '../common/audioEngine';
import { discoverAudioDevices } from './audioDevices';
import type { IAutomaticSetup } from './automaticSetup';
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

/**
 * Equalizer APO taken out of Windows' effect lists by the app itself, once a
 * session, whenever the FluidEQ Engine is the engine and Equalizer APO is on
 * an output.
 *
 * The switch between engines is not enough on its own: Equalizer APO's own
 * Device Selector can be run at any moment afterwards, and it writes itself
 * into whichever slots its troubleshooting options name — which is exactly
 * how a machine ended up with THX in the mode effects, FluidEQ in the
 * endpoint effects and Equalizer APO in the old single values, all at once,
 * with no sound coming out and nothing on screen to say why. The rule is
 * "one engine in the chain", and a rule that only holds at the moment of the
 * switch is not a rule.
 *
 * Once a session, for the same reason the other two automatic repairs are:
 * it asks Windows for administrator rights, and the device list is re-read
 * on every output change and every return to the window — asking again on
 * every read would put that prompt back on screen forever. A refusal leaves Equalizer APO where it is, which is
 * where every version before this left it.
 */
export interface IApoGuardDeps {
  getEngine: () => TAudioEngine | null;
  runEngineSetup: (
    command: 'suspend-apo',
    args: string[],
  ) => Promise<{ ok: boolean; declined: boolean; error?: string }>;
  /**
   * The one gate every automatic elevated run passes through
   * (`automaticSetup.ts`): the engine switch runs the same switch-off, and
   * without a shared "once" the two put two prompts up for one action.
   */
  automatic: IAutomaticSetup;
}

export interface IApoGuard {
  /** Given the outputs just read, switch Equalizer APO off if it must. */
  check: (devices: readonly IAudioDevice[]) => Promise<void>;
}

export const createApoGuard = ({
  getEngine,
  runEngineSetup,
  automatic,
}: IApoGuardDeps): IApoGuard => ({
  check: async (devices) => {
    // Chosen is not enough: the engine has to actually be on an output.
    // A machine whose setup picked the FluidEQ Engine and then declined
    // the Windows prompt has the preference and no engine, and taking
    // Equalizer APO off such a machine leaves it with nothing processing
    // at all — worse than the state it was in.
    if (
      process.platform !== 'win32' ||
      getEngine() !== 'fluid' ||
      !automatic.wanted('suspend-apo') ||
      !devices.some((device) => device.isFluidEngineAttached === true) ||
      !devices.some((device) => device.isEqualizerApoAttached === true)
    ) {
      return;
    }
    try {
      // Restarted in the same elevated run: Windows reads an output's
      // effect list once and holds it, so without the restart the change
      // is on disk and not in the sound.
      const result = await automatic.attempt('suspend-apo', () =>
        runEngineSetup('suspend-apo', ['--restart-audio']),
      );
      if (result) {
        log.info(
          `Equalizer APO switched off so the FluidEQ Engine can run: ` +
            `ok=${result.ok}${result.declined ? ' (consent declined)' : ''}` +
            `${result.error ? ` error=${result.error}` : ''}`,
        );
      }
    } catch (error) {
      log.error('Equalizer APO could not be switched off', error);
    }
  },
});

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
