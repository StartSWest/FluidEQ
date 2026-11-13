/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a maker writes about a version, and how long a version is new. The
 * server vendors this file byte for byte, so what is held here is also what
 * the publishing function keeps.
 */

import {
  MAX_REVIEW_NOTE,
  MAX_VERSION_NOTE,
  NEW_VERSION_DAYS,
  isLaterSceneVersion,
  isNewSceneVersion,
  noteIn,
  notesAsWritten,
  readVersionNote,
  readReviewNotes,
  readVersionNotes,
  versionToPublish,
  wholeSentencesUpTo,
  VERSION_NOTE_LOCALES,
} from '../../../common/sceneVersionNote';
import { LOCALES } from '../../../common/i18n';

const DAY = 24 * 60 * 60 * 1000;

describe('a version note', () => {
  it('is kept as one clean line', () => {
    expect(readVersionNote('  Brighter lake\n\tat   night  ')).toBe(
      'Brighter lake at night',
    );
  });

  it('loses characters that draw nothing or turn the line around', () => {
    // Zero-width space, right-to-left override, a tag character, a BOM.
    const hidden = `peaks\u200b stay\u202e whole\u{e0041}\ufeff`;
    expect(readVersionNote(hidden)).toBe('peaks stay whole');
  });

  it('is nothing when nothing is sent or nothing is left', () => {
    expect(readVersionNote(undefined)).toBeNull();
    expect(readVersionNote(null)).toBeNull();
    expect(readVersionNote('   \u200b  ')).toBeNull();
  });

  it('cannot be kept when it is not text or runs long', () => {
    expect(readVersionNote(42)).toBeUndefined();
    expect(readVersionNote({ text: 'hi' })).toBeUndefined();
    expect(readVersionNote('x'.repeat(MAX_VERSION_NOTE + 1))).toBeUndefined();
    // The control: exactly the limit is kept.
    expect(readVersionNote('x'.repeat(MAX_VERSION_NOTE))).toHaveLength(
      MAX_VERSION_NOTE,
    );
  });
});

describe('a new version', () => {
  const now = Date.parse('2026-09-13T20:00:00.000Z');
  const at = (daysAgo: number) => new Date(now - daysAgo * DAY).toISOString();

  it('is one past the first, published within the week', () => {
    expect(
      isNewSceneVersion({ version: 4, firstVersion: 1, updatedAt: at(2) }, now),
    ).toBe(true);
    expect(
      isNewSceneVersion(
        { version: 4, firstVersion: 1, updatedAt: at(NEW_VERSION_DAYS + 1) },
        now,
      ),
    ).toBe(false);
  });

  it('is never a scene’s first version, nor one whose history is unknown', () => {
    expect(
      isNewSceneVersion({ version: 1, firstVersion: 1, updatedAt: at(0) }, now),
    ).toBe(false);
    expect(isNewSceneVersion({ version: 4, updatedAt: at(0) }, now)).toBe(
      false,
    );
    expect(
      isNewSceneVersion(
        { version: 4, firstVersion: 1, updatedAt: 'not a date' },
        now,
      ),
    ).toBe(false);
  });
});

describe('the rule that a scene changes only under a higher version', () => {
  it('takes a higher version over what is already there', () => {
    expect(isLaterSceneVersion(4, 3)).toBe(true);
    expect(isLaterSceneVersion(400, 3)).toBe(true);
  });

  it('refuses the same version again, which is the whole point', () => {
    // A maker republishing under the number everybody already installed is
    // how different code reaches a listener with no update notice, nothing
    // on the versions page, and one number naming two scenes.
    expect(isLaterSceneVersion(3, 3)).toBe(false);
  });

  it('refuses a version that goes backwards', () => {
    expect(isLaterSceneVersion(2, 3)).toBe(false);
  });

  it('lets anything fill a place where nothing is published', () => {
    expect(isLaterSceneVersion(1)).toBe(true);
    expect(isLaterSceneVersion(97)).toBe(true);
  });

  it('refuses a version that is not a whole number, rather than comparing it', () => {
    // Fails CLOSED: a manifest carrying text, a fraction or NaN must not
    // publish, and NaN compares false against everything either way — which
    // would read as "refused" here and as "allowed" if the test were written
    // the other way round.
    [Number.NaN, 2.5, '4', null, undefined, {}].forEach((bad) => {
      expect(isLaterSceneVersion(bad, 3)).toBe(false);
      expect(isLaterSceneVersion(bad)).toBe(false);
    });
  });

  it('treats a held version nobody can compare as no version at all', () => {
    // A row that cannot be read must not lock its own scene out of the
    // gallery for good.
    expect(isLaterSceneVersion(3, Number.NaN)).toBe(true);
  });
});

// Ivan, 2026-11-09: "Only when publishing". The number counts the versions
// people see in the gallery, so it moves by one, at a publication.
describe('the version a publication goes out under', () => {
  it('is one above the version the gallery has, never more', () => {
    expect(versionToPublish(3)).toBe(4);
    expect(versionToPublish(10)).toBe(11);
  });

  it('is 1 for a scene the gallery has never had', () => {
    expect(versionToPublish()).toBe(1);
  });

  it('always clears what is held', () => {
    // The property that matters: whatever comes out of this is a version the
    // rule above accepts. Anything else and publishing refuses its own work.
    [undefined, 0, 1, 7, 98, Number.NaN, 2.5].forEach((held) => {
      expect(isLaterSceneVersion(versionToPublish(held), held)).toBe(true);
    });
  });
});

