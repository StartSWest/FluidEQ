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
 * both engines read as "nothing to do".
 */

import { IDeviceProfileSettings } from '../common/constants';
import { TAudioEngine } from '../common/audioEngine';
import { flushDeviceProfiles, TPresetDirForDevice } from './deviceProfiles';
import { getConfigPath, isEngineInstalled } from './registry';

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
  return 'written';
};
