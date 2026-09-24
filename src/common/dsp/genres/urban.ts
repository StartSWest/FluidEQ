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
  forge,
  punch,
  sixteenthMs,
  width,
} from '../genreRack';

/**
 * Hip-hop, R&B, soul and the dance music that came out of soul.
 *
 * Two families that ask for opposite things. Hip-hop and its descendants
 * are the narrowest mixes in the charts, the voice and the 808 in the
 * middle, the samples and 808s already saturated on purpose: the one thing
 * playback adds is trap's octave above an 808 that a phone speaker cannot
 * play — never more sub under one that has it, and no more grit on a record
 * made of it. Their curves carry the bass support. Soul, funk and disco were
 * recorded to tape by bands and mastered with room (-12 to -16 LUFS on the
 * originals): warmth is welcome, air and harmonics are not — they lift the
 * tape hiss — and the 60s stereo mixes, panned hard left, centre and right,
 * are narrowed a shade rather than widened.
 */
const URBAN_RACKS: readonly IGenreRack[] = [
  {
    // Boom bap at 85-95 BPM, a hard short kick and the voice on top, older
    // records thin below 50 Hz — which the curve's sub lifts. Forge is
    // offered and left off with the Exciter and Bass Punch: the samples,
    // the vinyl and the 808s are saturated already, and its octave and
    // harmonics came to 16% of a bass note (2026-09-23).
    id: 'hiphop',
    exciter: exciterProfile(
      [
        { freqHz: 65, drive: 2.15, mix: 0.26, texture: 0.03 },
        { mix: 0.15 },
        { drive: 2.35, mix: 0.19, texture: 0.5 },
      ],
      { enabled: true, amount: 0.18, focusHz: 150, range: 0.25 },
      { enabled: true, amount: 0.2 },
    ),
    bassForge: forge(100, 0, 0.5, 0.8, 0.9, 0.35),
    bassPunch: punch(110, 0.65, 0.15, 0.15, 100, 0.45),
    dimension: width(0.5, 1, 1, 180, 3_500, 0.05),
    maximizer: ceiling(0.75, -1, 3, sixteenthMs(92)),
    offered: ['exciter', 'bassForge', 'bassPunch'],
  },
  {
    // The voice is the product: centred, dry, intelligible, and the mids a
    // shade narrower than the record to hold it still. Forge is offered and
    // left off: the harmonics of a bass land on the chest of the voice,
    // which is the one place bass may not go.
    id: 'rap',
    bassForge: forge(100, 0, 0.35, 0.7, 0.9, 0.3),
    dimension: width(0.5, 0.95, 1, 180, 3_500, 0.05),
    maximizer: ceiling(0.75, -1, 3, sixteenthMs(95)),
    offered: ['bassForge'],
  },
  {
    // A long 808 at 30-60 Hz already distorted so a phone can hear it, under
    // hats in triple-time rolls at a counted 140. Its sub is not boosted:
    // what helps is the harmonic ladder over it — 80, 120, 160 Hz of a 40 Hz
    // note — which is presence, not sub, so Forge's octave below is at
    // nought. Everything under 120 Hz mono.
    id: 'trap',
    bassForge: forge(80, 0, 0, 1, 0.95, 0.4),
    dimension: width(0.5, 1, 1.1, 120, 3_000, 0.1),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(140)),
  },
  {
    // A silky top and a centred, intimate voice over a round bottom. Warmth
    // only — an exciter on this vocal lands on its breaths — and the pads a
    // little wider than the voice, which is how the genre is mixed.
    id: 'rnb',
    // Offered under its name and not played: no exciter on the vocal, which is
    // the record.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.12, focusHz: 350, range: 0.32 },
    ),
    dimension: width(0.6, 1, 1.15, 160, 3_400, 0.12),
    maximizer: ceiling(1, -1, 5, sixteenthMs(90)),
    offered: ['exciter'],
  },
  {
    // Tape, tubes and a live band, the stereo mixes panned hard in the 60s.
    // Warmth, a shade of narrowing, and a slow ceiling for masters that were
    // never limited.
    id: 'soul',
    // Offered under its name and not played: tape and tube are the sound, and
    // an exciter raises their hiss.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.15, focusHz: 380, range: 0.32 },
    ),
    dimension: width(0.8, 0.92, 0.95, 180, 3_400, 0),
    maximizer: ceiling(1.25, -1, 10, beatMs(96)),
    offered: ['exciter'],
  },
  {
    // A live, drunk-feeling pocket of ghost notes and Rhodes: warm, nothing
    // added to the hits, and nothing squeezing them.
    id: 'neoSoul',
    // Offered under its name and not played: warm and dark is the brief, and no
    // exciter keeps it so.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.12, focusHz: 330, range: 0.32 },
    ),
    dimension: width(0.75, 1, 1, 170, 3_400, 0.05),
    maximizer: ceiling(1, -1, 8, beatMs(80)),
    offered: ['exciter'],
  },
  {
    // The bass guitar is the lead and the one is everything: a tight low end
    // under slapped bass and a muffled kick, with no bloom to smear the
    // articulation. Dry and mid-forward, never brightened.
    id: 'funk',
    bassPunch: punch(110, 0.2, -0.4, 0, 50, 0),
    dimension: width(0.75, 1, 1.05, 170, 3_200, 0.05),
    maximizer: ceiling(1, -1, 6, sixteenthMs(112)),
  },
  {
    // Four on the floor at about 122 BPM under a wall of strings that is
    // wide already. A little weight in the kick, its tail kept short of the
    // next beat, and no widening of what the orchestra spread.
    id: 'disco',
    bassPunch: punch(110, 0.25, -0.2, 0.08, 90, 0.2),
    dimension: width(0.7, 1, 1, 170, 3_200, 0.05),
    maximizer: ceiling(1, -1, 6, sixteenthMs(122)),
  },
];

export default URBAN_RACKS;
