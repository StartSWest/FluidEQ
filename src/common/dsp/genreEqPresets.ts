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
 *   model's bands. Held again on 2026-09-24 against the genre notes, which
 *   quote that research to the listener: EDM's and techno's sub, K-pop's
 *   under 50 Hz, the dhol's boom, bachata's 3 kHz and opera's bass were
 *   still lifted by up to 1.7 dB. Each is now level or under there, as the
 *   pins read it, and the loudness that took is not paid back elsewhere.
 *
 * Re-tune a row by measuring its chain again, not by hand: a hand edit moves
 * its loudness and its distance from its neighbours with it.
 */
const STYLES: readonly (readonly [string, readonly number[]])[] = [
  [
    'modernCountry',
    [
      -1.7, -0.5, 1.6, 1.79, 0.1, -2.35, -1.07, -1.61, -0.48, 0.59, 0.9, 0.7,
      0.3, 0.6, 0.4,
    ],
  ],
  [
    'folk',
    [-0.8, -0.6, -0.5, 0, 0.6, 0.4, -0.3, -0.6, -0.3, 0.6, 1, 0.8, 0.5, 0.8, 1],
  ],
  [
    'bluegrass',
    [
      -0.8, -0.9, -1.1, -0.8, -0.2, -0.1, -0.2, -0.29, -0.19, 0.52, 0.75, 0.69,
      0.66, 0.58, 0.89,
    ],
  ],
  [
    'americana',
    [
      -1.7, -0.9, 0.49, 1.87, 1.25, -0.4, -1.27, -0.82, -1.05, 0.95, 1.21,
      -0.31, -0.5, 0.2, 0.3,
    ],
  ],
  [
    'singerSongwriter',
    [
      -1, -0.9, -1.2, -0.6, 0.1, -0.09, -0.81, 0.04, 0.91, 0.75, 0.81, -0.71,
      0.21, 0.9, 1.1,
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
      -1.6, -0.5, 1.5, 1.88, 0.7, -1.97, -1.25, -1.32, -0.84, 1.5, 1.48, 0,
      -0.5, -0.3, -0.1,
    ],
  ],
  [
    'indieRock',
    [
      -0.96, -0.96, -0.96, -0.38, -0.26, -0.95, -0.25, 1.3, 0.54, 0.74, 0.44,
      -0.38, -0.82, -0.96, -0.96,
    ],
  ],
  [
    'progressiveRock',
    [
      -1, 0, 1.5, 1.79, 0.3, -2.02, -1.2, -1.1, -1.12, -0.4, 0.5, 1.6, 1.4, 1.6,
      1.4,
    ],
  ],
  [
    'hardRock',
    [
      0.7, 0.6, 1.69, 1, -1.58, -1.26, -1.27, -1.41, -0.18, 1.9, 1.8, 0.9, -0.7,
      -1, -1,
    ],
  ],
  [
    'popPunk',
    [
      -0.8, -0.2, 1, 1.3, 0.51, -1.19, -1.42, -1.19, 0.51, 1.1, 0.3, 0.3, 1.1,
      0.6, 0,
    ],
  ],
  [
    'grunge',
    [
      1.8, 1.01, 1.49, 1.61, 1.25, -0.3, -1.2, -1.4, -1.71, -1.22, -1.24, -1.02,
      -1.4, -0.96, -2.34,
    ],
  ],
  [
    'indiePop',
    [
      -0.1, 0, 0.2, 0.8, 0, -1.8, -1.4, 0.6, 1.4, 0.7, -0.49, -0.5, 1.18, 0.51,
      1.34,
    ],
  ],
  [
    'synthPop',
    [
      -1.6, -0.4, 1.49, 1.81, -0.37, -1.57, -1.37, -1.2, 0.51, 0.99, 0.8, 0,
      -0.6, -1.2, -1.8,
    ],
  ],
  [
    // 2026-11-04, Dynamite and How You Like That (official Apple previews):
    // the former 2.4/2.2 dB low-mid cuts removed vocal body while 3-8 kHz
    // gained over a decibel in the full chain. Smaller moves retain that
    // body and the records' sheen. Kick weight at 80-125 Hz gives this
    // listening voicing an audible character without vocal-band harmonics.
    // Upper mids stay near flat and 8 kHz is eased to avoid glare on the
    // stacked vocals. The nearly flat sub compensates only for the 80 Hz
    // bell's skirt; it adds no new sub. See iZotope's gain-matched whole-mix
    // guidance, not a purported genre EQ standard:
    // https://www.izotope.com/community/blog/how-to-eq-your-master
    'kPop',
    [-0.1, -0.35, 2, 0.9, -0.5, -1.1, -0.9, -0.3, 0, 0.1, 0, 0, -0.2, 0, 0],
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
      1.9, 1.2, 1.4, 1.8, 0.8, -1.41, -1.91, -1.62, -0.47, -0.96, -0.14, 0.5,
      0.64, 0.59, 1.74,
    ],
  ],
  [
    // Fitted 2026-09-25 to what the research says a ballad master leans:
    // its bottom and top as the production left them (tracks with little
    // percussion carry less bass and treble, and that is the production —
    // Elowsson & Friberg, 12,345 tracks), the voice's warmth at 125 Hz and
    // presence at 3 kHz up a little, the low-mid mud a piano and a close
    // vocal pile up eased, and the sibilance a close vocal carries around
    // 8 kHz eased rather than brightened. Nearest played row 1.4 dB away.
    'ballad',
    [
      -1.4, 0, 0.1, 0.8, 0.5, -1.1, -1.3, -0.4, -0.2, 0.56, 0.97, 0.66, -1.5,
      0.3, -0.2,
    ],
  ],
  [
    'rnb',
    [
      2.1, 2.1, 1.8, 1.1, -0.09, -1.51, -1.32, -0.98, -0.62, -0.77, -0.9, -0.23,
      1.46, 0.44, 1.81,
    ],
  ],
  [
    'soul',
    [
      -0.6, 0.7, 1.9, 1.9, 0.4, -1.7, -1.4, 0.09, 0.09, -1.03, -0.59, -1.02,
      -1.45, -0.96, -2.32,
    ],
  ],
  [
    'neoSoul',
    [
      0.9, 1.3, 1.9, 2.1, 1.2, -1.1, -1.46, -0.98, -0.63, -0.75, -0.68, -0.87,
      -0.68, -0.9, -1.51,
    ],
  ],
  [
    'funk',
    [
      -1.4, 0, 2.29, 0.9, -1.45, -1.28, -1.27, -1.97, 1.31, 1.69, 0.5, -0.2,
      -1.1, -1.8, -2.4,
    ],
  ],
  [
    'disco',
    [
      0, 0.81, 1.91, 1.22, -1.12, -1.35, -1.31, -0.99, -0.61, -0.96, -0.34,
      1.13, 0.72, 0.77, 0.79,
    ],
  ],
  [
    'gospel',
    [
      -2.2, -0.2, 2.48, 1.59, -1.84, -0.93, -1.26, -0.05, 0.61, 0.69, 0.6, -0.3,
      -0.8, -0.6, -0.5,
    ],
  ],
  [
    'latin',
    [
      -2.1, -0.3, 2.4, 0.92, -1.66, -1.24, -1.3, -1.26, -0.2, 1.17, 0.82, 0.9,
      -0.51, -0.99, -1.5,
    ],
  ],
  [
    'reggaeton',
    [
      3, 1.46, 1.75, -0.44, -1.6, -1.17, -1.34, -1.13, 0.11, 0.49, 0.8, 1.03,
      0.75, 0.54, -0.11,
    ],
  ],
  [
    'salsa',
    [
      -2, -0.5, 1.79, 1.61, -0.98, -1.25, -2.86, 0.21, 1.49, 0.5, -0.1, -0.3,
      -1, -1.5, -2.1,
    ],
  ],
  [
    'bachata',
    [
      2.2, 1.2, 0.9, 0.5, -0.8, -2.1, -1.3, -0.3, 1.1, 0.9, -0.1, -0.5, -0.8,
      -1.3, -2.2,
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
      -2.1, -0.3, 1.7, 2, 0.3, -2.5, -1.8, 0.4, 0.2, -0.1, -0.11, -0.6, -1.82,
      -0.91, -2.35,
    ],
  ],
  [
    'bossaNova',
    [
      -2, -0.6, 1.4, 2.49, 1.7, -1.29, -1.13, -0.83, -0.68, -0.68, 0.3, 0.69,
      0.6, 0.2, -0.3,
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
      -1.5, -0.9, -0.4, 0.6, 0.9, -0.8, -0.9, -0.1, 1.2, 1.3, 1.09, 0.3, -1.25,
      -0.69, -2.24,
    ],
  ],
  [
    'latinPop',
    [
      0.5, 0.99, 1.71, -0.03, -1.67, -1.11, -1.98, -0.39, 0.19, 0.9, 1.4, 0.2,
      -0.3, 0.5, 0.2,
    ],
  ],
  [
    'regionalMexican',
    [
      -1.7, -0.6, 1.59, 1.62, -0.9, -1.48, -1.97, 1.21, 2.09, -0.4, -0.94,
      -0.71, -1.61, -0.93, -2.67,
    ],
  ],
  [
    'corridos',
    [
      2.1, 1.3, 1.79, 1.01, -1.24, -1.36, -1.42, -0.51, 0.01, 0.49, 0.69, -0.5,
      -1.55, -0.99, -2.63,
    ],
  ],
  [
    'afrobeats',
    [
      3, 1.9, 1.6, 1, -0.17, -1.46, -1.33, -0.98, -0.63, -0.91, -0.38, 0.6, 1.1,
      1.1, 1.4,
    ],
  ],
  [
    'afrobeat',
    [
      -3.5, -1.1, 1.88, 1.59, -2.1, -0.85, -2.41, 2.56, 0.72, -0.27, -0.77,
      -1.48, -0.69, -0.21, 0.1,
    ],
  ],
  [
    'amapiano',
    [-1, -0.4, 1.1, 2, 1.1, -1.5, -1.4, -1.2, -1, -0.4, 0, -0.3, 0.8, 0.7, 0],
  ],
  [
    'highlife',
    [
      -1.4, -0.2, 1.29, 0.3, -1.77, -0.83, -1.07, -0.64, -0.2, 1.28, 0.43, 1.82,
      0.29, 0.31, 0.3,
    ],
  ],
  [
    'dancehall',
    [
      0.3, 1.1, 2.29, 0.19, -2.9, -0.89, -2.21, 0.42, 1.18, 0.6, -0.9, -0.5,
      0.1, 0.1, -0.2,
    ],
  ],
  [
    'ska',
    [
      -2.5, -0.61, 1.81, 0.1, -1.66, -1.2, -1.54, 0, 1.3, 1.49, 1.2, 0.4, -1.2,
      -1.2, -1.5,
    ],
  ],
  [
    'dub',
    [
      0.5, 0.4, 0.46, 0.26, -0.15, -0.24, -0.22, -0.17, -0.11, -0.14, -0.13,
      0.06, 0.1, 0.02, -0.14,
    ],
  ],
  [
    'house',
    [
      0.7, 0.6, 2, 1.89, 0.1, -2.38, -1.12, -1.06, -0.64, -0.65, -0.1, 0.1,
      -0.71, -1.15, -2.36,
    ],
  ],
  [
    'techno',
    [
      -0.8, -0.6, 1.1, 0.9, -0.3, -0.6, -1.3, -1.4, -1, -0.5, -0.1, 0.3, 0.3,
      -0.1, -0.8,
    ],
  ],
  [
    'trance',
    [
      1.3, 1.3, 1.49, 0.31, -1.52, -1.18, -1.83, -0.39, 0.09, 0.31, -0.7, 0.77,
      0.81, 0.56, 1.27,
    ],
  ],
  [
    'dubstep',
    [
      -0.2, -0.1, 2.78, 2.1, -0.94, -1.48, -1.32, -0.99, -0.74, -0.46, 0.2,
      0.69, 0.6, -0.3, -1.6,
    ],
  ],
  [
    'rap',
    [
      1.8, 1.19, 0.91, -0.51, -1.57, -1.29, -1.01, -0.09, 0.99, 1.4, 1, -0.1,
      -0.9, -1.1, -1.4,
    ],
  ],
  [
    'edm',
    [
      -0.7, -0.41, 1, 0.23, -1.67, -1.16, -1.31, -1.05, -0.66, 0.11, 0.94, 0.79,
      0.73, 0.56, 1.25,
    ],
  ],
  [
    'downtempo',
    [
      2.1, 1.9, 1.8, 1.1, 0.89, 0.2, -1.26, -1.08, -0.62, -0.76, -0.61, -0.99,
      -1.42, -0.96, -2.35,
    ],
  ],
  [
    'chillout',
    [
      1.6, 1.4, 1.6, 1.6, 0.4, -1.51, -1.1, -0.63, -0.75, -0.75, -0.83, -0.76,
      0.99, 0.61, 1.28,
    ],
  ],
  [
    'bollywood',
    [
      -0.2, 0.29, 1.21, -0.51, -1.56, -1.05, -2.65, 0.44, 1.02, 0.76, 0.76,
      0.57, 0.75, 0.56, 1.25,
    ],
  ],
  [
    'bhangra',
    [
      0.6, -0.3, -0.2, 0.1, 0.4, -1.6, -2.1, -1.1, 0.3, 1.4, 0.9, -0.2, -0.8,
      -1.4, -1.9,
    ],
  ],
  [
    'indianClassical',
    [
      -1.2, 0.6, 0.67, 0.04, -0.98, -0.67, 0.2, 0.73, 0.64, -0.77, -0.57, -0.54,
      0.77, 0.34, 0.91,
    ],
  ],
  [
    'arabicPop',
    [
      -1.3, -0.2, 1.39, 1.31, -0.78, -1.45, -1.43, -1.28, 1.38, 1.01, 0.09,
      -0.91, -0.09, 0, 0,
    ],
  ],
  [
    'turkishPop',
    [
      -0.6, 0.3, 1.69, 0.39, -2.8, -0.98, -2.32, 1.78, 0.71, 0.98, 0.34, -1.1,
      -1.49, -1.3, -1,
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
    [
      -0.9, -0.5, 0.09, 0.1, -0.39, -0.57, -0.75, 0.74, 0.53, 0.52, -0.21, 0.48,
      0.5, 0.36, 0.83,
    ],
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
      0.72, 0.84, 0.9, 1.49, 0.07, -1.92, -1.52, -1.12, -0.88, 0.24, 0.56, 0.32,
      0.32, 0.24, -0.16,
    ],
  ],
  [
    'newWave',
    [
      -1.9, -0.9, 0.69, 0.8, -1.47, -1.28, -1.77, 0.87, 0.75, 1.7, 0.69, 1.01,
      0.3, 0.5, 0.5,
    ],
  ],
  [
    'fusion',
    [
      0.6, 1.09, 1.29, 1.51, -1.74, -0.92, -1.13, -0.59, 0.21, -0.21, -0.1,
      0.78, 0.69, 0.51, 1.12,
    ],
  ],
  [
    'smoothJazz',
    [
      1.83, 1.14, 1.16, 1.57, -0.94, -0.97, -2.24, 0.42, -0.85, -0.67, -0.78,
      -0.88, 1.08, 0.5, 1.2,
    ],
  ],
];

