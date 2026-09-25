/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { checkConfigFile, updateConfig } from './flush';

export interface IConfigInclude {
  /** Make sure the folder's `config.txt` includes FluidEQ's root file. */
  ensure: (configPath: string) => void;
  /** Read it again on the next `ensure`: it changed, or the watch stopped. */
  forget: () => void;
}

/**
 * `config.txt` including FluidEQ's root, read once per watched folder.
 *
 * Every edit read `config.txt` from disk, synchronously, for a line that is
 * written once per install and almost never taken out again. Once confirmed
 * it is trusted while `isWatched` says the folder's watcher is running and
 * nothing has called `forget` — the watcher does, for any event naming
 * `config.txt` and for its own failure. A folder nobody is watching is read on
 * every edit, as every folder was.
 */
export const createConfigInclude = (
  isWatched: (configPath: string) => boolean,
): IConfigInclude => {
  let confirmedIn = '';
  return {
    ensure: (configPath) => {
      if (confirmedIn === configPath && isWatched(configPath)) {
        return;
      }
      confirmedIn = '';
      if (!checkConfigFile(configPath)) {
        updateConfig(configPath);
      }
      confirmedIn = configPath;
    },
    forget: () => {
      confirmedIn = '';
    },
  };
};
