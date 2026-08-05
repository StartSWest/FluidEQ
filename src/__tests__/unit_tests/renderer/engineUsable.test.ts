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

import { ErrorCode, errors, isBlockingError } from 'common/errors';

/**
 * The rule the panels apply: usable only when the equaliser is switched on AND
 * nothing is blocking. Written out here rather than imported, because the
 * value itself is assembled inside a React provider — what is worth pinning is
 * the rule, and that a missing Equalizer APO satisfies the blocking half of
 * it.
 */
const isEngineUsable = (isEnabled: boolean, error?: { code: ErrorCode }) =>
  isEnabled && !isBlockingError(error as never);

describe('whether the equaliser can do anything', () => {
  it('is unusable without Equalizer APO, however the switch is set', () => {
    // The app is still worth looking at without APO — the window opens, the
    // meter runs, the graph draws. What must not happen is a live-looking
    // slider over an engine that is not installed.
    const missing = errors[ErrorCode.EQUALIZER_APO_NOT_INSTALLED];
    expect(isEngineUsable(true, missing)).toBe(false);
    expect(isEngineUsable(false, missing)).toBe(false);
  });

  it('is unusable when APO is installed but its config cannot be found', () => {
    expect(isEngineUsable(true, errors[ErrorCode.CONFIG_NOT_FOUND])).toBe(
      false,
    );
  });

  it('is usable when the engine is on and nothing is blocking', () => {
    expect(isEngineUsable(true, undefined)).toBe(true);
  });

  it('is unusable when the user has simply switched it off', () => {
    expect(isEngineUsable(false, undefined)).toBe(false);
  });

  it('stays usable through a failure that is only a message', () => {
    // A preset that would not save is not a reason to grey out the equalizer
    // while APO is still processing audio perfectly well.
    expect(isEngineUsable(true, errors[ErrorCode.TIMEOUT])).toBe(true);
  });

  it('counts a missing Equalizer APO as blocking in the first place', () => {
    // The whole chain rests on this membership. If APO-not-installed ever
    // stopped being a blocking code, the panels would silently come back to
    // life over nothing.
    expect(isBlockingError(errors[ErrorCode.EQUALIZER_APO_NOT_INSTALLED])).toBe(
      true,
    );
  });
});
