/* FluidEQ — GPL-3.0-or-later */
import type { IEqPreset } from './eqPresets';

/**
 * Listening starting points, not genre standards or mastering corrections.
 *
 * Each row is the main EQ's fifteen gains, fitted rather than drawn: the
 * genre's whole chain (its rack, `genres/*.ts`) was rendered over real records
 * and the curve solved so that what is heard — the rack, then this curve — leans
 * the way the genre is known to lean: the low end it stands on, the band its
 * lead voice or instrument lives in, how much air it carries. The same curve
 * is held to the same shape on the dry record, for Equalizer APO, which has no
 * rack in front of it.
 *
 * What every row keeps, and the failure each one prevents:
 * - It adds no loudness to its chain (K-weighted, against the rack alone).
 *   Louder wins every comparison it is in before anybody has heard what it did
 *   to the tone; rows each a little hot are how this catalogue once became a
 *   loudness contest, the worst two and a half decibels over DSP Off and
 *   feeling like the best presets in the list. A lift is paid for by a cut.
 * - Its top octave and its sub are not where that cut is taken, unless the
 *   genre's records really are dark or thin. A genre known by its mids is
 *   heard with its mids up; a fit left free paid for them at 16 kHz and 32 Hz
 *   instead, five decibels off the top of genres of brass and cymbals.
 * - It is audibly not its neighbour. Six broad anchors used to generate these
 *   rows, and six points on a log axis cannot say "the mids forward, the upper
 *   mids back", so Rock and Hard Rock, Merengue and Samba came out one curve.
 *   Siblings now differ where they are known to: most by a decibel and a
 *   half or more, and none by much under one.
 *
 * - It does not add what the genre's records already carry. Held against
 *   published genre research on 2026-09-23: the sub of techno and EDM, the
 *   air of K-pop and trance, the 3-8 kHz of bachata and merengue, the 2-4 kHz
 *   of opera and J-pop, the bayan of Indian classical and the dhol's boom in
 *   bhangra had each been lifted on records mastered with plenty of it, and
 *   the world row imposed a tilt on recordings that want none. Those shapes
 *   were changed and each row kept the loudness it had, measured through its
 *   model's bands.
 *
 * Re-tune a row by measuring its chain again, not by hand: a hand edit moves
 * its loudness and its distance from its neighbours with it.
 */
