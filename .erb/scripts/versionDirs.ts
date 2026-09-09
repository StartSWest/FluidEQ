/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Picks the newest MSVC-style version directory out of a list of names.
 *
 * `readdirSync(...).sort()` is a lexicographic string sort, which is wrong
 * for version directories two different ways: `"14.9.1"` sorts after
 * `"14.10.2"` because `"9" > "1"` one character in, and a non-version name
 * such as `"v145"` sorts after every real `14.x.y` name and would be picked
 * first. Both Visual Studio's toolset (`VC\Tools\MSVC\<version>`) and
 * redistributable (`VC\Redist\MSVC\<version>`) directories are named this
 * way, so both pickers filter to genuine version strings and compare them
 * numerically, segment by segment, instead.
 */

const VERSION_PATTERN = /^\d+(\.\d+){1,3}$/;

/** -1, 0 or 1, comparing missing trailing segments as 0. */
const compareVersions = (a: string, b: string): number => {
  const partsA = a.split('.').map(Number);
  const partsB = b.split('.').map(Number);
  const length = Math.max(partsA.length, partsB.length);
  for (let index = 0; index < length; index += 1) {
    const segmentA = partsA[index] ?? 0;
    const segmentB = partsB[index] ?? 0;
    if (segmentA !== segmentB) {
      return segmentA < segmentB ? -1 : 1;
    }
  }
  return 0;
};

/**
 * The greatest name matching a dotted numeric version (`14.10.2`, one to
 * four segments), or undefined when none of `names` qualifies.
 */
export const newestVersionDir = (names: string[]): string | undefined =>
  names
    .filter((name) => VERSION_PATTERN.test(name))
    .reduce<string | undefined>(
      (newest, candidate) =>
        newest === undefined || compareVersions(candidate, newest) > 0
          ? candidate
          : newest,
      undefined,
    );
