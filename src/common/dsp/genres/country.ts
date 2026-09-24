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
 * These are the one family where the mastering literature asks for
 * harmonics — "harmonic excitement" of what is there for traditional
 * country, one or two percent of added harmonics to fill folk's gaps, mild
 * enhancement for an acoustic guitar — so the Exciter is on here, and quiet:
 * air an octave above the strings' own, a little body where the guitar's
 * soundboard is. Modern country is the exception: a pop record with an 808
 * under it, and treated as one. Nothing here widens: a band recorded in one
 * room, or a voice with one guitar, is already the width it should be.
 */
const COUNTRY_RACKS: readonly IGenreRack[] = [
  {
    // Two-step, shuffle and waltz at 70-130 BPM, the lyric first. Presence
    // at the consonants and a little air, lighter than it used to be.
    id: 'country',
    exciter: exciterProfile([
      { enabled: false },
      { freqHz: 2_000, mix: 0.12, texture: 0.15 },
      { freqHz: 8_000, range: 0.22, drive: 2.3, mix: 0.2, texture: 0.5 },
    ]),
    dimension: width(0.8, 1, 1.05, 170, 3_400, 0.05),
    maximizer: ceiling(1.25, -1, 6, sixteenthMs(105)),
  },
  {
    // Pop production with a steel guitar in it: 808-style kicks already fill
    // the sub, and the masters sit at DR 5-6. Nothing generated, a mono
    // bottom, and a ceiling that hardly drives.
    id: 'modernCountry',
    dimension: width(0.6, 1, 1.1, 150, 3_200, 0.1),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(100)),
  },
  {
    // A band in one room, often to tape, with the dynamics left in (DR
    // 7-12). Warmth and a touch of air, and a slow ceiling.
    id: 'americana',
    exciter: exciterProfile(
      [
        { enabled: false },
        { enabled: false },
        { freqHz: 8_500, range: 0.22, drive: 2.25, mix: 0.15, texture: 0.5 },
      ],
      { enabled: true, amount: 0.12, focusHz: 350, range: 0.3 },
    ),
    dimension: width(0.85, 1, 1, 180, 3_400, 0),
    maximizer: ceiling(1.25, -1, 10, beatMs(95)),
  },
  {
    // No drums at all: the upright bass is the whole bottom and the picking
    // is the rhythm. Air over the banjo and mandolin, and nothing that could
    // flatten a pick attack.
    id: 'bluegrass',
    exciter: exciterProfile([
      { enabled: false },
      { enabled: false },
      { freqHz: 8_500, range: 0.22, drive: 2.3, mix: 0.18, texture: 0.5 },
    ]),
    dimension: width(0.9, 1, 1, 180, 3_400, 0.05),
    maximizer: ceiling(1.25, -1, 10, beatMs(130)),
  },
  {
    // Minimal and natural: a gentle presence near 2 kHz, air above 7, and
    // the small share of added harmonics folk mastering itself uses.
    id: 'folk',
    exciter: exciterProfile(
      [
        { enabled: false },
        { freqHz: 2_000, mix: 0.1, texture: 0.15 },
        { freqHz: 7_500, range: 0.22, drive: 2.25, mix: 0.18, texture: 0.5 },
      ],
      { enabled: true, amount: 0.08, focusHz: 250, range: 0.3 },
    ),
    dimension: width(0.9, 1, 1, 180, 3_500, 0.05),
    maximizer: ceiling(1.25, -1, 10, beatMs(100)),
  },
  {
    // A guitar's body and its strings: body at the soundboard, air above
    // 10 kHz, and no limiting to speak of. Its old Bass Punch profile is
    // offered, not used: the guitar has no kick to shape.
    id: 'acoustic',
    exciter: exciterProfile(
      [
        { enabled: false },
        { enabled: false },
        { freqHz: 10_000, range: 0.2, drive: 2.25, mix: 0.18, texture: 0.5 },
      ],
      { enabled: true, amount: 0.1, focusHz: 220, range: 0.3 },
    ),
    bassPunch: punch(90, -0.1, -0.25, 0.05, 80, 0.05),
    dimension: width(0.9, 1, 1, 180, 3_500, 0.05),
    maximizer: ceiling(1.25, -1, 10, beatMs(100)),
    offered: ['bassPunch'],
  },
  {
    // A voice and one instrument, intimate. Only body, never harmonics on
    // the sibilants, and the mids a shade narrower to keep the voice centred.
    id: 'singerSongwriter',
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.08, focusHz: 300, range: 0.3 },
    ),
    dimension: width(0.85, 0.95, 1, 180, 3_600, 0.05),
    maximizer: ceiling(1.25, -1, 8, beatMs(90)),
  },
];

export default COUNTRY_RACKS;
