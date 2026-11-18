/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import en, { type Dictionary, type TranslationKey } from 'common/i18n/en';
import ko from 'common/i18n/ko';
import zhHant from 'common/i18n/zh-Hant';
import { GENRE_NOTES } from 'common/dsp/genreNotes';

const catalogs: [string, Dictionary][] = [
  ['ko', ko],
  ['zh-Hant', zhHant],
];
const keys = Object.keys(en) as TranslationKey[];
const normalizeNumber = (value: string) =>
  value.replace(/\s/g, '').replace(/−/g, '-');

const englishResidual = (key: string, value: string): string[] => {
  // A game keeps its own title in every locale, as a band keeps its name:
  // the 2.4 tour names the Gaming Lab's Heroes of the Storm mix.
  let text = value
    .replace(/\bThe Killers\b/g, '')
    .replace(/\bHeroes of the Storm\b/g, '')
    .replace(/https?:\S+/g, '');
  const genre = /^genre\.([^.]+)\./.exec(key)?.[1];
  // Reference titles and credited artists keep their canonical spelling in
  // every locale. "How You Like That" is a recording, not echoed English
  // prose. Protect only the names actually listed for this genre; the rest
  // of the paragraph must still pass the untranslated-sentence check.
  const recordings = genre ? (GENRE_NOTES[genre]?.listen ?? []) : [];
  recordings.forEach((recording) => {
    recording.split(' — ').forEach((name) => {
      text = text.split(name).join('');
    });
  });
  const phrases = text.match(/\b[A-Za-z]+(?:[\s,;:]+[A-Za-z]+){3,}\b/g) ?? [];
  return phrases.filter((phrase) =>
    /\b(?:the|your|is|are|was|were|this|that|each|every|when|then|press|open|ready|listen|say|could|will)\b/i.test(
      phrase,
    ),
  );
};

it('keeps known reference names while still detecting untranslated prose beside them', () => {
  expect(
    englishResidual('genre.kPop.story', '한국어 How You Like That 한국어'),
  ).toEqual([]);
  expect(
    englishResidual(
      'genre.kPop.story',
      '한국어 How You Like That 한국어 This sentence is not translated',
    ),
  ).toEqual(['This sentence is not translated']);
  // A reference name is not a blanket phrase exemption elsewhere in the app.
  expect(englishResidual('unrelated.key', 'How You Like That')).toEqual([
    'How You Like That',
  ]);
});

// A keyboard chord is the keys' own names, which both catalogues keep as the
// keyboard prints them (their `graph.scene.camera.key.*` say Ctrl, Alt and
// Shift), as the note scale and product names stay unchanged.
const KEY = String.raw`(?:Ctrl|Alt|Shift|Tab|Esc|Enter|Space|F\d{1,2}|[A-Z0-9])`;
const KEY_CHORD = new RegExp(`^${KEY}(?:\\+${KEY})+$`);

/** An English source handed back unchanged, as a whole translation. */
const isCopiedProse = (source: string, translated: string): boolean => {
  if (
    source !== translated ||
    /^(?:[A-G][♯♭]?\s*)+$/.test(source) ||
    KEY_CHORD.test(source)
  ) {
    return false;
  }
  if (source === 'FluidEQ Audio Processing Engine') {
    return false;
  }
  const words = source.replace(/\{\w+\}/g, '').match(/\b[A-Za-z]+\b/g) ?? [];
  return words.length >= 3;
};

it('lets a keyboard chord stand as it is, and still catches a sentence round one', () => {
  expect(isCopiedProse('Ctrl+Shift+I', 'Ctrl+Shift+I')).toBe(false);
  // The control: the same chord inside English prose is copied prose.
  expect(
    isCopiedProse('Press Ctrl+Shift+I to fix', 'Press Ctrl+Shift+I to fix'),
  ).toBe(true);
  expect(isCopiedProse('Ctrl Shift Escape', 'Ctrl Shift Escape')).toBe(true);
});

describe.each(catalogs)('%s catalog contracts', (_code, dictionary) => {
  it('has exactly the canonical keys, including concurrently added features', () => {
    expect(Object.keys(dictionary).sort()).toEqual([...keys].sort());
  });

  it('preserves the line breaks that split guide steps and paragraphs', () => {
    expect(
      keys.filter(
        (key) =>
          (dictionary[key].match(/\n/g) ?? []).length !==
          (en[key].match(/\n/g) ?? []).length,
      ),
    ).toEqual([]);
  });

  it('preserves technical measurements rather than dropping or changing them', () => {
    const missing = keys.flatMap((key) => {
      const numbers =
        en[key].match(
          /[-+−]?\d+(?:\.\d+)?\s*(?:dBTP|dBFS|dB|LUFS|kHz|Hz|ms|MB|GB|Mb\/s)\b/g,
        ) ?? [];
      return numbers
        .filter(
          (number) =>
            !normalizeNumber(dictionary[key]).includes(normalizeNumber(number)),
        )
        .map((number) => `${key}: ${number}`);
    });
    expect(missing).toEqual([]);
  });

  it('does not count copied English prose as a completed translation', () => {
    // A service can echo an entire batch while retaining every key and token.
    // Product names, the musical note scale and keyboard chords
    // deliberately stay unchanged (`isCopiedProse`).
    const copied = keys.filter((key) =>
      isCopiedProse(en[key], dictionary[key]),
    );
    expect(copied).toEqual([]);
  });

  it('does not leave English sentences inside partly translated paragraphs', () => {
    // Check paragraphs too: exact-value comparison misses a translated opening
    // followed by an echoed English sentence. Product names are not prose.
    const residual = keys.flatMap((key) => {
      return englishResidual(key, dictionary[key]).map(
        (phrase) => `${key}: ${phrase}`,
      );
    });
    expect(residual).toEqual([]);
  });
  it('preserves provider, product and format names people must recognize', () => {
    const brands = [
      'FluidEQ',
      'Equalizer APO',
      'Buy Me a Coffee',
      'Stripe',
      'Supabase',
      'Resend',
      'GitHub',
      'Razer Chroma',
      'Razer Synapse',
      'OPRA',
      'AutoEq',
      'Claude Code',
      'Squiglink',
      'YouTube',
      'Bandcamp',
      'Twitch',
      'Suno',
      'UltraStar',
    ];
    const normalized = (value: string) =>
      value.toLowerCase().replace(/[^a-z0-9]/g, '');
    const missing = keys.flatMap((key) =>
      brands
        .filter(
          (brand) =>
            new RegExp(`\\b${brand}\\b`).test(en[key]) &&
            !normalized(dictionary[key]).includes(normalized(brand)),
        )
        .map((brand) => `${key}: ${brand}`),
    );
    expect(missing).toEqual([]);
  });
});
