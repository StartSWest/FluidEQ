/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { formatSongProgramme, songIdentity } from './songProgramme';

/**
 * What `native/tray-host/tests/song_programme_test.cpp` holds the tray's
 * song tracking to, written by `generate-sound-hops-fixture.ts` into
 * `song_programme_fixture.h`: songs named as players name them — mixed case,
 * Windows' and Unicode's spaces at either end, accents, a German sharp s, a
 * Turkish dotted capital I and a Greek final sigma (both of which lower
 * differently in context), Cyrillic, CJK and an emoji — and the identity
 * `songIdentity` makes of each; and the file the engine reads, for levels
 * that round up, down and exactly half way. The tray names the song while
 * Electron is gone, and main names it again when it is back: two names for
 * one song would forget what the engine learned about it.
 */

const SONGS: [app: string, title: string, artist: string][] = [
  ['Spotify.exe', 'Bohemian Rhapsody', 'Queen'],
  ['Chrome', '  Lose Yourself\t', ' Eminem '],
  ['Spotify.exe', '\u00a0Été Indien\u3000', '\ufeffJoe Dassin'],
  ['Spotify.exe', 'Straße', 'KRAFTWERK'],
  ['Spotify.exe', 'İSTANBUL', 'ÇAĞDAŞ'],
  ['Spotify.exe', 'ΟΔΟΣ ΣΤΟ ΦΩΣ', 'ΣΩΚΡΑΤΗΣ'],
  ['Spotify.exe', 'КАТЮША', 'Ансамбль'],
  [
    'Microsoft.ZuneMusic_8wekyb3d8bbwe!Microsoft.ZuneMusic',
    '夜に駆ける',
    'YOASOBI',
  ],
  ['Chrome', 'Happy 🎉 Song', ''],
  ['', 'Untitled', ''],
  ['Spotify.exe', '\u2028Line\u2029', '\u1680Ogham\u202f'],
  ['Spotify.exe', '\u200aHair\u2000', 'Space\u205f'],
];

/** UTF-8 bytes as a C string: printable ASCII as itself, the rest in octal. */
const cText = (value: string) =>
  `"${[...new TextEncoder().encode(value)]
    .map((byte) =>
      byte >= 0x20 && byte < 0x7f && byte !== 0x22 && byte !== 0x5c
        ? String.fromCharCode(byte)
        : `\\${byte.toString(8).padStart(3, '0')}`,
    )
    .join('')}"`;

/** A double as C++ reads it back exactly. */
const cDouble = (value: number) => {
  if (Object.is(value, -0)) {
    return '-0.0';
  }
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
};

/** Levels the file rounds: exact halves go up, as `toFixed` takes them. */
const LEVELS: number[] = [
  -14.125, -14.135, -9.995, -0.005, -0.001, -0, 0, 0.125, 3.14159, -23.4, -70,
  12.5, -6.375,
];

export const songProgrammeFixture = (): string =>
  [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/main/songProgrammeFixture.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    'namespace feq::tray::fixture {',
    '',
    'struct Song {',
    '  const char* app;',
    '  const char* title;',
    '  const char* artist;',
    '  const char* identity;',
    '};',
    '',
    'inline constexpr Song kSongs[] = {',
    ...SONGS.map(
      ([app, title, artist]) =>
        `    {${cText(app)}, ${cText(title)}, ${cText(artist)}, "${songIdentity({ app, title, artist })}"},`,
    ),
    '};',
    '',
    'struct Programme {',
    '  double level;',
    '  double peak;',
    '  const char* text;',
    '};',
    '',
    '// A known song at each level, its peak a tenth of a dB under it.',
    'inline constexpr Programme kProgrammes[] = {',
    ...LEVELS.map((level) => {
      const peak = level - 0.1;
      const text = formatSongProgramme('0123456789abcdef', {
        levelLufs: level,
        peakDb: peak,
        seconds: 200,
        heardAt: 0,
      });
      return `    {${cDouble(level)}, ${cDouble(peak)}, ${cText(text)}},`;
    }),
    '};',
    '',
    `inline constexpr const char* kUnknownSong = ${cText(formatSongProgramme('0123456789abcdef', undefined))};`,
    `inline constexpr const char* kNoSong = ${cText(formatSongProgramme(undefined, undefined))};`,
    '',
    '}  // namespace feq::tray::fixture',
    '',
  ].join('\n');
