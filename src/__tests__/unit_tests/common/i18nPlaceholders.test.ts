/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A value in a string is written `{name}`, which is what the app fills in.
 * The Denoise graph's two readings were written `{{count}}` and `{{hz}}` in
 * all ten languages, so the picture printed the braces and the word instead
 * of the number (fixed 2026-09-22). Checked across every dictionary, so a
 * string in another syntax cannot come back unnoticed.
 */

import fs from 'fs';
import path from 'path';
import { translate } from '../../../common/i18n';

const DIR = path.join(__dirname, '..', '..', '..', 'common', 'i18n');

describe('placeholders in the translations', () => {
  it('are written the way the app fills them in, in every language', () => {
    const offenders: string[] = [];
    fs.readdirSync(DIR, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .forEach((locale) => {
        fs.readdirSync(path.join(DIR, locale.name))
          .filter((file) => file.endsWith('.ts'))
          .forEach((file) => {
            fs.readFileSync(path.join(DIR, locale.name, file), 'utf8')
              .split('\n')
              .forEach((line, index) => {
                if (/\{\{\s*\w+\s*\}\}/.test(line)) {
                  offenders.push(`${locale.name}/${file}:${index + 1}`);
                }
              });
          });
      });
    expect(offenders).toEqual([]);
  });

  // The control: the two strings that had it wrong come out filled in, in a
  // language that orders the words differently too.
  it('fills in the Denoise graph readings', () => {
    (['en', 'ja'] as const).forEach((locale) => {
      const clicks = translate(locale, 'dsp.denoise.graphClicksIn', {
        count: 3,
        seconds: 10,
      });
      expect(clicks).toContain('3');
      expect(clicks).toContain('10');
      expect(clicks).not.toContain('{');
      expect(translate(locale, 'dsp.denoise.graphHumAt', { hz: 50 })).toContain(
        '50',
      );
    });
  });
});
