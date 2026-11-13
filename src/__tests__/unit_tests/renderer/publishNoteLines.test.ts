/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The "What's new" line in every language, as the publish dialog holds it
 * (Ivan, 2026-11-12: the chat translates a line the member changed, "only if
 * it can, otherwise it just [puts] it on all other languages"). Each case
 * beside the one that must not.
 */

import {
  notesAsWritten,
  VERSION_NOTE_LOCALES,
} from '../../../common/sceneVersionNote';
import {
  asWritten,
  noteLocaleOf,
  settleTranslation,
  sourceOf,
  startLines,
  linesFrom,
  takeOffer,
  toTranslate,
  typeLine,
} from '../../../renderer/studio/publishNoteLines';

const ALL = notesAsWritten('Peaks stay whole');
const written = { ...ALL, es: 'Los picos quedan enteros' };

describe('the dialog’s lines', () => {
  it('needs nothing translated when the chat wrote every language', () => {
    expect(toTranslate(startLines(written), 'es')).toEqual([]);
  });

  it('needs every other language when only English was written', () => {
    const state = startLines({ en: 'Peaks stay whole' });
    expect(toTranslate(state, 'es')).toHaveLength(11);
    expect(toTranslate(state, 'es')).not.toContain('en');
  });

  it('makes every language out of date when the member changes their own line', () => {
    const state = typeLine(startLines(written), 'es', 'Los picos brillan');
    expect(sourceOf(state, 'es')).toBe('es');
    expect(toTranslate(state, 'es')).toHaveLength(11);
    // Control: typing the same words back changes nothing.
    const same = typeLine(
      startLines(written),
      'es',
      'Los picos quedan enteros',
    );
    expect(toTranslate(same, 'es')).toEqual([]);
  });

  it('follows English when the member changed that one and not theirs', () => {
    const state = typeLine(startLines(written), 'en', 'Peaks glow');
    expect(sourceOf(state, 'es')).toBe('en');
    expect(toTranslate(state, 'es')).toContain('es');
  });

  it('keeps a row the member corrected out of the translation', () => {
    let state = typeLine(startLines(written), 'es', 'Los picos brillan');
    state = typeLine(state, 'de', 'Die Gipfel leuchten');
    expect(toTranslate(state, 'es')).not.toContain('de');
  });

  it('never writes a newer offer over what the member typed', () => {
    const state = typeLine(startLines(written), 'es', 'Mis palabras');
    const next = takeOffer(state, linesFrom(notesAsWritten('Newer line')));
    expect(next.lines.es).toBe('Mis palabras');
    expect(next.lines.fr).toBe('Newer line');
  });

  it('settles a translation: the chat’s lines, the member’s words, nothing out of date', () => {
    const state = typeLine(startLines(written), 'es', 'Los picos brillan');
    const offer = linesFrom({
      ...notesAsWritten('Peaks glow'),
      es: 'Otra cosa',
    });
    const settled = settleTranslation(state, offer);
    expect(settled.lines.es).toBe('Los picos brillan');
    expect(settled.lines.ja).toBe('Peaks glow');
    expect(toTranslate(settled, 'es')).toEqual([]);
  });

  it('sends the member’s line as written to every language not yet written', () => {
    let state = typeLine(startLines(written), 'es', 'Los picos brillan');
    state = typeLine(state, 'de', 'Die Gipfel leuchten');
    const notes = asWritten(state, 'es');
    expect(notes?.en).toBe('Los picos brillan');
    expect(notes?.ja).toBe('Los picos brillan');
    expect(notes?.de).toBe('Die Gipfel leuchten');
    expect(Object.keys(notes ?? {})).toHaveLength(VERSION_NOTE_LOCALES.length);
  });

  it('reads FluidEQ’s language as a note’s, English otherwise', () => {
    expect(noteLocaleOf('zh-Hant')).toBe('zh-Hant');
    expect(noteLocaleOf('tlh')).toBe('en');
  });
});
