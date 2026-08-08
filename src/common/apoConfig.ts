/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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
 * The shape of the Equalizer APO config, as a tree rather than as text.
 *
 * In common/ because it crosses the bridge: the main process reads it off disk
 * and the window draws it. Only the shapes live here — reading them requires a
 * filesystem, so that stays in main/apoConfigReader.
 */

/** One file in the config, and the files it pulls in. */
export interface IApoConfigFile {
  fileName: string;
  /** What this file says on its own behalf, with the Include lines taken out. */
  lines: string[];
  /** The files it includes, in the order APO reads them. */
  includes: IApoConfigFile[];
  /** Named by an Include that pointed at nothing we could read. */
  isMissing?: boolean;
}

/**
 * One layer of an output's chain, and whether it is reaching Equalizer APO.
 *
 * The one thing on this panel that does not come from the files, and it cannot:
 * a switched-off layer has no file, so the config has nothing to say about the
 * difference between an output with no voicing and an output whose voicing is
 * switched off. Absence is absence. Answering that needs the profile beside the
 * config, which is why this is filled in where both are to hand rather than by
 * the reader.
 */
export interface IApoConfigLayer {
  /** `driver`, `eq`, `voicing`, `smart`, or `convolution`. */
  feature: string;
  /** False when the profile has this layer and the config leaves it out. */
  isApplied: boolean;
}

/** One output's whole chain, as the files that make it. */
export interface IApoConfigDevice {
  /** The `Device:` argument — a GUID, a name, or `all`. */
  devicePattern: string;
  /** The comment above it, which is how FluidEQ records what it is for. */
  label?: string;
  /** The device file and everything under it, when the block includes one. */
  file?: IApoConfigFile;
  /** How many `Filter:` lines the whole chain applies. */
  filterCount: number;
  /** The `Preamp:` line, which lives with the device rather than a feature. */
  preAmp?: string;
  /** The impulse response, if this output has one applied. */
  convolution?: string;
  /**
   * Every layer this output's profile carries, applied or switched off.
   *
   * Absent for a block with no profile behind it — the neutral fallback, or an
   * output whose profile has gone missing.
   */
  layers?: IApoConfigLayer[];
}

/**
 * The config as a shape rather than as text.
 *
 * For showing somebody what is actually being applied and where it comes from.
 * The split made a chain into a dozen files, which is a much better thing to
 * write and a much worse thing to read: the answer to "why does this output
 * sound like this" now lives in five places. This puts the tree back together
 * without flattening it, so the structure is still visible.
 *
 * Deliberately read from disk rather than rebuilt from the profiles. What the
 * app would write is already visible everywhere else in the interface; the
 * question this answers is what Equalizer APO has actually got, which is a
 * different question exactly when it matters — after a hand edit, another tool,
 * a failed write, a restore from backup.
 */
export interface IApoConfigTree {
  /** The config directory these files were read from. */
  configDirPath: string;
  /** fluideq.txt, and the tree hanging off it. */
  root: IApoConfigFile;
  /** One entry per `Device:` block, in the order the config lists them. */
  devices: IApoConfigDevice[];
  /**
   * Whether Equalizer APO is being told to do anything at all.
   *
   * Two quite different situations end in silence and they are worth telling
   * apart. The engine switched off makes FluidEQ write a config with no
   * `Device:` block in it, deliberately — that is the switch working. A config
   * that has blocks but no filters is a chain that happens to be flat.
   *
   * Derived from whether anything names an output rather than from the state,
   * because the point of this whole view is to report the file rather than the
   * app's belief about it. `config.txt` not including fluideq.txt at all is the
   * third case, and it is the one that means somebody else has been editing.
   */
  isApplied: boolean;
  /** Whether APO's own config.txt still includes fluideq.txt. */
  isIncludedByApo: boolean;
}