/**
 * Where a row's research says its low end is mono, the corner that makes it
 * so (the rack's mono-maker, a second-order high pass on the side). The
 * chain's Dimension narrows the same region to half its width at most, and
 * through a one-pole split, so on its own it left most of the side at 50 Hz
 * — while every one of these genres is mixed with nothing there at all: a club
 * or a sound system sums everything under about 150 Hz, and a sine sub or
 * an 808 is mixed in the middle. At 150 where the research names the club
 * low end, at 120 where it names the sub (dubstep, dancehall, the log
 * drum's sub, the tuba and 808 of corridos) or says so (trance).
 */
const MONO_BELOW_HZ: Readonly<Record<string, number>> = {
  edm: 150,
  house: 150,
  techno: 150,
  trance: 120,
  dubstep: 120,
  afrobeats: 150,
  amapiano: 120,
  reggaeton: 150,
  latinPop: 150,
  dub: 150,
  dancehall: 120,
  corridos: 120,
};
export const WORLD_GENRE_EQ_PRESETS: readonly IEqPreset[] = STYLES.map(
  ([id, gains]) => ({
    id,
    labelKey: `dsp.eqPreset.${id}`,
    group: 'genre',
    gains: [...gains],
    setup: {
      subsonicHz: 20,
      monoBelowHz: MONO_BELOW_HZ[id] ?? 0,
      phase: 'minimum',
    },
  }),
);
