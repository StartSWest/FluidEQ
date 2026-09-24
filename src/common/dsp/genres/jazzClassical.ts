/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { exciterProfile } from '../exciterProfile';
import { IGenreRack, beatMs, ceiling, punch, width } from '../genreRack';

/**
 * Jazz, the blues, and music recorded in a hall.
 *
 * The quietest and most dynamic records anybody owns: jazz at a median of
 * -12.8 LUFS with ten LU of range, a classical recording at -16 to -20 with
 * fifteen to twenty, mastered with half a decibel of compression at most.
 * Every source the research found says the same about playing them back —
 * do not compress, limit, excite, widen or add bass — so these rows are the
 * lightest in the catalogue: the ceiling touches only a stray peak, over a
 * whole beat, and the concert-hall rows leave the picture alone entirely
 * (no Dimension at all: the hall is the recording). What they do add is for
 * the old records: a little warmth where a transfer is thin, and a shade of
 * narrowing for the hard-panned stereo of 1950s-60s jazz, which crossfeed
 * exists to fix on headphones.
 */
const JAZZ_CLASSICAL_RACKS: readonly IGenreRack[] = [
  {
    // Upright bass, a feathered kick and the ride cymbal's air, panned hard
    // on the classic Blue Note records. Its old Exciter is offered, not
    // used: added harmonics colour horns and piano audibly.
    id: 'jazz',
    exciter: exciterProfile(
      [{ mix: 0.07 }, { mix: 0.11 }, { mix: 0.16, texture: 0.5 }],
      { enabled: true, amount: 0.16, focusHz: 450, range: 0.35 },
    ),
    dimension: width(0.95, 0.9, 0.9, 150, 3_000, 0),
    maximizer: ceiling(0.75, -1, 12, beatMs(120)),
    offered: ['exciter'],
  },
  {
    // Glossy studio stereo, a soft top and the saxophone in front. Warmth,
    // never presence on the sax, and no punch: the genre is soft on purpose.
    id: 'smoothJazz',
    // Offered under its name and not played: no presence or excitement on the
    // sax.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 350, range: 0.3 },
    ),
    dimension: width(0.75, 1, 1, 170, 3_400, 0.05),
    maximizer: ceiling(1.25, -1, 8, beatMs(98)),
    offered: ['exciter'],
  },
  {
    // Electric, bright and virtuosic, its fills and unison runs the point.
    // Nothing added to the harmonics of instruments that make their own.
    id: 'fusion',
    dimension: width(0.85, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(1, -1, 10, beatMs(130)),
  },
  {
    // Raw and mid-forward, the classic records mono. Body for a thin
    // transfer, a shade of narrowing, and no harmonics on overdrive that is
    // already the sound.
    id: 'blues',
    // Offered under its name and not played: the overdrive is the sound;
    // nothing is added to it.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.12, focusHz: 300, range: 0.3 },
    ),
    dimension: width(0.85, 0.95, 0.95, 180, 3_200, 0),
    maximizer: ceiling(1, -1, 10, beatMs(90)),
    offered: ['exciter'],
  },
  {
    // The widest dynamics of any genre, peaks near -1 dBTP on a record whose
    // average sits fifteen to twenty decibels below them. A ceiling and half
    // a decibel, over the longest look-ahead and release the stage has, so a
    // crescendo is never what it holds down. Its Exciter and Bass Punch
    // profiles are offered and left off.
    id: 'classical',
    exciter: exciterProfile([
      { mix: 0.035 },
      { mix: 0.065 },
      { freqHz: 8_500, drive: 2.25, mix: 0.15, texture: 0.52 },
    ]),
    bassPunch: punch(90, -0.1, -0.25, 0.05, 80, 0.05),
    maximizer: ceiling(0.5, -1, 16, beatMs(70)),
    offered: ['exciter', 'bassPunch'],
  },
  {
    // Timpani and the gran cassa are the rare peaks that set a whole
    // recording's gain: they pass untouched, and nothing boosts the bass
    // they would overload.
    id: 'orchestra',
    maximizer: ceiling(0.5, -1, 16, beatMs(66)),
  },
  {
    // A voice whose formant already projects over an orchestra at 2.4-3.1
    // kHz, and Nilsson-loud top notes. Nothing lifted there, nothing held.
    id: 'opera',
    maximizer: ceiling(0.5, -1, 16, beatMs(70)),
  },
  {
    // One of the most revealing sources there is: a limiter flattens the
    // hammer and lifts the decay, and harmonics turn chords to grit.
    id: 'piano',
    maximizer: ceiling(0.5, -1, 16, beatMs(76)),
  },
  {
    // Bowed strings are rich in harmonics already, and hard with presence
    // added. A ceiling only.
    id: 'strings',
    maximizer: ceiling(0.5, -1, 16, beatMs(72)),
  },
];

export default JAZZ_CLASSICAL_RACKS;
