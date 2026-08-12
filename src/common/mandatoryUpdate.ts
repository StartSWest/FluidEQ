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
 * "This release fixes something that must not keep running."
 *
 * A release can be marked so that copies already installed stop being usable
 * until they have taken it. That is a heavy thing to be able to say, so the
 * whole of this module is written around one rule: **fail open**.
 *
 * ## Where the flag rides
 *
 * In `latest.yml`, the file electron-updater already fetches on every check.
 * Nothing else would do: a second file means a second request that can 404, a
 * second thing to forget at release time, and a second way for a copy of the
 * app to end up blocked because a server had a bad minute.
 *
 * electron-builder writes `latest.yml` by spreading the build config's
 * `releaseInfo` verbatim into the update metadata, and electron-updater parses
 * that file with `yaml.load` and hands the whole object to `update-available`
 * untouched. So any key placed under `releaseInfo` arrives intact at the event.
 *
 * `vendor` is the key used, and specifically not `releaseName` or
 * `releaseNotes`. Those two reach `latest.yml` as well, but electron-updater's
 * GitHub provider *fills them in from the GitHub release itself* when the file
 * leaves them empty — the release title becomes `releaseName`, the release body
 * becomes `releaseNotes`. Carrying the signal in either would mean that prose
 * typed into a GitHub release form was one unlucky sentence away from blocking
 * every installation. `vendor` exists in electron-builder's own `ReleaseInfo`
 * type for exactly this purpose and no code in the updater ever writes to it.
 *
 * ## Why the value is that particular string
 *
 * The flag is set through an argv override at build time, and argv parsers
 * coerce: `true` may arrive as a boolean, `1` as a number, and which one you
 * get depends on the parser's options rather than on anything visible at the
 * call site. `required` is a word. No parser turns it into anything else, and
 * an exact string comparison against it cannot be accidentally satisfied by a
 * truthy value that arrived by another route.
 *
 * ## Fail open
 *
 * `isMandatoryUpdate` returns `true` for exactly one input shape and `false`
 * for every other thing in the universe, including the ones that look like
 * mistakes. Absent, `null`, an empty object, a string where an object was
 * expected, an array, a getter that throws — all of them mean "not mandatory",
 * because the cost of being wrong in that direction is that an urgent update
 * gets installed a day late, and the cost of being wrong in the other
 * direction is somebody's audio software refusing to open.
 */

/** The key inside `releaseInfo.vendor`, and so inside `latest.yml`'s `vendor`. */
export const MANDATORY_UPDATE_FIELD = 'fluidEqMandatoryUpdate';

/**
 * The only value that means anything.
 *
 * A word rather than `true` or `1` so that no argv or YAML coercion can
 * produce it by accident, and so that reading `latest.yml` tells a human what
 * the line is for.
 */
export const MANDATORY_UPDATE_VALUE = 'required';

/**
 * Whether this update is one the app must not keep running without.
 *
 * Given whatever `update-available` handed over — which is typed as
 * `UpdateInfo` but is in practice whatever was in a YAML file on the internet.
 * Treated as `unknown` for that reason.
 *
 * Returns `true` only for `{ vendor: { fluidEqMandatoryUpdate: 'required' } }`,
 * matched by identity on the string. Everything else is `false`, and so is
 * anything that throws on the way.
 */
export const isMandatoryUpdate = (info: unknown): boolean => {
  try {
    if (typeof info !== 'object' || info === null || Array.isArray(info)) {
      return false;
    }
    const { vendor } = info as { vendor?: unknown };
    if (
      typeof vendor !== 'object' ||
      vendor === null ||
      Array.isArray(vendor)
    ) {
      return false;
    }
    // `in` rather than a bare read, so a key inherited from a prototype that
    // somebody put on the parsed object cannot answer for one that is not
    // actually in the file.
    if (!Object.prototype.hasOwnProperty.call(vendor, MANDATORY_UPDATE_FIELD)) {
      return false;
    }
    const flag = (vendor as Record<string, unknown>)[MANDATORY_UPDATE_FIELD];
    return flag === MANDATORY_UPDATE_VALUE;
  } catch {
    // A property access on a parsed document should not be able to throw, and
    // if it does, that is emphatically not a reason to block anybody.
    return false;
  }
};
