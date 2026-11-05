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
  let text = value.replace(/\bThe Killers\b/g, '').replace(/https?:\S+/g, '');
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
    // Product names and the musical note scale deliberately stay unchanged.
    const copied = keys.filter((key) => {
      const source = en[key];
      if (source !== dictionary[key] || /^(?:[A-G][♯♭]?\s*)+$/.test(source)) {
        return false;
      }
      if (source === 'FluidEQ Audio Processing Engine') {
        return false;
      }
      const words =
        source.replace(/\{\w+\}/g, '').match(/\b[A-Za-z]+\b/g) ?? [];
      return words.length >= 3;
    });
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