// Ivan, 2026-11-12: the line in all twelve languages, a listener reading
// their own. The server keeps exactly what this reader lets through.
describe('the note in every language', () => {
  it('names exactly the languages FluidEQ speaks', () => {
    expect([...VERSION_NOTE_LOCALES].sort()).toEqual(
      LOCALES.map((locale) => locale.code).sort(),
    );
  });

  it('keeps each language’s line, cleaned as one line is', () => {
    expect(
      readVersionNotes({ en: ' The fish\nswim ', es: 'Los peces nadan' }),
    ).toEqual({ en: 'The fish swim', es: 'Los peces nadan' });
  });

  it('is no note without an English line, and drops a line left empty', () => {
    expect(readVersionNotes(undefined)).toBeNull();
    expect(readVersionNotes(null)).toBeNull();
    expect(readVersionNotes({ es: 'Los peces nadan' })).toBeNull();
    expect(readVersionNotes({ en: 'Fish', de: '   ' })).toEqual({
      en: 'Fish',
    });
  });

  it('refuses the whole of anything it cannot keep', () => {
    expect(readVersionNotes('Fish')).toBeUndefined();
    expect(readVersionNotes(['Fish'])).toBeUndefined();
    expect(readVersionNotes({ en: 'Fish', xx: 'Fisch' })).toBeUndefined();
    expect(readVersionNotes({ en: 'Fish', de: 7 })).toBeUndefined();
    expect(
      readVersionNotes({ en: 'Fish', de: 'x'.repeat(MAX_VERSION_NOTE + 1) }),
    ).toBeUndefined();
    // The control: the longest line there is passes.
    expect(
      readVersionNotes({ en: 'Fish', de: 'x'.repeat(MAX_VERSION_NOTE) }),
    ).toEqual({ en: 'Fish', de: 'x'.repeat(MAX_VERSION_NOTE) });
  });

  it('gives every language the line as written when nothing translated it', () => {
    const notes = notesAsWritten('Los peces nadan');
    expect(Object.keys(notes).sort()).toEqual([...VERSION_NOTE_LOCALES].sort());
    expect(new Set(Object.values(notes))).toEqual(new Set(['Los peces nadan']));
  });

  it('shows a reader their language, and English where there is none', () => {
    const notes = { en: 'Fish swim', ja: '魚が泳ぐ' };
    expect(noteIn(notes, 'ja')).toBe('魚が泳ぐ');
    expect(noteIn(notes, 'de')).toBe('Fish swim');
    expect(noteIn(notes, 'tlh')).toBe('Fish swim');
  });
});

describe('a declined scene’s line to its maker', () => {
  const long = 'a'.repeat(MAX_VERSION_NOTE + 1);

  it('is kept whole in every language up to its own, longer limit', () => {
    const line = 'b'.repeat(MAX_REVIEW_NOTE);
    expect(readReviewNotes({ en: line, de: long })).toEqual({
      en: line,
      de: long,
    });
    // The same lines are too long for a version's note.
    expect(readVersionNotes({ en: long })).toBeUndefined();
  });

  it('holds the same 1000 characters a line as the server’s check (0111)', () => {
    // review_notes_valid refuses a line past 1000; a longer limit here would
    // let the admin send a line the server then refuses after the press.
    expect(MAX_REVIEW_NOTE).toBe(1000);
  });

  it('is refused whole, never cut, past that limit', () => {
    expect(
      readReviewNotes({ en: 'Fine.', ru: 'c'.repeat(MAX_REVIEW_NOTE + 1) }),
    ).toBeUndefined();
  });

  it('gives an older app the leading whole sentences that fit its line', () => {
    const first = `The flash at 0:13 covers 25% of the view and breaks the flash rule, at 1.5 times a second. `;
    const second = `${'Soften it or make it smaller, and keep the rain as it is. '.repeat(4)}`;
    const line = `${first}${second}`.trim();
    expect(line.length).toBeGreaterThan(MAX_VERSION_NOTE);
    const kept = wholeSentencesUpTo(line);
    expect(kept).not.toBeNull();
    expect((kept ?? '').length).toBeLessThanOrEqual(MAX_VERSION_NOTE);
    expect(line.startsWith(kept ?? '-')).toBe(true);
    expect(kept?.endsWith('.')).toBe(true);
    // Never between "1." and "5", nor after "0:13".
    expect(kept).toContain('1.5 times a second.');
  });

  it('cuts after a CJK sentence end, which takes no space', () => {
    const sentence = '画面の四分の一以上が白く光ります。';
    const line = sentence.repeat(30);
    const kept = wholeSentencesUpTo(line) ?? '';
    expect(kept.length).toBeLessThanOrEqual(MAX_VERSION_NOTE);
    expect(kept.length % sentence.length).toBe(0);
    expect(kept.length).toBeGreaterThan(0);
  });

  it('never takes a decimal point or a clock for the end of a sentence', () => {
    const line = `Short one. ${'a'.repeat(255)} at 1.5 dB over and again at 0:13.5 of the song, then more after it.`;
    expect(line.indexOf('1.') + 2).toBeLessThanOrEqual(MAX_VERSION_NOTE);
    expect(wholeSentencesUpTo(line)).toBe('Short one.');
  });

  it('gives an older app nothing rather than half a first sentence', () => {
    expect(wholeSentencesUpTo(`${long} and more.`)).toBeNull();
    expect(wholeSentencesUpTo('Short and whole.')).toBe('Short and whole.');
  });
});
