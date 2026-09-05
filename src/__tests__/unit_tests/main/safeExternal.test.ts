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

const openExternal = jest.fn().mockResolvedValue(undefined);

jest.mock('electron', () => ({ shell: { openExternal } }));

// eslint-disable-next-line import/first
import openExternalIfSafe from '../../../main/safeExternal';

/**
 * `shell.openExternal` does not open a web page. It asks Windows to do whatever
 * it is configured to do with the string, which for `file:` is Explorer and for
 * a registered custom protocol is somebody else's application, started with an
 * argument this app chose.
 */
describe('handing a URL to the operating system', () => {
  beforeEach(() => openExternal.mockClear());

  it('opens ordinary web addresses', () => {
    expect(openExternalIfSafe('https://fluideq.example/docs')).toBe(true);
    expect(openExternalIfSafe('http://fluideq.example')).toBe(true);
    expect(openExternal).toHaveBeenCalledTimes(2);
  });

  it('refuses every scheme that is not the web', () => {
    // `file:` is the obvious one. The rest are why a scheme allowlist beats a
    // `file:` denylist: each is a protocol some installed application may have
    // registered, and none of them belongs to a link in a lyric sheet.
    /* eslint-disable no-script-url -- the hostile input is the subject here */
    [
      'file:///C:/Windows/System32/cmd.exe',
      'ms-msdt:/id PCWDiagnostic',
      'search-ms:query=passwords',
      'javascript:alert(1)',
      'data:text/html,<script>alert(1)</script>',
      'vbscript:msgbox',
      'steam://run/1',
      '\\\\attacker\\share\\payload.exe',
      'not a url at all',
      '',
    ].forEach((url) => {
      expect(openExternalIfSafe(url)).toBe(false);
    });
    /* eslint-enable no-script-url */
    expect(openExternal).not.toHaveBeenCalled();
  });
});
