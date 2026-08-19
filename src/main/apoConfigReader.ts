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
import {
  APO_FEATURES,
  FILTER_LINE_PREFIX_REGEX,
  TApoFeature,
} from '../common/constants';
import {
  IApoConfigDevice,
  IApoConfigFile,
  IApoConfigTree,
} from '../common/apoConfig';
import { checkConfigFile, FLUIDEQ_CONFIG_FILENAME } from './flush';

const INCLUDE_LINE = /^\s*Include\s*:\s*(.+?)\s*$/i;
const DEVICE_FILE = /^fluideq-device-[0-9a-f]{12}\.txt$/i;
const CUSTOM_FILE = /^fluideq-[0-9a-f]{12}-custom\.txt$/i;
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
  /** The user-owned custom file, when the device chain includes it. */
  custom?: { fileName: string; contents: string };
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
  let custom: { fileName: string; contents: string } | undefined;

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
        return;
      }
      if (CUSTOM_FILE.test(fileName)) {
        custom = { fileName, contents };
      }
    },
  );

  return {
    devicePattern: block.devicePattern,
    text,
    ...(shared === undefined ? {} : { shared, features }),
    ...(custom ? { custom } : {}),
  };
};

/**
 * One file and everything it includes, read as a tree.
 *
 * `seen` is per branch rather than per read, so a file legitimately included by
 * two different devices is expanded under each of them. Only a file that
 * includes itself, directly or through a ring, is cut — and it is marked rather
 * than dropped, because a config that loops is something somebody wants to be
 * told about, not something to render as though it were fine.
 */
const readConfigFile = (
  configDirPath: string,
  fileName: string,
  seen: ReadonlySet<string>,
): IApoConfigFile => {
  const contents = readIncluded(configDirPath, fileName);
  if (contents === undefined || seen.has(fileName.toLowerCase())) {
    return { fileName, lines: [], includes: [], isMissing: true };
  }

  const branch = new Set(seen).add(fileName.toLowerCase());
  const lines: string[] = [];
  const includes: IApoConfigFile[] = [];

  contents.split(/\r?\n/).forEach((line) => {
    const include = line.split('#')[0].match(INCLUDE_LINE);
    if (include) {
      includes.push(readConfigFile(configDirPath, include[1], branch));
      return;
    }
    if (line.trim()) {
      lines.push(line.trim());
    }
  });

  return { fileName, lines, includes };
};

/** Every `Filter:` line in a file and everything under it. */
const countFilters = (file: IApoConfigFile): number =>
  file.lines.filter((line) => FILTER_LINE_PREFIX_REGEX.test(line)).length +
  file.includes.reduce((total, child) => total + countFilters(child), 0);

/** The first line of a file matching a command, searched depth-first. */
const findLine = (file: IApoConfigFile, command: RegExp): string | undefined =>
  file.lines.find((line) => command.test(line)) ??
  file.includes.reduce<string | undefined>(
    (found, child) => found ?? findLine(child, command),
    undefined,
  );

/**
 * The whole config, per device, as it stands on disk.
 *
 * Undefined only when there is no fluideq.txt at all — an APO install FluidEQ
 * has never written to, which is a different thing from an empty one and worth
 * saying differently.
 */
export const readApoConfigTree = (
  configDirPath: string,
): IApoConfigTree | undefined => {
  let rootText: string;
  try {
    rootText = fs.readFileSync(
      path.join(configDirPath, FLUIDEQ_CONFIG_FILENAME),
      'utf8',
    );
  } catch {
    return undefined;
  }

  // Walked line by line rather than through splitConfigBlocks, because the one
  // thing that names a block is the comment FluidEQ writes *above* its Device
  // line — and a block, by APO's own grammar, starts at the Device line. Split
  // into blocks and every label lands on the device before the one it describes.
  const devices: IApoConfigDevice[] = [];
  let pendingLabel: string | undefined;

  rootText.split(/\r?\n/).forEach((rawLine) => {
    const comment = rawLine.match(/^\s*#\s*(.+?)\s*$/)?.[1];
    if (comment) {
      // The banner at the top of the file names no device.
      pendingLabel = /^Generated by FluidEQ/i.test(comment)
        ? undefined
        : comment;
      return;
    }

    const line = rawLine.split('#')[0].trim();
    const device = line.match(/^Device\s*:\s*(.+?)\s*$/i);
    if (device) {
      devices.push({
        devicePattern: device[1],
        ...(pendingLabel ? { label: pendingLabel } : {}),
        filterCount: 0,
      });
      pendingLabel = undefined;
      return;
    }

    const include = line.match(INCLUDE_LINE)?.[1];
    const current = devices[devices.length - 1];
    if (!include || !current || current.file) {
      return;
    }
    const file = readConfigFile(configDirPath, include, new Set());
    current.file = file;
    current.filterCount = countFilters(file);
    current.preAmp = findLine(file, /^Preamp\s*:/i);
    current.convolution = findLine(file, /^Convolution\s*:/i);
  });

  return {
    configDirPath,
    root: readConfigFile(configDirPath, FLUIDEQ_CONFIG_FILENAME, new Set()),
    devices,
    // Nothing names an output, so nothing is being asked of APO. That is what
    // the engine switch writes, and it is a different silence from a chain
    // that happens to be flat.
    isApplied: devices.length > 0,
    // And the whole tree is inert regardless if APO is not reading it. Checked
    // rather than assumed: config.txt belongs to Equalizer APO and anything can
    // have rewritten it since FluidEQ last looked.
    isIncludedByApo: (() => {
      try {
        return checkConfigFile(configDirPath);
      } catch {
        return false;
      }
    })(),
  };
};

export type { IApoConfigDevice, IApoConfigFile, IApoConfigTree };
