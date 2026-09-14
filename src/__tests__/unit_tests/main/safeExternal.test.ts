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

const SUPPORT = 'support@fluideq.example';
const REPORT_LINK = `mailto:${SUPPORT}?subject=FluidEQ%20bug%20report&body=It%20crashed%20at%20C%3A%5CUsers%5C%3Cuser%3E`;

/**
 * The email route as a build with a support address has it, and the log that
 * copy writes to. The address is read when `common/bugReport` loads, so only a
 * copy loaded under it can see one.
 */
const withSupportAddress = () => {
  const before = process.env.FLUIDEQ_SUPPORT_EMAIL;
  process.env.FLUIDEQ_SUPPORT_EMAIL = SUPPORT;
  let loaded:
    | {
        route: typeof import('../../../main/safeExternal');
        log: typeof import('electron-log');
      }
    | undefined;
  jest.isolateModules(() => {
    loaded = {
      // eslint-disable-next-line global-require -- a copy loaded under the address above; see the comment on this helper
      route: require('../../../main/safeExternal'),
      // eslint-disable-next-line global-require -- the logger instance that copy was given
      log: require('electron-log'),
    };
  });
  if (before === undefined) {
    delete process.env.FLUIDEQ_SUPPORT_EMAIL;
  } else {
    process.env.FLUIDEQ_SUPPORT_EMAIL = before;
  }
  if (!loaded) {
    throw new Error('main/safeExternal did not load');
  }
  return loaded;
};

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
      // Not even to the support address: the report's email has a door of its
      // own, and this one stays shut to every link the window can show.
      REPORT_LINK,
      'not a url at all',
      '',
    ].forEach((url) => {
      expect(openExternalIfSafe(url)).toBe(false);
    });
    /* eslint-enable no-script-url */
    expect(openExternal).not.toHaveBeenCalled();
  });
});

/**
 * The report dialog's email, which the gate above drops. It used to go that way
 * and no mail app ever opened, while the dialog said one had.
 */
describe('handing the report email to the mail app', () => {
  beforeEach(() => {
    openExternal.mockReset();
    openExternal.mockResolvedValue(undefined);
  });

  it('opens a report addressed to this build, and says it did', async () => {
    const { route } = withSupportAddress();
    await expect(route.openSupportEmail(REPORT_LINK)).resolves.toBe(true);
    expect(openExternal).toHaveBeenCalledWith(REPORT_LINK);
  });

  it('refuses anything else without asking the operating system', async () => {
    const { route } = withSupportAddress();
    const refused = [
      'mailto:someone@else.example?subject=a&body=b',
      `${REPORT_LINK}&bcc=someone@else.example`,
      `https://attacker.example/?to=${SUPPORT}`,
      'ms-msdt:/id PCWDiagnostic',
      '',
    ];
    const answers = await Promise.all(
      refused.map((url) => route.openSupportEmail(url)),
    );
    expect(answers).toEqual(refused.map(() => false));
    expect(openExternal).not.toHaveBeenCalled();
  });

  it('says so when no mail app could open it, keeping the report out of the log', async () => {
    const { route, log } = withSupportAddress();
    const warn = jest.spyOn(log, 'warn').mockImplementation(() => undefined);
    openExternal.mockRejectedValueOnce(
      new Error('Failed to open: No application is associated'),
    );
    await expect(route.openSupportEmail(REPORT_LINK)).resolves.toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    const written = JSON.stringify(warn.mock.calls);
    expect(written).toContain('No application is associated');
    expect(written).not.toContain('mailto:');
    expect(written).not.toContain('crashed');
    warn.mockRestore();
  });
});
