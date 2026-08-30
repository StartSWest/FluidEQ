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

import manifest from '../../../../package.json';
import { GRAPH_STYLES } from '../../../common/graphStyles';
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

  it('names every graph form, including the newest one', () => {
    /*
     * THE KEY IS BUILT AT RUNTIME, which is why this test exists.
     *
     * The picker asks for `graph.styleName.${look.style}`, so a form added
     * without its name simply renders the key: the menu showed a row reading
     * "graph.styleName.fluid" between Canyon and Dot matrix, and nothing
     * failed anywhere. Not the type checker, because the key is a template
     * string; not the coverage test above, because coverage compares each
     * locale against English and English was missing it too.
     *
     * English alone is enough to assert here — a key present in English and
     * absent elsewhere is exactly what the coverage test already catches.
     */
    const named = Object.keys(en);
    GRAPH_STYLES.forEach((style) => {
      expect(named).toContain(`graph.styleName.${style}`);
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

  it('presents the internal euphoria feature as Rainbow mode', () => {
    expect(translate('en', 'support.game.euphoria')).toBe('Rainbow mode');
    expect(translate('es', 'support.game.euphoria')).toBe('Modo arcoíris');
    expect(translate('ja', 'support.game.euphoria')).toBe('レインボーモード');
  });

  it('leaves an unfilled placeholder visible rather than blanking it', () => {
    // `{layer}` on screen says a developer forgot something. An empty gap says
    // the app is broken.
    expect(translate('en', 'eq.layers.remove')).toContain('{layer}');
    expect(translate('en', 'eq.layers.remove', { other: 'x' })).toContain(
      '{layer}',
    );
  });

  it('offers the same languages in the installer as in the app', () => {
    // The installer picks its language before the app has ever run, so a
    // language missing here is one a user never sees offered — they are handed
    // English, decide the program is not for them, and never get as far as the
    // menu that would have told them otherwise. Hindi was absent for exactly
    // that reason: it was added to the app and nobody thought about the setup.
    //
    // Matched on the language part alone. The installer needs a region NSIS
    // knows (`pt_BR`, not `pt`) and the app deliberately does not have one, so
    // demanding the codes be equal would be demanding the wrong thing.
    const offered = manifest.build.nsis.installerLanguages.map(
      (code: string) => code.split('_')[0],
    );
    LOCALES.forEach(({ code, name }) => {
      expect(`${name} in the installer: ${offered.includes(code)}`).toBe(
        `${name} in the installer: true`,
      );
    });
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

  /**
   * A filled placeholder must leave no braces on screen.
   *
   * The test above compares the placeholder SETS between English and each
   * locale, which is why it never noticed that four Normalizer strings were
   * written `{{requested}}` in all ten languages at once. The substituter's
   * pattern is `/\{(\w+)\}/`, so the inner pair matched, the outer pair
   * survived, and the card read "{-1.2 dB} needed — limited by peak ceiling"
   * for the life of the feature. Identical everywhere is not the same as
   * correct, and only a check against the rendered output can tell them apart.
   */
  it('leaves no brace behind once a placeholder is filled', () => {
    const keys = Object.keys(en) as TranslationKey[];
    const filled = {
      count: '3',
      progress: '42',
      requested: '-1.2 dB',
      name: 'Example',
    };
    keys.forEach((key) => {
      LOCALES.forEach(({ code }) => {
        const rendered = translate(code, key, filled);
        // Only for strings whose every placeholder this test can supply;
        // anything else would fail on an unfilled name rather than on a
        // malformed one, which is the other test's job.
        const names = (en[key].match(/\{(\w+)\}/g) || []).map((token) =>
          token.slice(1, -1),
        );
        if (names.some((placeholder) => !(placeholder in filled))) {
          return;
        }
        expect(`${code}/${key}: ${rendered}`).toBe(
          `${code}/${key}: ${rendered.replace(/[{}]/g, '')}`,
        );
      });
    });
  });
});
