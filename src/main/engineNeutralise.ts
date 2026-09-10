/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * Sending the engine that is no longer in use to sleep.
 *
 * Equalizer APO and the FluidEQ Engine read the same `config.txt` ->
 * `fluideq.txt` -> per-device layout out of two different directories, and
 * both keep processing whatever they last read. So an engine the user has
 * switched away from does not stop: it goes on applying the chain FluidEQ
 * wrote into it, stacked underneath the new engine's copy of the same chain,
 * with no control anywhere in the app that reaches it. Every band applied
 * twice, every preamp applied twice.
 *
 * The cure is one write into the other engine's directory, at the moment of
 * the switch and never again: the same root file the disabled state produces
 * — two comment lines, no `Device:` block, no `Include:` — which is what
 * both engines read as "nothing to do"; plus, for the FluidEQ Engine, the
 * deletion of its DSP rack file, which no `Device:` guard covers.
 */

import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { IDeviceProfileSettings } from '../common/constants';
import { FLUID_ENGINE_DSP_FILENAME, TAudioEngine } from '../common/audioEngine';
import { flushDeviceProfiles, TPresetDirForDevice } from './deviceProfiles';
import { forgetPath, settlePath } from './asyncWriter';
import { getConfigPath, isEngineInstalled } from './registry';

/**
 * Delete the FluidEQ Engine's DSP rack file out of a directory.
 *
 * The neutral root above stops the EQ, but it cannot stop the rack: the
 * engine DLL reads `fluideq-dsp.txt` before the config tree and outside every
 * `Device:` guard (`resolve_chain` in `native/system-apo/src/config.cpp`), so
 * a root with no `Device:` block leaves the maximizer, the bass engine and
 * the linear-phase delay running on every output. The sweep in
 * `deviceProfiles.ts` does not reach it either — the rack file is not one of
 * the `fluideq-<id>-<feature>.txt` names that sweep matches. The DLL reads a
 * missing file as "no rack", so deleting it is the whole cure.
 *
 * `forgetPath` because the rack goes through the coalescing writer, which
 * would otherwise skip the next identical write against a file that is no
 * longer there.
 *
 * `settlePath` first: the rack also goes through the coalescing writer from
 * `SET_SYSTEM_DSP_CHAIN`, which returns before its write has reached disk. A
 * write still in flight at the moment of the delete would otherwise land
 * afterwards and resurrect the file the switch just removed, leaving the old
 * engine's rack running again with nothing in the app aware it came back.
 */
const removeDspRackFile = async (configDirPath: string): Promise<void> => {
  const rackPath = path.join(configDirPath, FLUID_ENGINE_DSP_FILENAME);
  try {
    await settlePath(rackPath);
    fs.rmSync(rackPath, { force: true });
    forgetPath(rackPath);
  } catch (error) {
    // A rack file we cannot delete is one that keeps processing: worth a line
    // in the log, but not a reason to abandon the rest of the switch.
    log.error(
      `Could not remove the FluidEQ Engine DSP rack file at ${rackPath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }
};

/**
 * Write the neutral root into `other`'s directory, only if `other` is
 * installed. Called at switch time only.
 *
 * The installation check comes first and is the whole reason this returns a
 * word rather than nothing: `getConfigPath('apo')` throws when Equalizer APO
 * is absent, and creates the engine's directory tree when it is asked for
 * `'fluid'`. Either would be wrong here — an engine that is not installed has
 * nothing to neutralise, and creating a config directory for one is how a
 * machine that never had the FluidEQ Engine ends up with its folder under
 * `%ProgramData%`.
 */
export const neutraliseEngine = async (
  other: TAudioEngine,
  settings: IDeviceProfileSettings,
  presetDirForDevice: TPresetDirForDevice,
): Promise<'written' | 'not-installed'> => {
  if (!(await isEngineInstalled(other))) {
    return 'not-installed';
  }

  const configDirPath = await getConfigPath(other);
  // `isEnabled: false` is what produces the neutral root, and no active
  // override goes with it: the session's live chain belongs to the engine
  // being switched TO. The flush also sweeps the device files this engine was
  // still including, so nothing is left for it to read.
  await flushDeviceProfiles(
    settings,
    presetDirForDevice,
    configDirPath,
    undefined,
    false,
    undefined,
  );
  // Only the FluidEQ Engine reads a rack file; Equalizer APO's directory
  // never has one, so there is nothing to delete when `other` is `'apo'`.
  if (other === 'fluid') {
    await removeDspRackFile(configDirPath);
  }
  return 'written';
};
