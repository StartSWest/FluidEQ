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

/**
 * Reading the split config back, and working out which layer wrote what.
 *
 * The config has always been the thing that is actually true — it is what you
 * are hearing, while state.txt is only what FluidEQ last believed. What stopped
 * that rule being applied in full was that a config could not say where a line
 * came from. A voicing, a driver correction and a measured Smart EQ curve all
 * reached APO as ordinary `Filter N:` lines, indistinguishable from bands
 * somebody placed by hand, so reading them back would have turned every one of
 * them into bands: the pickers would read "none" while the sound was unchanged,
 * and the next edit would write the layers in again on top of their own
 * flattened copies. The only safe answer was to refuse to read anything at all
 * whenever a layer was live.
 *
 * A file per feature answers the question the text never could. `Include:
 * fluideq-<device>-eq.txt` says those lines are the user's bands and these
 * others are not, so the bands can be adopted and the layers left alone.
 *
 * Two shapes come back from here, and the difference matters:
 *
 *  - A config FluidEQ wrote, where `features` says which file held what. The
 *    layers are attributed and the old refusal does not apply.
 *  - Anything else — a flat config from an older FluidEQ, a hand-written one,
 *    one from another tool. `features` is absent, nothing is attributed, and
 *    the caller falls back to the cautious reading.
 */

import fs from 'fs';
import path from 'path';
import { findBlockForDevice, splitConfigBlocks } from '../common/apoSync';
import { APO_FEATURES, TApoFeature } from '../common/constants';
import { FLUIDEQ_CONFIG_FILENAME } from './flush';

const INCLUDE_LINE = /^\s*Include\s*:\s*(.+?)\s*$/i;
const DEVICE_FILE = /^fluideq-device-[0-9a-f]{12}\.txt$/i;
const FEATURE_FILE = new RegExp(
  `^fluideq-[0-9a-f]{12}-(${APO_FEATURES.join('|')})\\.txt$`,
  'i',
);

export interface IApoDeviceChain {
  /** The `Device:` argument of the block that governs this output. */
  devicePattern: string;
  /** Every line APO applies for it, with the includes followed. */
  text: string;
  /**
   * The lines the device file holds itself: the convolution and the preamp.
   *
   * Present only for a config FluidEQ wrote, which is the same condition as
   * `features` — both come from recognising the file names.
   */
  shared?: string;
  /**
   * The contents of each feature file the chain includes.
   *
   * A feature missing from here is one the config does not apply, which is a
   * statement in its own right: it is how a switched-off layer survives a
   * restart. Absent entirely when nothing said which lines came from where.
   */
  features?: Partial<Record<TApoFeature, string>>;
}

/**
 * Read a file an `Include:` named, if it is one we are willing to follow.
 *
 * Resolved against the config directory and refused if it lands outside, since
 * the name comes out of a file on disk that anything could have written.
 */
const readIncluded = (configDirPath: string, reference: string) => {
  const root = path.resolve(configDirPath);
  const target = path.resolve(root, reference);
  if (target !== root && !target.startsWith(root + path.sep)) {
    return undefined;
  }
  try {
    return fs.readFileSync(target, 'utf8');
  } catch {
    return undefined;
  }
};

/**
 * Splice every included file in where its `Include:` line stood.
 *
 * `seen` is a cycle guard, not an optimisation: two files including each other
 * is a config somebody can write by hand, and APO itself simply stops. An
 * include that cannot be read is left as the line it was — the chain is then
 * incomplete, which the caller notices as drift rather than as a crash.
 */
const expandIncludes = (
  configDirPath: string,
  text: string,
  seen: Set<string>,
  onInclude: (fileName: string, contents: string) => void,
): string =>
  text
    .split(/\r?\n/)
    .map((line) => {
      const include = line.split('#')[0].match(INCLUDE_LINE);
      if (!include) {
        return line;
      }
      const fileName = include[1];
      if (seen.has(fileName.toLowerCase())) {
        return '';
      }
      seen.add(fileName.toLowerCase());
      const contents = readIncluded(configDirPath, fileName);
      if (contents === undefined) {
        return line;
      }
      onInclude(fileName, contents);
      return expandIncludes(configDirPath, contents, seen, onInclude);
    })
    .join('\n');

/**
 * The chain Equalizer APO applies to one output, as it stands on disk.
 *
 * Undefined when there is no config to read or nothing in it names this
 * endpoint — both of which mean "nothing to adopt", not "the user cleared
 * everything".
 */
export const readApoDeviceChain = (
  configDirPath: string,
  devicePattern: string,
): IApoDeviceChain | undefined => {
  let root: string;
  try {
    root = fs.readFileSync(
      path.join(configDirPath, FLUIDEQ_CONFIG_FILENAME),
      'utf8',
    );
  } catch {
    return undefined;
  }

  const block = findBlockForDevice(splitConfigBlocks(root), devicePattern);
  if (!block) {
    return undefined;
  }

  const features: Partial<Record<TApoFeature, string>> = {};
  let shared: string | undefined;

  const text = expandIncludes(
    configDirPath,
    block.text,
    new Set<string>(),
    (fileName, contents) => {
      const feature = fileName.match(FEATURE_FILE)?.[1];
      if (feature) {
        features[feature.toLowerCase() as TApoFeature] = contents;
        return;
      }
      if (DEVICE_FILE.test(fileName)) {
        // What the device holds on its own behalf: the convolution before the
        // features and the preamp after them. Recognising this file is also
        // what says the config is one we wrote, so anything attributed below
        // can be trusted.
        shared = contents
          .split(/\r?\n/)
          .filter((line) => !INCLUDE_LINE.test(line.split('#')[0]))
          .join('\n');
      }
    },
  );

  return {
    devicePattern: block.devicePattern,
    text,
    ...(shared === undefined ? {} : { shared, features }),
  };
};