const STYLES: readonly (readonly [string, readonly number[]])[] = [
  [
    'modernCountry',
    [
      -1.7, -0.5, 1.6, 1.8, 0.1, -2.1, -2.4, -1.3, -0.5, 0.6, 0.9, 0.7, 0.3,
      0.6, 0.4,
    ],
  ],
  [
    'folk',
    [-0.8, -0.6, -0.5, 0, 0.6, 0.4, -0.3, -0.6, -0.3, 0.6, 1, 0.8, 0.5, 0.8, 1],
  ],
  [
    'bluegrass',
    [
      -0.8, -0.9, -1.1, -0.8, -0.2, -0.1, -0.2, -0.3, -0.2, 0.3, 1.2, 2.3, 2.1,
      1.2, 0.3,
    ],
  ],
  [
    'americana',
    [
      -1.7, -0.9, 0.5, 1.8, 1.6, -0.3, -1.7, -2.2, -1.7, 1.2, 1.2, -0.3, -0.5,
      0.2, 0.3,
    ],
  ],
  [
    'singerSongwriter',
    [
      -1, -0.9, -1.2, -0.6, 0.1, -0.1, -0.8, -0.2, 1.6, 1.9, 0.5, -0.7, 0.2,
      0.9, 1.1,
    ],
  ],
  [
    'popRock',
    [
      -1.6, -0.3, 1.2, 0.5, -0.8, -1.7, -1.5, -0.4, 0.3, 1.2, 1.6, 0.1, -0.3,
      0.2, 0.2,
    ],
  ],
  [
    'classicRock',
    [
      -3.2, -1.5, 0.8, 1.7, 0.6, -1.8, -1.8, 0.1, 1.1, 0.9, -1, -1.2, -0.7, 0.1,
      0.3,
    ],
  ],
  [
    'alternativeRock',
    [
      -1.6, -0.5, 1.5, 1.9, 0.7, -1.5, -3.2, -2.7, -0.4, 1.5, 1.5, 0, -0.5,
      -0.3, -0.1,
    ],
  ],
  [
    'indieRock',
    [
      -1.5, -1.5, -1.5, -0.6, -0.4, -1.5, -0.4, 1.7, 2.3, 1.6, 0.5, -0.6, -1.3,
      -1.5, -1.5,
    ],
  ],
  [
    'progressiveRock',
    [-1, 0, 1.5, 1.8, 0.3, -1.8, -2.2, -1.4, -1, -0.4, 0.5, 1.6, 1.4, 1.6, 1.4],
  ],
  [
    'hardRock',
    [0.7, 0.6, 1.7, 1, -1.3, -2.3, -2, -1.5, -0.1, 1.9, 1.8, 0.9, -0.7, -1, -1],
  ],
  [
    'popPunk',
    [
      -0.8, -0.2, 1, 1.3, 0.5, -1.1, -1.8, -1.1, 0.5, 1.1, 0.3, 0.3, 1.1, 0.6,
      0,
    ],
  ],
  [
    'grunge',
    [
      1.8, 1, 1.5, 1.8, 1.2, -0.3, -1.2, -1.4, -1.7, -1.2, -1, -1.8, -2.7, -2.9,
      -3,
    ],
  ],
  [
    'indiePop',
    [
      -0.1, 0, 0.2, 0.8, 0, -1.8, -1.4, 0.6, 1.4, 0.7, -0.5, -0.5, 0.9, 1.6,
      1.9,
    ],
  ],
  [
    'synthPop',
    [
      -1.6, -0.4, 1.5, 1.8, 0, -2.7, -2.8, -0.8, 0.5, 1, 0.8, 0, -0.6, -1.2,
      -1.8,
    ],
  ],
  [
    'kPop',
    [0.2, 0.8, 1.7, 0.5, -1.2, -2.4, -2.2, -1, 0.1, 0.6, 1.3, 1.4, 1, 0, 0],
  ],
  [
    'jPop',
    [
      -0.4, -0.1, 0.4, 0.7, 0.5, -0.6, -0.8, -0.1, 0.7, 0.5, -0.3, -0.3, 0.5,
      0.5, 0.1,
    ],
  ],
  [
    'cPop',
    [
      1.9, 1.2, 1.4, 1.8, 0.8, -1.4, -1.9, -1.4, -1.6, -1.3, 0, 0.5, 0.5, 1.4,
      1.2,
    ],
  ],
  [
    'rnb',
    [
      2.1, 2.1, 1.8, 1.1, 0, -1.6, -2.2, -1.7, -1.2, -1.1, -0.9, -0.2, 1.3, 1.5,
      1.1,
    ],
  ],
  [
    'soul',
    [
      -0.6, 0.7, 1.9, 1.9, 0.4, -1.7, -1.4, 0.1, 0.1, -0.7, -1.7, -2.4, -2.4,
      -2.4, -2.6,
    ],
  ],
  [
    'neoSoul',
    [
      0.9, 1.3, 1.9, 2.1, 1.2, -1, -1.6, -1.5, -2, -1.9, -1.3, -0.9, -0.6, -0.9,
      -1.5,
    ],
  ],
  [
    'funk',
    [
      -1.4, 0, 2.3, 0.9, -1.2, -2, -2.7, -1.6, 1.3, 1.7, 0.5, -0.2, -1.1, -1.8,
      -2.4,
    ],
  ],
  [
    'disco',
    [
      0, 0.7, 2.4, 1.1, -0.9, -1.9, -2.3, -1.8, -1.1, -1.3, -0.5, 1.9, 2.4, 1.4,
      0.1,
    ],
  ],
  [
    'gospel',
    [
      -2.2, -0.2, 2.5, 1.6, -1.3, -3.3, -2.2, 0.3, 0.6, 0.7, 0.6, -0.3, -0.8,
      -0.6, -0.5,
    ],
  ],
  [
    'latin',
    [
      -2.1, -0.3, 2.4, 1, -1.6, -2.7, -2.1, -1, -0.2, 1, 1.7, 0.7, -0.5, -1,
      -1.5,
    ],
  ],
  [
    'reggaeton',
    [3.5, 2.5, 1.5, -0.2, -2, -3, -2.3, -0.8, 0.1, 0.5, 0.8, 1, 0.9, 0.5, -0.1],
  ],
  [
    'salsa',
    [
      -2, -0.5, 1.8, 1.6, -0.6, -2.9, -2.5, 0.2, 1.5, 0.5, -0.1, -0.3, -1, -1.5,
      -2.1,
    ],
  ],
  [
    'bachata',
    [
      2.2, 1.2, 0.9, 0.5, -0.8, -2.1, -1.3, -0.3, 1, 1.1, 0.2, -0.3, -0.8, -1.3,
      -2.2,
    ],
  ],
  [
    'merengue',
    [
      -0.8, 0, 1.5, 1.1, -0.1, -1.9, -1.2, 0.2, 0.8, 0.2, 0.3, -0.7, -0.9, -0.7,
      -1.2,
    ],
  ],
  [
    'cumbia',
    [
      -2.1, -0.3, 1.7, 2, 0.3, -2.5, -1.8, 0.4, 0.2, -0.1, -0.1, -0.6, -1.5,
      -2.2, -2.7,
    ],
  ],
  [
    'bossaNova',
    [
      -2, -0.6, 1.4, 2.5, 1.7, -0.9, -2.5, -2.4, -1.5, -0.4, 0.3, 0.7, 0.6, 0.2,
      -0.3,
    ],
  ],
  [
    'samba',
    [
      -1.3, 0.2, 1.3, 1.5, -1.1, -2.2, -1.5, 0, 0.3, -0.2, 0.4, 1.1, 0.8, -0.6,
      -2,
    ],
  ],
  [
    'flamenco',
    [
      -1.5, -0.9, -0.4, 0.6, 0.9, -0.8, -0.9, -0.1, 1.2, 1.3, 1.1, 0.3, -1.1,
      -1.5, -1.7,
    ],
  ],
  [
    'latinPop',
    [
      0.5, 1, 1.7, 0.2, -2.2, -2.6, -1.6, -0.4, 0.2, 0.9, 1.4, 0.2, -0.3, 0.5,
      0.2,
    ],
  ],
  [
    'regionalMexican',
    [
      -1.7, -0.6, 1.6, 1.6, -0.6, -2.7, -1.7, 1.2, 2.1, -0.4, -0.9, -0.9, -1.4,
      -1.8, -2.1,
    ],
  ],
  [
    'corridos',
    [
      2.1, 1.3, 1.8, 1, -0.9, -2.7, -2, -0.3, 0, 0.5, 0.7, -0.5, -1.4, -1.8,
      -2.1,
    ],
  ],
  [
    'afrobeats',
    [
      3.6, 1.9, 1.6, 1, -0.1, -1.5, -2, -1.6, -1.3, -1, -0.3, 0.6, 1.1, 1.1,
      1.4,
    ],
  ],
  [
    'afrobeat',
    [
      -3.5, -1.1, 1.9, 1.6, -1.5, -4, -1.7, 2.4, 1.7, -0.2, -2.1, -1.2, -0.7,
      -0.2, 0.1,
    ],
  ],
  [
    'amapiano',
    [-1, -0.4, 1.1, 2, 1.1, -1.5, -1.4, -1.2, -1, -0.4, 0, -0.3, 0.8, 0.7, 0],
  ],
  [
    'highlife',
    [
      -1.4, -0.2, 1.3, 0.3, -1.5, -2.1, -1.4, -0.5, -0.2, 1, 1.9, 1.5, 0.3, 0.3,
      0.3,
    ],
  ],
  [
    'dancehall',
    [
      0.3, 1.1, 2.3, 0.2, -2.5, -3.1, -1.7, 0.4, 1.2, 0.6, -0.9, -0.5, 0.1, 0.1,
      -0.2,
    ],
  ],
  [
    'ska',
    [
      -2.5, -0.6, 1.8, 0.3, -2.1, -2.6, -1.6, 0.1, 1.3, 1.5, 1.2, 0.4, -1.2,
      -1.2, -1.5,
    ],
  ],
  [
    'dub',
    [
      3.4, 2.4, 2.8, 1.5, -0.5, -2.5, -3.3, -2.8, -2.1, -1.4, -0.5, 0.4, 0.6,
      0.1, -0.8,
    ],
  ],
  [
    'house',
    [
      0.7, 0.6, 2, 1.9, 0.1, -2.2, -2.1, -0.8, -0.8, -0.6, -0.1, 0.1, -0.6,
      -1.5, -2.5,
    ],
  ],
  [
    'techno',
    [
      0.7, 0.9, 1.6, 0.6, -0.3, -0.6, -1.3, -1.4, -1, -0.5, -0.1, 0.3, 0.3,
      -0.1, -0.8,
    ],
  ],
  [
    'trance',
    [
      1.3, 1.3, 1.5, 0.3, -1.3, -2.2, -1.6, -0.4, 0.1, 0.3, -0.7, 0.6, 1.3, 1.5,
      1.3,
    ],
  ],
  [
    'dubstep',
    [
      -0.2, -0.1, 2.8, 2.1, -0.5, -2.8, -3.1, -2, -1, -0.3, 0.2, 0.7, 0.6, -0.3,
      -1.6,
    ],
  ],
  [
    'rap',
    [
      1.8, 1.2, 0.9, -0.3, -2.2, -2, -0.8, -0.1, 1, 1.4, 1, -0.1, -0.9, -1.1,
      -1.4,
    ],
  ],
  [
    'edm',
    [1, 1.3, 1.7, 0.1, -2.1, -3.3, -2.8, -1.3, -0.5, 0, 1, 2.3, 1.7, 1.7, 1.3],
  ],
  [
    'downtempo',
    [
      2.1, 1.9, 1.8, 1.1, 0.9, 0.2, -1, -1.7, -1.7, -2.2, -2.1, -1.3, -1.2,
      -1.8, -2.6,
    ],
  ],
  [
    'chillout',
    [
      1.6, 1.4, 1.6, 1.6, 0.4, -1.5, -1.1, -0.4, -1.5, -1.8, -1.2, -0.6, 0.8,
      1.4, 1.3,
    ],
  ],
  [
    'bollywood',
    [
      -0.2, 0.3, 1.2, -0.2, -2.3, -3.2, -2.1, 0.2, 1.7, 1.7, 0.8, 0.4, 1, 1.2,
      1.1,
    ],
  ],
  [
    'bhangra',
    [
      0.9, 1.2, 0.7, 0.5, 0.3, -1.6, -2.1, -1.1, 0.3, 1.4, 0.9, -0.2, -0.8,
      -1.4, -1.9,
    ],
  ],
  [
    'indianClassical',
    [
      -1.2, 0.6, 0.7, 0.4, -2, -2.4, 0.3, 2.4, 0.6, -1.2, -1.7, -0.5, 1.2, 1.7,
      1.7,
    ],
  ],
  [
    'arabicPop',
    [
      -1.3, -0.2, 1.4, 1.3, -0.4, -2.6, -3.3, -1.1, 2.4, 2, -0.2, -0.9, -0.1, 0,
      0,
    ],
  ],
  [
    'turkishPop',
    [
      -0.6, 0.3, 1.7, 0.4, -2.3, -3.7, -1.7, 1.5, 1.9, 1.3, 0.2, -1.1, -1.5,
      -1.3, -1,
    ],
  ],
  [
    'world',
    [
      -0.3, -0.2, 0.1, 0.3, 0.1, -0.5, -0.4, 0.1, 0.3, 0.5, 0.6, 0.6, 0.6, 0.6,
      0.6,
    ],
  ],
  [
    'opera',
    [-1, -0.3, 0.3, 0.5, -0.3, -1.4, -1, 1, 1, 0.4, -0.2, 0.4, 0.7, 0.9, 0.9],
  ],
  [
    'newAge',
    [
      0.7, 0.3, 0.2, 0.6, 0.9, 0.4, -0.1, -0.5, -1, -1.2, -1.2, -0.8, 0.2, 0.6,
      0.7,
    ],
  ],
  [
    'christian',
    [
      0.9, 0.9, 1.8, 1.7, 0.1, -2.4, -1.9, -1.4, -1.1, 0.3, 0.7, 0.4, 0.4, 0.3,
      -0.2,
    ],
  ],
  [
    'newWave',
    [
      -1.9, -0.9, 0.7, 0.8, -1, -3.3, -2.3, 0.8, 2.2, 1.4, 0.7, 1, 0.3, 0.5,
      0.5,
    ],
  ],
  [
    'fusion',
    [
      0.6, 0.9, 2.2, 1.3, -1.2, -3.2, -2.3, -0.2, 0.2, -0.2, -0.1, 0.6, 1.4,
      1.4, 1,
    ],
  ],
  [
    'smoothJazz',
    [
      1.8, 1.4, 2.2, 1.6, -0.6, -2.9, -1.8, 0.4, -0.5, -2, -2.1, -0.7, 1.5, 2,
      1.7,
    ],
  ],
];
export const WORLD_GENRE_EQ_PRESETS: readonly IEqPreset[] = STYLES.map(
  ([id, gains]) => ({
    id,
    labelKey: `dsp.eqPreset.${id}`,
    group: 'genre',
    gains: [...gains],
    setup: { subsonicHz: 20, monoBelowHz: 0, phase: 'minimum' },
  }),
);
