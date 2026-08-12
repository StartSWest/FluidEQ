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
  MAX_MAILTO_BODY,
  MAX_URL_BODY,
  buildMailtoUrl,
  REPORT_EMAIL,
  buildBugReport,
  buildIssueUrl,
  redact,
  takeLogTail,
} from 'common/bugReport';

describe('redacting a report', () => {
  it('takes the account name out of a Windows path', () => {
    expect(redact('at C:\\Users\\ivancarmenates\\AppData\\Roaming\\x')).toBe(
      'at C:\\Users\\<user>\\AppData\\Roaming\\x',
    );
  });

  it('handles the doubled backslashes a JSON log line leaves behind', () => {
    // Logs are frequently written through JSON.stringify somewhere upstream,
    // and a rule written only for single separators sails straight past it.
    expect(redact('"path":"C:\\\\Users\\\\ivan\\\\Desktop"')).toContain(
      '<user>',
    );
    expect(redact('"path":"C:\\\\Users\\\\ivan\\\\Desktop"')).not.toContain(
      'ivan\\',
    );
  });

  it('removes the name even where no path rule would find it', () => {
    // The case that makes this hard: a username is an ordinary word. It turns
    // up in preset names, in device names, in messages quoting a bare folder.
    expect(redact('Device: Ivan\\u2019s AirPods', 'Ivan')).toContain('<user>');
    expect(redact('preset "ivan mix" loaded', 'Ivan')).not.toMatch(/ivan/i);
  });

  it('takes out email addresses wherever they appear', () => {
    expect(redact('signed in as someone@example.com ok')).toBe(
      'signed in as <email> ok',
    );
  });

  it('takes out UNC paths, which carry a machine name', () => {
    expect(redact('reading \\\\LAPTOP-IVAN\\Music\\x.wav')).toContain(
      '\\\\<host>\\<share>',
    );
  });

  it('refuses to redact a name too short to be safe', () => {
    // Replacing every "an" in a log would destroy it and protect nobody, so
    // below three characters the rule stands down rather than shredding the
    // evidence.
    const line = 'a banana in Canada';
    expect(redact(line, 'an')).toBe(line);
  });

  it('is case-insensitive about the name', () => {
    expect(redact('C:\\games\\IVAN\\save', 'ivan')).not.toMatch(/ivan/i);
  });

  it('leaves the diagnosis intact', () => {
    // Redaction that also removes the useful part produces reports nobody can
    // act on, which is its own kind of failure.
    const line = 'Equalizer APO not found in the registry. Exit code: 740';
    expect(redact(line, 'ivan')).toBe(line);
  });
});

describe('taking the tail of a log', () => {
  const lines = Array.from({ length: 500 }, (_v, i) => `line ${i}`).join('\n');

  it('keeps the end, because that is where the fault is', () => {
    const tail = takeLogTail(lines, undefined, 10);
    expect(tail.split('\n')).toHaveLength(10);
    expect(tail).toContain('line 499');
    expect(tail).not.toContain('line 400');
  });

  it('redacts what it keeps', () => {
    expect(takeLogTail('C:\\Users\\ivan\\a.txt', 'ivan')).toContain('<user>');
  });

  it('drops blank lines rather than spending the budget on them', () => {
    expect(takeLogTail('a\n\n\n\nb', undefined, 10).split('\n')).toHaveLength(
      2,
    );
  });
});

describe('composing the report', () => {
  const facts = {
    appVersion: '0.8.2',
    platform: 'Windows 11 10.0.26200',
    arch: 'x64',
    electron: '43.2.0',
    isEqualizerApoInstalled: false,
    description: 'The graph stays blank.',
    appLog: 'something went wrong',
    installLog: 'Equalizer APO not found in the registry.',
  };

  it('leads with what the person said', () => {
    // Their words first. A report that opens with a version table reads as
    // telemetry rather than as somebody asking for help.
    const report = buildBugReport(facts);
    expect(report.indexOf('The graph stays blank.')).toBeLessThan(
      report.indexOf('0.8.2'),
    );
  });

  it('says plainly when Equalizer APO is missing', () => {
    // The single most common cause, and the one worth seeing at a glance.
    expect(buildBugReport(facts)).toContain('NOT installed');
  });

  it('says so rather than looking empty when nothing was written', () => {
    expect(buildBugReport({ ...facts, description: '' })).toContain(
      'no description given',
    );
  });

  it('leaves out a log section that has nothing in it', () => {
    const report = buildBugReport({ ...facts, installLog: '' });
    expect(report).not.toContain('### Setup log');
    expect(report).toContain('### Application log');
  });
});

describe('the issue link', () => {
  it('carries a short report in the URL', () => {
    const { url, needsPaste } = buildIssueUrl('short report');
    expect(needsPaste).toBe(false);
    expect(url).toContain('body=short%20report');
  });

  it('asks for a paste rather than truncating a long one', () => {
    // Half a log looks like a whole log to whoever reads it, and the missing
    // half is reliably the part that mattered.
    const { url, needsPaste } = buildIssueUrl('x'.repeat(MAX_URL_BODY + 1));
    expect(needsPaste).toBe(true);
    expect(url).not.toContain('body=');
  });

  it('points at this project', () => {
    expect(buildIssueUrl('x').url).toContain('StartSWest/FluidEQ/issues/new');
  });
});

describe('the email link', () => {
  it('is addressed wherever this build was told, with a useful subject', () => {
    // Not a literal address any more. It comes from the build, so asserting a
    // particular one here would only be asserting how this checkout happens to
    // be configured — and it used to pin a personal address into the tests of
    // a public repository.
    const { url } = buildMailtoUrl('a report', '0.8.2');
    expect(url.startsWith(`mailto:${REPORT_EMAIL}?`)).toBe(true);
    expect(url).toContain(encodeURIComponent('FluidEQ bug report (0.8.2)'));
  });

  it('puts the address straight after the scheme, or nothing at all', () => {
    // Unconditional, so it says the same thing whether or not this checkout has
    // an address configured. With none, the URL is `mailto:?…` — which is why
    // the dialog hides the button rather than opening an empty compose window
    // that looks like it worked.
    const { url } = buildMailtoUrl('a report');
    expect(url.slice('mailto:'.length, url.indexOf('?'))).toBe(REPORT_EMAIL);
  });

  it('carries a short report whole', () => {
    const { url, isTruncated } = buildMailtoUrl('short');
    expect(isTruncated).toBe(false);
    expect(url).toContain('body=short');
  });

  it('says where the rest went rather than silently cutting it', () => {
    // Windows hands the whole mailto to the registered handler as a command
    // line and truncates past roughly two thousand characters with no error at
    // all. A message that just stops mid-log looks like the whole report.
    const { url, isTruncated } = buildMailtoUrl(
      'x'.repeat(MAX_MAILTO_BODY + 1),
    );
    expect(isTruncated).toBe(true);
    expect(decodeURIComponent(url)).toContain('on your clipboard');
  });
});
