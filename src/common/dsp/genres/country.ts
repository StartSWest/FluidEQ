/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { exciterProfile } from '../exciterProfile';
import {
  IGenreRack,
  beatMs,
  ceiling,
  punch,
  sixteenthMs,
  width,
} from '../genreRack';

/**
 * Country, folk and the acoustic styles: a voice and strings, clean.
 *
 * Keep the optional body colour below the strings' air. The factory's
 * high-band excitation generated nonharmonic folds at -33 to -38 dBc in
 * the complete-chain 11 kHz probe with quality Off. The genre EQ already
 * supplies the air without generating frequencies; no hidden oversampling
 * cost is needed. A finished acoustic recording need not gain harmonics.
 */
// 2026-11-04 reference calibration: constant input normalization precedes
// the creative stages and one final Maximizer. Drive is makeup from that
// working level, not a ranking of limiting strength. Exact settings and
// measured limits: docs/dsp/music-reference-audit.json.
const COUNTRY_RACKS: readonly IGenreRack[] = [
  {
    // Two-step, shuffle and waltz at 70-130 BPM, the lyric first. Presence
    // at the consonants and a little air, lighter than it used to be.
    id: 'country',
    normalizer: { mode: 'loudness', targetLufs: -18, truePeakDbtp: -4 },
    deEsser: {
      sensitivity: 0.1,
      lowHz: 5000,
      highHz: 10000,
      rangeDb: 1.5,
      widthOct: 0.5,
      mode: 'spectral',
      attackMs: 2,
      releaseMs: 50,
      centreOnly: true,
      keepCymbals: 0.9,
    },
    exciter: exciterProfile([
      { enabled: false },
      { freqHz: 2_000, range: 0.05, mix: 0.228, texture: 0.15 },
      { enabled: false },
    ]),
    dimension: width(0.8, 1, 1.05, 170, 3_400, 0),
    maximizer: ceiling(5.75, -1, 6, sixteenthMs(105)),
  },
  {
    // Pop production with a steel guitar in it: 808-style kicks already fill
    // the sub, and the masters sit at DR 5-6. Nothing generated, a
    // narrowed bottom, and a ceiling that hardly drives.
    id: 'modernCountry',
    normalizer: { mode: 'loudness', targetLufs: -18, truePeakDbtp: -5.5 },
    deEsser: {
      sensitivity: 0.1,
      lowHz: 5000,
      highHz: 10000,
      rangeDb: 1.5,
      widthOct: 0.5,
      mode: 'spectral',
      attackMs: 2,
      releaseMs: 50,
      centreOnly: true,
      keepCymbals: 0.9,
    },
    dimension: width(0.6, 1, 1.1, 150, 3_200, 0),
    maximizer: ceiling(7, -1, 3, sixteenthMs(100)),
  },
  {
    // A band in one room, often to tape, with the dynamics left in (DR
    // 7-12). Warmth and a touch of air, and a slow ceiling.
    id: 'americana',
    normalizer: { mode: 'loudness', targetLufs: -18, truePeakDbtp: -3.5 },
    deEsser: {
      sensitivity: 0.1,
      lowHz: 5000,
      highHz: 10000,
      rangeDb: 1.5,
      widthOct: 0.5,
      mode: 'spectral',
      attackMs: 2,
      releaseMs: 50,
      centreOnly: true,
      keepCymbals: 0.9,
    },
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.12, focusHz: 350, range: 0.3 },
    ),
    dimension: width(0.85, 1, 1, 180, 3_400, 0),
    maximizer: ceiling(5, -1, 10, beatMs(95)),
  },
  {
    // No drums at all: the upright bass is the whole bottom and the picking
    // is the rhythm. Air over the banjo and mandolin, and nothing that could
    // flatten a pick attack.
    id: 'bluegrass',
    normalizer: { mode: 'loudness', targetLufs: -18, truePeakDbtp: -3 },
    deEsser: {
      sensitivity: 0.1,
      lowHz: 5000,
      highHz: 10000,
      rangeDb: 1.5,
      widthOct: 0.5,
      mode: 'spectral',
      attackMs: 2,
      releaseMs: 50,
      centreOnly: true,
      keepCymbals: 0.9,
    },
    dimension: width(0.9, 1, 1, 180, 3_400, 0),
    maximizer: ceiling(4.75, -1, 10, beatMs(130)),
  },
  {
    // Minimal and natural: a gentle presence near 2 kHz, air above 7, and
    // the small share of added harmonics folk mastering itself uses.
    id: 'folk',
    normalizer: { mode: 'loudness', targetLufs: -18, truePeakDbtp: -4 },
    deEsser: {
      sensitivity: 0.1,
      lowHz: 5000,
      highHz: 10000,
      rangeDb: 1.5,
      widthOct: 0.5,
      mode: 'spectral',
      attackMs: 2,
      releaseMs: 50,
      centreOnly: true,
      keepCymbals: 0.9,
    },
    exciter: exciterProfile(
      [
        { enabled: false },
        { freqHz: 2_000, range: 0.05, mix: 0.19, texture: 0.15 },
        { enabled: false },
      ],
      { enabled: true, amount: 0.08, focusHz: 250, range: 0.3 },
    ),
    dimension: width(0.9, 1, 1, 180, 3_500, 0),
    maximizer: ceiling(5.75, -1, 10, beatMs(100)),
  },
  {
    // A guitar's body and its strings: body at the soundboard, air above
    // 10 kHz, and no limiting to speak of. Its old Bass Punch profile is
    // offered, not used: the guitar has no kick to shape.
    id: 'acoustic',
    normalizer: { mode: 'loudness', targetLufs: -18, truePeakDbtp: -4 },
    deEsser: {
      sensitivity: 0.1,
      lowHz: 5000,
      highHz: 10000,
      rangeDb: 1.5,
      widthOct: 0.5,
      mode: 'spectral',
      attackMs: 2,
      releaseMs: 50,
      centreOnly: true,
      keepCymbals: 0.9,
    },
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 220, range: 0.3 },
    ),
    bassPunch: punch(90, -0.1, -0.25, 0.05, 80, 0.05),
    dimension: width(0.9, 1, 1, 180, 3_500, 0),
    maximizer: ceiling(5.5, -1, 10, beatMs(100)),
    offered: ['bassPunch'],
  },
  {
    // A voice and one instrument, intimate. Only body, never harmonics on
    // the sibilants, and the mids a shade narrower to keep the voice centred.
    id: 'singerSongwriter',
    normalizer: { mode: 'loudness', targetLufs: -18, truePeakDbtp: -5 },
    deEsser: {
      sensitivity: 0.1,
      lowHz: 5000,
      highHz: 10000,
      rangeDb: 1.5,
      widthOct: 0.5,
      mode: 'spectral',
      attackMs: 2,
      releaseMs: 50,
      centreOnly: true,
      keepCymbals: 0.9,
    },
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.08, focusHz: 300, range: 0.3 },
    ),
    dimension: width(0.85, 0.95, 1, 180, 3_600, 0),
    maximizer: ceiling(7, -1, 8, beatMs(90)),
  },
];

export default COUNTRY_RACKS;
