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
  DISCLAIMER_LANGUAGE_KEY,
  DISCLAIMER_PARAGRAPH_KEYS,
  DISCLAIMER_VERSION,
  buildAcceptance,
  readAcceptance,
} from 'common/disclaimer';
import { AUTHOR_NAME } from 'common/branding';
import en from 'common/i18n/en';
import { LocaleCode, LOCALES, translate } from 'common/i18n';

/** The whole notice as one string, the way a reader meets it. */
const read = (locale: LocaleCode) =>
  [...DISCLAIMER_PARAGRAPH_KEYS, DISCLAIMER_LANGUAGE_KEY]
    .map((key) => translate(locale, key, { author: AUTHOR_NAME }))
    .join(' ');

describe('the disclaimer text in English', () => {
  const text = read('en');

  it('says the three things sections 15 and 16 say', () => {
    expect(text).toContain('as is');
    expect(text).toContain('no warranty');
    expect(text).toContain(`${AUTHOR_NAME} is not liable`);
  });

  it('names what it is disclaiming liability for', () => {
    // Vagueness is the failure mode of a disclaimer that nobody wrote out. The
    // three named here are the ones this program can plausibly reach.
    expect(text).toContain('hearing');
    expect(text).toContain('equipment');
    expect(text).toContain('data');
  });

  it('says that using it is the acceptance', () => {
    expect(text).toContain('you accept');
  });

  it('names itself as the original', () => {
    expect(text).toContain('written in English');
    expect(text).toContain('the English text is the one that applies');
  });

  it('does not overstate what it achieves', () => {
    // Consumer law in a number of countries limits what a seller may disclaim
    // however the text is worded. A notice that implies otherwise invites
    // somebody to believe they have given up a right they still have, and it
    // is the one way this feature could do actual harm.
    //
    // The blocklist is English-only, and deliberately. See the suite below for
    // why a per-language version of it would be theatre rather than a check.
    expect(text).toContain('does not take away rights the law gives you');
    expect(text.toLowerCase()).not.toContain('cannot sue');
    expect(text.toLowerCase()).not.toContain('waive');
    expect(text.toLowerCase()).not.toContain('terms of service');
    expect(text.toLowerCase()).not.toContain('under no circumstances');
  });
});

/**
 * The nine translations, checked for the things a check can actually see.
 *
 * WHAT IS NOT CHECKED, AND WHY
 *
 * There is no per-language forbidden-phrase list. Two reasons, and the second
 * is the one that decided it:
 *
 *   1. It could not catch a mistake in these translations, because the same
 *      hand wrote the translations and the list. It would only catch a
 *      phrasing somebody had already thought of — which is the phrasing they
 *      would not have written.
 *   2. In several of these languages the natural rendering of "not liable …
 *      for anything else" *is* an absolute — 一切の責任を負いません in
 *      Japanese, 概不承担 in Chinese, "in keinem Fall" in German are ordinary
 *      register, not overreach. The qualification is carried by the
 *      "to the fullest extent the law allows" clause and by `localLaw`. A
 *      blocklist would flag correct translations and push the text toward
 *      worse phrasing to satisfy a test.
 *
 * So what is asserted is structural, and it is the part a mechanical check is
 * actually good at: that every locale really has all of these strings, that
 * none of them silently fell back to English, that the paragraph limiting the
 * whole notice survived translation everywhere, and that the placeholder
 * naming who is disclaiming liability is still in the sentence that needs it.
 * A native reader is the only real check on the wording, and the report says
 * which languages to ask about first.
 */
describe('the disclaimer in every shipped language', () => {
  const translated = LOCALES.filter(({ code }) => code !== 'en');
  const allKeys = [...DISCLAIMER_PARAGRAPH_KEYS, DISCLAIMER_LANGUAGE_KEY];

  it.each(translated.map(({ code, name }) => [name, code] as const))(
    '%s has its own words for every part of it',
    (_name, code) => {
      // `translate` falls back to English for a missing key rather than
      // rendering the key, which is right for the app and useless for this
      // check — a locale that had been forgotten would look fine. Comparing
      // against English is what makes a silent fallback visible.
      allKeys.forEach((key) => {
        const rendered = translate(code, key);
        expect(
          `${code}/${key}: ${rendered === en[key] ? 'English fallback' : 'translated'}`,
        ).toBe(`${code}/${key}: translated`);
        expect(rendered.length).toBeGreaterThan(0);
      });
    },
  );

  it.each(translated.map(({ code, name }) => [name, code] as const))(
    '%s keeps the paragraph that says local law wins',
    (_name, code) => {
      // The most important sentence in the notice and the easiest to lose:
      // it is the one that stops everything above it overstating itself.
      const localLaw = translate(code, 'disclaimer.localLaw');
      expect(localLaw).not.toBe(en['disclaimer.localLaw']);
      // Long enough not to be a stub. The English is 178 characters; CJK says
      // the same in far fewer, so the floor is set where a real sentence sits
      // in the shortest of these scripts rather than at a ratio of English.
      expect(localLaw.length).toBeGreaterThan(40);
    },
  );

  it.each(translated.map(({ code, name }) => [name, code] as const))(
    '%s still names who is disclaiming liability',
    (_name, code) => {
      // A translation that dropped `{author}` would be a liability disclaimer
      // that names nobody. i18n.test.ts checks placeholders across the whole
      // dictionary; this says out loud that it matters here in particular.
      expect(translate(code, 'disclaimer.liability')).toContain('{author}');
      expect(
        translate(code, 'disclaimer.liability', { author: AUTHOR_NAME }),
      ).toContain(AUTHOR_NAME);
    },
  );

  it.each(LOCALES.map(({ code, name }) => [name, code] as const))(
    '%s does not repeat a paragraph where another should be',
    (_name, code) => {
      // The characteristic translation-file error: a copy-paste that leaves
      // two slots holding the same sentence. Language-agnostic, and it catches
      // a real mistake rather than an imagined one.
      const rendered = allKeys.map((key) => translate(code, key));
      expect(new Set(rendered).size).toBe(allKeys.length);
    },
  );

  it.each(translated.map(({ code, name }) => [name, code] as const))(
    '%s names English as the text that prevails',
    (_name, code) => {
      // Asserted by shape rather than by wording, which is all that can be
      // done across nine languages: the clause exists, it is its own sentence,
      // and it is not the English one left in place.
      const clause = translate(code, DISCLAIMER_LANGUAGE_KEY);
      expect(clause).not.toBe(en[DISCLAIMER_LANGUAGE_KEY]);
      expect(clause.length).toBeGreaterThan(20);
    },
  );
});

