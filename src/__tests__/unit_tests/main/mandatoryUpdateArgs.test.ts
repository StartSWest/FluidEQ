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

import {
  MANDATORY_UPDATE_ENV,
  readMandatoryUpdateArgs,
} from '../../../../.erb/scripts/mandatory-update';
import { isMandatoryUpdate } from '../../../common/mandatoryUpdate';

/**
 * The build half of the mechanism, and that it agrees with the app half.
 *
 * The two are joined by a string in a YAML file and by nothing a compiler can
 * see, so the last test here walks the whole path: environment variable, to
 * builder argument, to the object electron-builder would have written into
 * `latest.yml`, to the check that decides whether to block an app.
 */
describe('marking a release mandatory at build time', () => {
  it('adds nothing when the variable is not set — every ordinary build', () => {
    expect(readMandatoryUpdateArgs({})).toEqual([]);
  });

  it('adds nothing for an empty or blank value', () => {
    expect(readMandatoryUpdateArgs({ [MANDATORY_UPDATE_ENV]: '' })).toEqual([]);
    expect(readMandatoryUpdateArgs({ [MANDATORY_UPDATE_ENV]: '   ' })).toEqual(
      [],
    );
  });

  it('writes the flag into the release info when it is set', () => {
    expect(
      readMandatoryUpdateArgs({ [MANDATORY_UPDATE_ENV]: 'required' }),
    ).toEqual(['--config.releaseInfo.vendor.fluidEqMandatoryUpdate=required']);
  });

  it('forgives the whitespace a shell leaves behind', () => {
    expect(
      readMandatoryUpdateArgs({ [MANDATORY_UPDATE_ENV]: ' required\n' }),
    ).toEqual(['--config.releaseInfo.vendor.fluidEqMandatoryUpdate=required']);
  });

  it.each(['true', '1', 'yes', 'Required', 'mandatory'])(
    'refuses to build when it is set to %s',
    (value) => {
      // Loudly, and not by quietly producing an unmarked release. Somebody who
      // set this believes the release is marked; the only moment they can find
      // out otherwise is before it ships.
      expect(() =>
        readMandatoryUpdateArgs({ [MANDATORY_UPDATE_ENV]: value }),
      ).toThrow(/only value/i);
    },
  );

  it('produces something the app then recognises', () => {
    const [arg] = readMandatoryUpdateArgs({
      [MANDATORY_UPDATE_ENV]: 'required',
    });
    // The path an argv parser takes: strip the `--config.` prefix, split the
    // dotted key into nested objects, and put the value at the bottom.
    const [key, value] = arg.replace('--config.', '').split('=');
    const config = key
      .split('.')
      .reverse()
      .reduce<unknown>(
        (inner, segment) => ({ [segment]: inner }),
        value as unknown,
      ) as { releaseInfo: Record<string, unknown> };

    // electron-builder spreads `releaseInfo` verbatim into the update metadata
    // it serialises as latest.yml, which is what reaches `update-available`.
    expect(isMandatoryUpdate({ version: '1.3.0', ...config.releaseInfo })).toBe(
      true,
    );
  });

  it('leaves an ordinary build looking exactly as it always did', () => {
    const args = readMandatoryUpdateArgs({});
    expect(args).toEqual([]);
    // No releaseInfo, so no vendor key, so nothing in latest.yml, so no
    // installation anywhere sees anything new.
    expect(isMandatoryUpdate({ version: '1.3.0' })).toBe(false);
  });
});
