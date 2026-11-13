/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The publish line as AIs actually leave it (2026-11-13: a chat asked for
 * "release notes" on a scene never published tried three shapes and the
 * Publish box stayed empty through all of them). Each shape is held beside
 * the one FluidEQ itself writes, which must still read exactly as before.
 */

import {
  MAX_VERSION_NOTE,
  VERSION_NOTE_LOCALES,
} from '../../../common/sceneVersionNote';
import {
  isNoteKey,
  noteLocaleOf,
  notesFromPlainText,
  parseStudioNotes,
  readLooseNoteLines,
  STUDIO_NOTES_CONTRACT,
} from '../../../common/studioNotes';

const LINE = 'A black hole bends the starlight with the bass';

describe('the line in every language, as AIs spell it', () => {
  it('keeps every language FluidEQ knows, by any usual spelling', () => {
    expect(
      readLooseNoteLines({
        en: LINE,
        'pt-BR': 'Um buraco negro',
        zh_CN: '黑洞',
        'zh-TW': '黑洞繁',
        Deutsch: 'Ein schwarzes Loch',
      }).lines,
    ).toEqual({
      en: LINE,
      pt: 'Um buraco negro',
      zh: '黑洞',
      'zh-Hant': '黑洞繁',
      de: 'Ein schwarzes Loch',
    });
  });

  it('drops a language it cannot use, never the rest', () => {
    const read = readLooseNoteLines({
      en: LINE,
      es: 'x'.repeat(MAX_VERSION_NOTE + 1),
      klingon: 'qaStaH',
    });
    expect(read).toEqual({ lines: { en: LINE }, unreadable: false });
  });

  it('takes the exact name over a regional one beside it', () => {
    expect(
      readLooseNoteLines({ 'zh-CN': '简体', zh: '中文', en: LINE }).lines?.zh,
    ).toBe('中文');
  });

  it('reads a plain line as the English one', () => {
    expect(readLooseNoteLines(LINE)).toEqual({
      lines: { en: LINE },
      unreadable: false,
    });
  });

  it('says so when nothing in a line can be used, and only then', () => {
    expect(readLooseNoteLines({ es: 'Un agujero negro' })).toEqual({
      unreadable: true,
    });
    expect(readLooseNoteLines('x'.repeat(MAX_VERSION_NOTE + 1))).toEqual({
      unreadable: true,
    });
    expect(readLooseNoteLines(42)).toEqual({ unreadable: true });
    // The controls: no line at all is no problem to say.
    expect(readLooseNoteLines(undefined)).toEqual({ unreadable: false });
    expect(readLooseNoteLines('   ')).toEqual({ unreadable: false });
  });

  it('knows every language by its own name, and nothing that is not one', () => {
    VERSION_NOTE_LOCALES.forEach((locale) =>
      expect(noteLocaleOf(locale)).toBe(locale),
    );
    expect(noteLocaleOf('en_US')).toBe('en');
    expect(noteLocaleOf('header')).toBeUndefined();
    expect(noteLocaleOf('schema')).toBeUndefined();
  });
});

describe('the notes file as AIs write it', () => {
  it('reads the line under the names models give it', () => {
    [
      'whatsNew',
      'whats_new',
      "What's new",
      'release_notes',
      'releaseNotes',
      'note',
    ].forEach((key) =>
      expect(parseStudioNotes({ [key]: { en: LINE } })?.whatsNew).toBe(LINE),
    );
    expect(isNoteKey('release-notes')).toBe(true);
    // The control: the member's description is never mistaken for it.
    expect(isNoteKey('description')).toBe(false);
    expect(parseStudioNotes({ description: LINE })?.whatsNew).toBeUndefined();
  });

  it('reads a line beside a header and a schema the AI added', () => {
    expect(
      parseStudioNotes({
        header: 'FluidEQ studio notes',
        schema: 1,
        description: 'A black hole',
        whatsNew: { en: LINE, es: 'Un agujero negro' },
      }),
    ).toEqual({
      description: 'A black hole',
      whatsNew: LINE,
      whatsNewLines: { en: LINE, es: 'Un agujero negro' },
    });
  });

  it('reads notes written as text: the words, never the heading', () => {
    expect(
      parseStudioNotes(notesFromPlainText(`# What's new\n\n${LINE}\n`)),
    ).toEqual({ description: '', whatsNew: LINE });
    // The control: an empty or heading-only text offers no line.
    expect(notesFromPlainText('# Release notes\n---\n')).toEqual({});
  });
});

describe('the contract every AI is told', () => {
  it('names the file, the key, the tool, every language and the limit', () => {
    expect(STUDIO_NOTES_CONTRACT).toContain('studio-notes.json');
    expect(STUDIO_NOTES_CONTRACT).toContain('"whatsNew"');
    expect(STUDIO_NOTES_CONTRACT).toContain('write_whats_new');
    expect(STUDIO_NOTES_CONTRACT).toContain(VERSION_NOTE_LOCALES.join(', '));
    expect(STUDIO_NOTES_CONTRACT).toContain(String(MAX_VERSION_NOTE));
    expect(STUDIO_NOTES_CONTRACT).toMatch(/first version needs the line too/);
  });
});