describe('recording that it was acknowledged', () => {
  it('writes down which wording, which language, which build and when', () => {
    // A boolean would stop the dialog reappearing and be worth nothing as
    // evidence afterwards. These four fields are the difference between "the
    // flag is set" and "this text was shown to this person on this date".
    const record = buildAcceptance(
      '1.2.0',
      'es',
      new Date('2026-08-12T09:30:00Z'),
    );
    expect(record).toEqual({
      disclaimerVersion: DISCLAIMER_VERSION,
      locale: 'es',
      appVersion: '1.2.0',
      acceptedAt: '2026-08-12T09:30:00.000Z',
    });
  });

  it('records the language, now that the words depend on it', () => {
    // Without this the record no longer identifies the text that was on
    // screen: same version, ten different sets of sentences.
    expect(buildAcceptance('1.2.0', 'ja').locale).toBe('ja');
  });

  it('reads its own record back', () => {
    const record = buildAcceptance(
      '1.2.0',
      'de',
      new Date('2026-08-12T09:30:00Z'),
    );
    expect(readAcceptance(JSON.stringify(record))).toEqual(record);
  });

  it('takes a record with no app version, because an unknown build is still a record', () => {
    const stored = JSON.stringify({
      disclaimerVersion: DISCLAIMER_VERSION,
      acceptedAt: '2026-08-12T09:30:00.000Z',
    });
    expect(readAcceptance(stored)?.appVersion).toBe('');
    expect(readAcceptance(stored)?.locale).toBe('');
  });
});

describe('asking again when', () => {
  // The bias here runs the opposite way to the mandatory-update check. There
  // the cheap mistake is not blocking; here it is showing this twice.
  it.each([
    ['nothing has been stored', null],
    ['the stored value is undefined', undefined],
    ['the stored value is empty', ''],
    ['the stored value is a bare boolean', 'true'],
    ['the stored value is truncated JSON', '{'],
    ['the stored value is a word', 'accepted'],
    ['the stored value is JSON null', 'null'],
    ['the stored value is a JSON number', '42'],
    ['the stored value is a JSON string', '"accepted"'],
    ['the stored value is an empty array', '[]'],
    [
      'the record is wrapped in an array',
      '[{"disclaimerVersion":1,"acceptedAt":"2026-01-01T00:00:00.000Z"}]',
    ],
    [
      'the wording has changed since it was accepted',
      JSON.stringify({
        disclaimerVersion: DISCLAIMER_VERSION - 1,
        appVersion: '1.2.0',
        acceptedAt: '2026-08-12T09:30:00.000Z',
      }),
    ],
    [
      // What a hand-edited file, or a future format written carelessly, looks
      // like. Strict equality, so it asks again rather than guessing.
      'the version is stored as a string rather than a number',
      JSON.stringify({
        disclaimerVersion: String(DISCLAIMER_VERSION),
        acceptedAt: '2026-08-12T09:30:00.000Z',
      }),
    ],
    [
      'there is no timestamp, so there is no evidence of anything',
      JSON.stringify({ disclaimerVersion: DISCLAIMER_VERSION }),
    ],
    [
      'the timestamp is empty',
      JSON.stringify({ disclaimerVersion: DISCLAIMER_VERSION, acceptedAt: '' }),
    ],
    [
      'the timestamp is a number of milliseconds',
      JSON.stringify({
        disclaimerVersion: DISCLAIMER_VERSION,
        acceptedAt: 1_754_000_000_000,
      }),
    ],
  ])('%s', (_label, raw) => {
    expect(readAcceptance(raw)).toBeUndefined();
  });
});
