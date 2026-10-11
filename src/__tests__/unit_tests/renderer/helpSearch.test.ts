/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { HELP_CHAPTERS, type HelpChapterId } from 'common/helpGuide';
import { LOCALES, loadLocale, type LocaleCode } from 'common/i18n';
import {
  buildHelpIndex,
  foldHelpWord,
  helpQueryTerms,
  searchHelp,
  type IHelpIndex,
} from 'renderer/help/helpSearch';

// Every language but English is a chunk of its own, loaded when it is first
// chosen; these search all ten, so all ten are loaded first.
beforeAll(() => Promise.all(LOCALES.map(({ code }) => loadLocale(code))));

// The guide is indexed once per language, as the Help reader does.
const indexes = new Map<LocaleCode, IHelpIndex>();
const guideIn = (locale: LocaleCode): IHelpIndex => {
  let index = indexes.get(locale);
  if (!index) {
    index = buildHelpIndex(HELP_CHAPTERS, locale);
    indexes.set(locale, index);
  }
  return index;
};

const firstFor = (locale: LocaleCode, query: string) =>
  searchHelp(guideIn(locale), query)?.hits[0]?.chapterId;

describe('foldHelpWord', () => {
  it('makes the spellings people type interchangeably one word', () => {
    expect(foldHelpWord('Égaliseur', 'fr')).toBe('egaliseur');
    expect(foldHelpWord('Kopfhörer', 'de')).toBe('kopfhorer');
    expect(foldHelpWord('Straße', 'de')).toBe('strasse');
    expect(foldHelpWord('Объём', 'ru')).toBe('объем');
    expect(foldHelpWord('ＥＱ', 'ja')).toBe('eq');
    expect(foldHelpWord('l’égaliseur', 'fr')).toBe("l'egaliseur");
    // A Hindi letter with its nukta and without, and chandrabindu typed as
    // anusvara, are the same word to whoever types them.
    expect(
      foldHelpWord('\u092b\u093c\u093f\u0932\u094d\u091f\u0930', 'hi'),
    ).toBe('\u092b\u093f\u0932\u094d\u091f\u0930');
    expect(foldHelpWord('आँख', 'hi')).toBe('आंख');
  });

  it('leaves marks that are letters in their own script alone', () => {
    // Only Latin loses its accents: a Devanagari vowel sign is a letter.
    expect(foldHelpWord('संगीत', 'hi')).toBe('संगीत');
    expect(foldHelpWord('イコライザー', 'ja')).toBe('イコライザー');
  });
});

describe('helpQueryTerms', () => {
  it('drops the question words and keeps what is asked about', () => {
    expect(helpQueryTerms('How do I add a band?', 'en')).toEqual([
      'add',
      'band',
    ]);
    expect(helpQueryTerms("Comment régler l'égaliseur ?", 'fr')).toEqual([
      'regler',
      'egaliseur',
    ]);
  });

  it('keeps question words when they are all that was typed', () => {
    expect(helpQueryTerms('how', 'en')).toEqual(['how']);
  });
});

