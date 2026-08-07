/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { DefineStepFunction } from 'jest-cucumber';
import { checkConfigFile, updateConfig } from 'main/flush';
import { getConfigPath, isEqualizerAPOInstalled } from 'main/registry';

export const givenEqualizerApoIsInstalled = (given: DefineStepFunction) => {
  given('EqualizerAPO is installed', async () => {
    if (!(await isEqualizerAPOInstalled())) {
      throw new Error('EqualizerAPO not installed');
    }
    // TODO find a way to install EqualizerAPO
  });
};

/**
 * Checked by writing the one line FluidEQ owns, not by flattening the config.
 *
 * This used to write a disabled state through the old single-file writer, which
 * meant the check for "can we write here" emptied fluideq.txt as a side effect.
 * Harmless when that file was the whole config and destructive once it became
 * the root of an include tree: it would take out every Device line and leave
 * the per-device files orphaned until the next flush.
 *
 * `updateConfig` writes the Include into APO's own config.txt and preserves
 * everything already in it, so this proves the directory is writable without
 * damaging what somebody is listening to.
 */
export const givenCanWriteToFluidEqConfig = (given: DefineStepFunction) => {
  given('FluidEQ can write to its config', async () => {
    const configDirPath = await getConfigPath();
    updateConfig(configDirPath);
    if (!checkConfigFile(configDirPath)) {
      throw new Error('FluidEQ could not write to the Equalizer APO config');
    }
  });
};
