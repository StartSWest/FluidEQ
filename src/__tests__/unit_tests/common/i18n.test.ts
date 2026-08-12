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

import en, { TranslationKey } from '../../../common/i18n/en';
import {
  DEFAULT_LOCALE,
  getCoverage,
  LOCALES,
  resolveLocale,
  translate,
} from '../../../common/i18n';

describe('i18n', () => {
  it('ships every locale fully translated', () => {
    // Not a style preference: an English line in the middle of a Japanese
    // panel is the sort of thing nobody reports and everybody notices. The
    // fallback exists so a NEW key does not break the app, not so that
    // dictionaries can be left half-done.
    LOCALES.forEach(({ code, name }) => {
      expect(`${name}: ${getCoverage(code)}`).toBe(`${name}: 1`);
    });
  });

  it('names each language in its own language', () => {
    // A user hunting for their language scans for the word they know, which
    // is never the English one.
    const names = LOCALES.map((locale) => locale.name);
    expect(new Set(names).size).toBe(LOCALES.length);
    expect(names).toContain('Deutsch');
    expect(names).toContain('日本語');
  });

  it('matches a platform tag on its primary subtag', () => {
    expect(resolveLocale('pt-BR')).toBe('pt');
    expect(resolveLocale('zh-Hans-CN')).toBe('zh');
    expect(resolveLocale('es_419')).toBe('es');
    expect(resolveLocale('EN-GB')).toBe('en');
  });

  it('falls back to English for anything it does not ship', () => {
    expect(resolveLocale('sv-SE')).toBe(DEFAULT_LOCALE);
    expect(resolveLocale(undefined)).toBe(DEFAULT_LOCALE);
    expect(resolveLocale('')).toBe(DEFAULT_LOCALE);
  });

  it('substitutes placeholders by name', () => {
    expect(translate('en', 'eq.layers.remove', { layer: 'Convolution' })).toBe(
      'Remove the Convolution layer',
    );
  });

  it('leaves an unfilled placeholder visible rather than blanking it', () => {
    // `{layer}` on screen says a developer forgot something. An empty gap says
    // the app is broken.
    expect(translate('en', 'eq.layers.remove')).toContain('{layer}');
    expect(translate('en', 'eq.layers.remove', { other: 'x' })).toContain(
      '{layer}',
    );
  });

  it('keeps every placeholder a translation was given', () => {
    // A translator dropping {count} would produce a sentence that silently
    // omits the number it exists to report.
    const keys = Object.keys(en) as TranslationKey[];
    keys.forEach((key) => {
      const expected = (en[key].match(/\{\w+\}/g) || []).sort();
      if (expected.length === 0) {
        return;
      }
      LOCALES.forEach(({ code }) => {
        const actual = (translate(code, key).match(/\{\w+\}/g) || []).sort();
        expect(`${code}/${key}: ${actual.join()}`).toBe(
          `${code}/${key}: ${expected.join()}`,
        );
      });
    });
  });
});
