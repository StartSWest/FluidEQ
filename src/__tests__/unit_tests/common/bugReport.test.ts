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
  isSupportMailto,
  redact,
  takeLogSince,
  takeLogTail,
} from 'common/bugReport';

const SUPPORT = 'support@fluideq.example';

/** The module as a build with a support address sees it. */
const withSupportAddress = (): typeof import('common/bugReport') => {
  const before = process.env.FLUIDEQ_SUPPORT_EMAIL;
  process.env.FLUIDEQ_SUPPORT_EMAIL = SUPPORT;
  let built: typeof import('common/bugReport') | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require -- the address is read when the module loads, so a copy loaded under this one is the only way to see it
    built = require('common/bugReport');
  });
  // Deleted rather than assigned when there was none: `process.env` turns an
  // assigned `undefined` into the string "undefined".
  if (before === undefined) {
    delete process.env.FLUIDEQ_SUPPORT_EMAIL;
  } else {
    process.env.FLUIDEQ_SUPPORT_EMAIL = before;
  }
  if (!built) {
    throw new Error('common/bugReport did not load');
  }
  return built;
};

describe('redacting a report', () => {
  it('takes the account name out of a Windows path', () => {
    expect(redact('at C:\\Users\\somebody\\AppData\\Roaming\\x')).toBe(
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

describe('taking everything since the previous report', () => {
  const appLines = [
    '[2026-09-15 07:00:00.000] [info]  engine: no output is going through it',
    '[2026-09-15 08:00:00.000] [error] Request failed on audio-engine: FAILURE',
    '  detail: the helper was missing',
    '[2026-09-15 09:00:00.000] [info]  FluidEQ Engine Setup (install) exited 0: ok=true',
  ].join('\n');

  it('keeps every entry from the mark on, continuation lines included', () => {
    // The mark is the previous report's gather moment, in UTC; the app log
    // is in local time with no zone, so the two are compared as instants.
    const since = new Date('2026-09-15T08:00:00.000').toISOString();
    const text = takeLogSince(appLines, since);
    expect(text).not.toContain('07:00:00');
    expect(text).toContain('08:00:00');
    expect(text).toContain('detail: the helper was missing');
    expect(text).toContain('09:00:00');
  });

  it('keeps everything when there has been no report yet', () => {
    expect(takeLogSince(appLines, undefined).split('\n')).toHaveLength(4);
  });

  it("reads the engine's and the helper's UTC lines by the same clock", () => {
    const engine = [
      '2026-09-15T05:00:00.000Z pid=1 {A} pass-through: FluidEQ is not running',
      '2026-09-15T10:00:00.000Z pid=1 {A} processing this endpoint',
    ].join('\n');
    const text = takeLogSince(engine, '2026-09-15T09:00:00.000Z');
    expect(text).not.toContain('05:00:00');
    expect(text).toContain('10:00:00');
  });

  it('caps at the newest lines and says how many older ones it left out', () => {
    const many = Array.from(
      { length: 6 },
      (_, at) => `[2026-09-15 0${at}:00:00.000] [info]  line ${at}`,
    ).join('\n');
    const text = takeLogSince(many, undefined, undefined, 4);
    expect(text).toContain('2 older line(s) not included');
    expect(text).not.toContain('line 1');
    expect(text).toContain('line 5');
  });

  it('redacts like the tail does', () => {
    const line = '[2026-09-15 09:00:00.000] [info]  C:\\Users\\ivan\\file.wav';
    expect(takeLogSince(line, undefined, 'ivan')).not.toContain('ivan');
  });
});

describe('composing the report', () => {
  const facts = {
    appVersion: '0.8.2',
    platform: 'Windows 11 10.0.26200',
    arch: 'x64',
    electron: '43.2.0',
    audioEngine: 'apo' as const,
    isEqualizerApoInstalled: false,
    fluidEngineInstalled: false,
    description: 'The graph stays blank.',
    appLog: 'something went wrong',
    installLog: 'Equalizer APO not found in the registry.',
    engineReport: 'Engine in use: fluid\nOutputs:\n- Speakers (playing now)',
    engineLog: 'pass-through: FluidEQ is not running',
    helperLog: '',
    gatheredAt: '2026-09-15T12:00:00.000Z',
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

  it('cuts a long report beside an emoji, never through it', () => {
    // Half an emoji is a lone surrogate, and `encodeURIComponent` throws on
    // one — the email would not open at all, for a report that only had the
    // bad luck of a smiley at character fifteen hundred.
    const report = `${'x'.repeat(MAX_MAILTO_BODY - 1)}😀 and the rest`;
    const { url } = buildMailtoUrl(report);
    expect(decodeURIComponent(url)).toContain(
      `${'x'.repeat(MAX_MAILTO_BODY - 1)}\n\n[...]`,
    );
  });
});

/**
 * The email route is the one way a `mailto:` reaches the operating system, so
 * what it accepts is the whole of what the window can open that way.
 */
describe('recognising the report email', () => {
  const link = `mailto:${SUPPORT}?subject=Bug%20report&body=It%20crashed`;

  it('accepts a link to the support address carrying a subject and a body', () => {
    expect(isSupportMailto(link, SUPPORT)).toBe(true);
    expect(isSupportMailto(`mailto:${SUPPORT}?body=x`, SUPPORT)).toBe(true);
  });

  it('accepts whatever the email button builds, however odd the report', () => {
    // The positive control for every refusal below: a validator that refused
    // everything would pass all of them. Quotes, ampersands, a `#`, a `?`,
    // line breaks, another script and a long report cut at an emoji all have
    // to survive, because a person's own words carry any of them.
    const { buildMailtoUrl: build, isSupportMailto: recognise } =
      withSupportAddress();
    [
      'short',
      `He said "it's broken" & left #1 ?\r\nC:\\Users\\<user>\\x 100%`,
      'ध्वनि बंद हो गई — 音が出ない — звук пропал',
      `${'x'.repeat(MAX_MAILTO_BODY - 1)}😀${'y'.repeat(4000)}`,
    ].forEach((report) => {
      const { url } = build(report, '1.2.3');
      expect(url.startsWith(`mailto:${SUPPORT}?`)).toBe(true);
      expect(recognise(url)).toBe(true);
    });
  });

  it('refuses a link to any other address', () => {
    [
      'mailto:someone@else.example?subject=a&body=b',
      // The support address as the start of a longer one.
      `mailto:${SUPPORT}.attacker.example?subject=a&body=b`,
      `mailto:${SUPPORT},someone@else.example?subject=a&body=b`,
      `mailto:${SUPPORT}%2Csomeone@else.example?subject=a&body=b`,
      `mailto:SUPPORT@FLUIDEQ.EXAMPLE?subject=a&body=b`,
    ].forEach((url) => expect(isSupportMailto(url, SUPPORT)).toBe(false));
  });

  it('refuses a recipient added in the query', () => {
    ['to', 'cc', 'bcc'].forEach((field) => {
      expect(
        isSupportMailto(`${link}&${field}=someone@else.example`, SUPPORT),
      ).toBe(false);
    });
    expect(isSupportMailto(`${link}&attach=C:/secrets.txt`, SUPPORT)).toBe(
      false,
    );
    expect(isSupportMailto(`${link}&body=again`, SUPPORT)).toBe(false);
  });

  it('refuses every other scheme, and anything the builder never writes', () => {
    /* eslint-disable no-script-url -- the hostile input is the subject here */
    [
      `javascript:alert(1)//mailto:${SUPPORT}?body=x`,
      `file:///C:/Windows/System32/cmd.exe?mailto:${SUPPORT}`,
      `ms-settings:mailto:${SUPPORT}?body=x`,
      `https://attacker.example/mailto:${SUPPORT}?body=x`,
      `MAILTO:${SUPPORT}?body=x`,
      ` mailto:${SUPPORT}?body=x`,
      `mailto:${SUPPORT}`,
      `mailto:${SUPPORT}?`,
      `mailto:${SUPPORT}?body=a b`,
      `mailto:${SUPPORT}?body="%20--flag`,
      `mailto:${SUPPORT}?body=x#fragment`,
      `mailto:${SUPPORT}?body=x?to=someone@else.example`,
      `mailto:${SUPPORT}?body=%zz`,
      `mailto:${SUPPORT}?body=%E0%A4`,
      '',
    ].forEach((url) => expect(isSupportMailto(url, SUPPORT)).toBe(false));
    /* eslint-enable no-script-url */
  });

  it('refuses everything when the build has no support address', () => {
    expect(isSupportMailto('mailto:?subject=a&body=b', '')).toBe(false);
    expect(isSupportMailto(link, '')).toBe(false);
  });
});
