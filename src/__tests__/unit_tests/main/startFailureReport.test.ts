/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { LOCALES, loadLocale, translate } from '../../../common/i18n';

jest.mock('electron', () => ({
  app: { getLocale: () => 'en', getPath: () => '' },
  BrowserWindow: jest.fn(),
  clipboard: { writeText: jest.fn() },
  shell: { openPath: jest.fn() },
}));
jest.mock('electron-log', () => ({
  __esModule: true,
  default: { warn: jest.fn(), error: jest.fn(), info: jest.fn() },
}));
jest.mock('../../../main/bugReportFacts', () => ({
  __esModule: true,
  default: jest.fn(),
}));
jest.mock('../../../main/bugReportMark', () => ({
  writeBugReportMark: jest.fn(),
}));
jest.mock('../../../main/safeExternal', () => ({
  __esModule: true,
  default: jest.fn(),
  openSupportEmail: jest.fn(),
}));

// eslint-disable-next-line import/first -- the mocks above stand in for Electron and the report's own IO
import {
  startReportAction,
  startReportPage,
} from '../../../main/startFailureReport';

const english = (key: Parameters<typeof translate>[1]) => translate('en', key);

describe('the report window', () => {
  it('answers its four links and nothing else', () => {
    expect(startReportAction('fluideq-start:send')).toBe('send');
    expect(startReportAction('fluideq-start://retry')).toBe('retry');
    expect(startReportAction('fluideq-start:logs')).toBe('logs');
    expect(startReportAction('fluideq-start:quit')).toBe('quit');
    expect(startReportAction('fluideq-start:format-disk')).toBeUndefined();
    expect(startReportAction('https://fluideq.com')).toBeUndefined();
  });

  it('shows the cause as text, never as markup', () => {
    const page = startReportPage(english, '<img src=x onerror=alert(1)> & "q"');
    expect(page).toContain(
      '&lt;img src=x onerror=alert(1)&gt; &amp; &quot;q&quot;',
    );
    expect(page).not.toContain('<img src=x');
    // No script of any kind, and a policy that would refuse one.
    expect(page).not.toMatch(/<script/i);
    expect(page).toContain("default-src 'none'");
  });

  it('offers Send report as the loud action and the rest as quiet ones', () => {
    const page = startReportPage(english, 'Error: x');
    expect(page).toContain(
      `<a class="primary" href="fluideq-start:send">${english('startFailure.send')}</a>`,
    );
    ['quit', 'logs', 'retry'].forEach((action) => {
      expect(page).toMatch(new RegExp(`<a href="fluideq-start:${action}">`));
    });
    expect(page).toContain(english('startFailure.title'));
  });

  it('says so when no cause was recorded (the control for the cause line)', () => {
    expect(startReportPage(english, '')).toContain(
      english('startFailure.unknown'),
    );
  });
});

describe('the report window in every language', () => {
  beforeAll(() =>
    Promise.all(LOCALES.map((locale) => loadLocale(locale.code))),
  );

  it.each(LOCALES.map((locale) => locale.code).filter((code) => code !== 'en'))(
    'is written in %s, not English filling in',
    (locale) => {
      (
        [
          'startFailure.title',
          'startFailure.lead',
          'startFailure.send',
          'startFailure.retry',
        ] as const
      ).forEach((key) => {
        expect(translate(locale, key)).not.toBe(english(key));
      });
    },
  );
});