describe('searchHelp', () => {
  it('answers nothing typed with the whole guide, not an empty one', () => {
    expect(searchHelp(guideIn('en'), '')).toBeUndefined();
    expect(searchHelp(guideIn('en'), '  ?! ')).toBeUndefined();
  });

  it('puts the chapter that answers an everyday question first', () => {
    expect(firstFor('en', 'no sound')).toBe('trouble');
    expect(firstFor('en', 'between computers')).toBe('share');
    expect(firstFor('en', 'wallpaper')).toBe('desktop');
    expect(firstFor('en', 'remove vocals')).toBe('maker');
    expect(firstFor('en', 'surround')).toBe('room');
    expect(firstFor('en', 'how do i add a band')).toBe('eq');
    expect(firstFor('en', 'game presets')).toBe('games');
  });

  it('forgives a typo, a plural and another form of the word', () => {
    expect(firstFor('en', 'wallpapr')).toBe('desktop');
    expect(firstFor('en', 'headphone correction')).toBe('headphones');
    expect(firstFor('en', 'playlists')).toBe('library');
  });

  it('finds nothing where most of what was typed is in no chapter', () => {
    // The positive control: the same word alone is found.
    expect(searchHelp(guideIn('en'), 'equalizer')?.hits.length).toBeGreaterThan(
      0,
    );
    expect(searchHelp(guideIn('en'), 'banana equalizer')?.hits).toEqual([]);
    expect(searchHelp(guideIn('en'), 'zzzz')?.hits).toEqual([]);
  });

  it('searches every language in its own words', () => {
    const cases: [LocaleCode, string, string][] = [
      ['es', 'no hay sonido', 'trouble'],
      ['es', 'fondo de pantalla', 'desktop'],
      ['pt', 'sem som', 'trouble'],
      ['pt', 'papel de parede', 'desktop'],
      ['fr', 'pas de son', 'trouble'],
      ['fr', "fond d'écran", 'desktop'],
      ['de', 'kein Ton', 'trouble'],
      ['de', 'Hintergrundbild', 'desktop'],
      ['it', 'nessun suono', 'trouble'],
      ['it', 'rimuovere la voce', 'maker'],
      ['ru', 'нет звука', 'trouble'],
      ['ru', 'обои', 'desktop'],
      ['zh', '没有声音', 'trouble'],
      ['zh', '壁纸', 'desktop'],
      ['ja', '音が出ない', 'trouble'],
      ['ja', '壁紙', 'desktop'],
      ['hi', 'आवाज़ नहीं', 'trouble'],
      ['hi', 'वॉलपेपर', 'desktop'],
    ];
    cases.forEach(([locale, query, chapter]) =>
      expect([locale, query, firstFor(locale, query)]).toEqual([
        locale,
        query,
        chapter,
      ]),
    );
  });

  it('finds what 2.1 brought, in every language, among the first hits', () => {
    // Band labels, the battery, a song's own sound, the EQ mode card's pin,
    // the keyboard and Edit sound, each in the words of the language read in
    // and, for Edit sound, the button's own label in it. Among the first
    // three rather than first, because three of the words mean two things
    // here: labels are on the graph's View menu too, the keyboard is also an
    // RGB device Dynamic lighting colours, and the player has a pin of its
    // own.
    const words: Record<LocaleCode, readonly string[]> = {
      en: ['labels', 'battery', 'song', 'pin', 'keyboard', 'Edit sound'],
      es: [
        'etiquetas',
        'batería',
        'canción',
        'fijar',
        'teclado',
        'Editar sonido',
      ],
      pt: ['rótulos', 'bateria', 'música', 'fixar', 'teclado', 'Editar som'],
      fr: [
        'étiquettes',
        'batterie',
        'chanson',
        'épingler',
        'clavier',
        'Modifier le son',
      ],
      de: [
        'Beschriftungen',
        'Akku',
        'Lied',
        'anheften',
        'Tastatur',
        'Klang bearbeiten',
      ],
      it: [
        'etichette',
        'batteria',
        'brano',
        'puntina',
        'tastiera',
        'Modifica suono',
      ],
      ru: [
        'подписи',
        'батарея',
        'песня',
        'закрепить',
        'клавиатура',
        'Настроить звук',
      ],
      zh: ['标签', '电量', '歌曲', '固定', '键盘', '编辑声音'],
      ja: [
        'ラベル',
        'バッテリー',
        '曲',
        'ピン留め',
        'キーボード',
        'サウンドを編集',
      ],
      hi: ['लेबल', 'बैटरी', 'गाना', 'पिन', 'कीबोर्ड', 'ध्वनि संपादित करें'],
    };
    const chapters: readonly HelpChapterId[] = [
      'eq',
      'profiles',
      'profiles',
      'eqmode',
      'eq',
      'profiles',
    ];
    // Every miss at once: they come a language at a time.
    const missed = LOCALES.flatMap(({ code }) =>
      words[code].flatMap((query, at) => {
        const first = (searchHelp(guideIn(code), query)?.hits ?? [])
          .slice(0, 3)
          .map((hit) => hit.chapterId);
        return first.includes(chapters[at])
          ? []
          : [`${code} ${query}: ${first.join(', ')}`];
      }),
    );
    expect(missed).toEqual([]);
  });

  it('also finds the English guide from another language', () => {
    // "Wallpaper" is not a Spanish word; the English guide is searched too.
    expect(firstFor('es', 'wallpaper')).toBe('desktop');
  });

  it('says where each hit is, and marks the words it found there', () => {
    const found = searchHelp(guideIn('en'), 'no sound');
    const hit = found?.hits[0];
    if (!found || !hit) {
      throw new Error('"no sound" found nothing');
    }
    expect(hit.anchor.startsWith(`${hit.chapterId}/`)).toBe(true);
    const marked = hit.snippet.flatMap(({ text, marks }) =>
      marks.map(([start, end]) => text.slice(start, end).toLowerCase()),
    );
    expect(marked).toContain('sound');
    // Every mark the guide draws is a range inside the passage it names.
    expect(found.marks.size).toBeGreaterThan(0);
    found.marks.forEach((ranges) =>
      ranges.forEach(([start, end]) => expect(end).toBeGreaterThan(start)),
    );
  });

  it('keeps only the hits worth reading, best first', () => {
    const hits = searchHelp(guideIn('en'), 'visualizer')?.hits ?? [];
    expect(hits.length).toBeGreaterThan(1);
    hits
      .slice(1)
      .forEach((hit, index) =>
        expect(hit.score).toBeLessThanOrEqual(hits[index].score),
      );
    hits.forEach((hit) =>
      expect(hit.score).toBeGreaterThanOrEqual(hits[0].score / 4),
    );
  });
});
