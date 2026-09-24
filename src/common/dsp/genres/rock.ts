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
 * Rock and the styles that grew out of it.
 *
 * Distorted guitars already make their own harmonics, and more of them land
 * in the fizz band, so no row switches an Exciter on. The guitars are
 * double-tracked hard left and right by the mix, so no row widens the mids
 * either — widening them only pushes the guitars past the voice. What rock
 * wants from playback is its kick and snare intact (a limiter "undeniably
 * truncates transients"), a bottom that cannot cancel, and, on the classic
 * records, the dynamics their original masters had (DR 11-14, against 9 for
 * the remasters).
 */
const ROCK_RACKS: readonly IGenreRack[] = [
  {
    // 110-140 BPM on a backbeat. Its Exciter and Forge are offered under
    // Rock's name and left off: the guitars have harmonics enough, and the
    // bass guitar has a real bottom.
    id: 'rock',
    exciter: exciterProfile(
      [
        { freqHz: 90, range: 0.3, drive: 2, mix: 0.25 },
        { freqHz: 1_100, range: 0.28, drive: 2.1, mix: 0.28, texture: 0.22 },
        { freqHz: 6_800, drive: 2.65, mix: 0.45, texture: 0.62 },
      ],
      {},
      { enabled: true, amount: 0.3 },
    ),
    bassForge: forge(90, 2.5, 0.85, 0.8, 0.7, 0.4),
    // The kick's own hit kept, its tail shortened under the bass guitar.
    bassPunch: punch(100, 0.3, -0.3, 0, 60, 0),
    dimension: width(0.65, 1, 1, 160, 3_000, 0.05),
    maximizer: ceiling(1, -1, 4, sixteenthMs(125)),
    offered: ['exciter', 'bassForge'],
  },
  {
    // Rock's band with the voice in front: a live kit and a bass guitar under
    // piano, acoustic and clean-to-crunch electric guitars, at 100-140 BPM.
    // Its masters are as finished as pop's (DR 4-7 on the CDs of Coldplay,
    // The Killers, Maroon 5 and Imagine Dragons) and bright already, so no
    // stage adds harmonics: not over a bright vocal, and not over guitars
    // that make their own. The guitars are doubled hard left and right, so
    // nothing widens them. The kick keeps its hit with a tail as short as
    // pop's under a bass line that moves, the bottom goes mono as pop masters
    // are made, and the ceiling only catches.
    id: 'popRock',
    bassPunch: punch(105, 0.25, -0.35, 0, 60, 0),
    dimension: width(0.6, 1, 1, 150, 3_000, 0.05),
    maximizer: ceiling(0.75, -1, 4, sixteenthMs(120)),
  },
  {
    // Played without a click and mastered with room to breathe: -18 to -13
    // LUFS on the original CDs. Tape warmth is the sound, so a little body
    // is welcome; the 60s mixes panned hard, and a shade of narrowing is what
    // brings those back together on headphones.
    id: 'classicRock',
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 300, range: 0.3 },
    ),
    dimension: width(0.8, 0.92, 0.95, 180, 3_200, 0),
    maximizer: ceiling(1.25, -1, 10, beatMs(120)),
  },
  {
    // Loud and quiet in the same song, fuzz on the guitars, and the late-90s
    // masters among the most clipped ever released. The verse-to-chorus
    // contrast is the form, so the ceiling barely drives.
    id: 'alternativeRock',
    bassPunch: punch(100, 0.2, -0.35, 0, 60, 0),
    dimension: width(0.65, 1, 1.05, 160, 3_000, 0.05),
    maximizer: ceiling(0.75, -1, 5, sixteenthMs(120)),
  },
  {
    // A live kit in a room, warm and often deliberately dark. The room is
    // the record, so nothing narrows it and nothing shapes the drums.
    id: 'indieRock',
    dimension: width(0.8, 1, 1, 170, 3_200, 0.08),
    maximizer: ceiling(1, -1, 6, sixteenthMs(115)),
  },
  {
    // Long pieces that build from near silence (DR 10-14), panned in detail.
    // A slow ceiling that touches only the climax, and the picture as mixed.
    id: 'progressiveRock',
    dimension: width(0.85, 1, 1.05, 170, 3_200, 0.05),
    maximizer: ceiling(1, -1, 12, beatMs(110)),
  },
  {
    // A big kick in a live room and valve crunch: the punch kept, the low
    // mids under it tightened a little, as the genre is mixed.
    id: 'hardRock',
    bassPunch: punch(110, 0.25, -0.4, 0, 60, 0),
    dimension: width(0.7, 1, 1, 170, 3_000, 0.05),
    maximizer: ceiling(1, -1, 4, sixteenthMs(120)),
  },
  {
    // Double-kick runs at up to 220 BPM, each hit wanted on its own: a
    // shorter tail rather than a harder attack, because the click that makes
    // a hit read lives at 4-8 kHz, in the curve, and a harder low attack is
    // only a peak for the ceiling to take back. The loudest genre there is
    // (-8.4 LUFS median), so the ceiling barely drives. Its Exciter is
    // offered and left off, for the fizz.
    id: 'metal',
    exciter: exciterProfile(
      [
        { mix: 0.18 },
        { freqHz: 1_500, mix: 0.25, texture: 0.28 },
        { freqHz: 6_800, drive: 2.7, mix: 0.5, texture: 0.64 },
      ],
      {},
      { enabled: true, amount: 0.35 },
    ),
    bassPunch: punch(100, 0.35, -0.6, 0, 40, 0),
    dimension: width(0.6, 1, 1, 150, 3_000, 0),
    maximizer: ceiling(0.5, -1, 2.5, sixteenthMs(170)),
    offered: ['exciter'],
  },
  {
    // Dry, mid-heavy and fast (150-200 BPM). Only the kick tightened, and
    // nothing brighter or wider than the band played it.
    id: 'punk',
    bassPunch: punch(100, 0.15, -0.45, 0, 40, 0),
    dimension: width(0.65, 1, 1, 160, 3_000, 0),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(180)),
  },
  {
    // A tight, clicky kick and glossy guitars, on masters crushed to DR 4-6.
    // A tighter kick, never a deeper one, and a ceiling that hardly drives.
    id: 'popPunk',
    bassPunch: punch(110, 0.2, -0.5, 0, 40, 0),
    dimension: width(0.6, 1, 1, 150, 3_000, 0),
    maximizer: ceiling(0.25, -1, 3, sixteenthMs(170)),
  },
  {
    // Sludgy, soft-then-loud, with a thick middle and a rolled-off top that
    // is meant to be there. Nothing brightens it, and a slow ceiling keeps
    // the loud half loud and the soft half soft.
    id: 'grunge',
    dimension: width(0.75, 1, 1, 170, 3_000, 0),
    maximizer: ceiling(1, -1, 8, beatMs(110)),
  },
];

export default ROCK_RACKS;
