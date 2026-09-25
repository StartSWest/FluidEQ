/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  IGenreRack,
  beatMs,
  ceiling,
  forge,
  sixteenthMs,
  width,
} from '../genreRack';

/**
 * Jamaica: the bass line is the lead instrument.
 *
 * Roots reggae and dub were mixed live on small desks, largely in mono, and
 * mastered with a great deal of room (Marley's original CDs DR 14-15, a
 * Scientist CD DR 15), so nothing here compresses or levels, nothing widens
 * a mono source and no exciter touches a tape-era top — it would only
 * brighten the hiss. What these records do welcome is weight in the bass,
 * kept in the middle, and their curves give it. Nothing is generated under
 * them: the bass lines carry their own harmonics and the riddims their own
 * sub, and Forge's octave and harmonics on top came to 15% of a bass note —
 * an exciter on a tape-era record, or more sub under a sub (2026-09-23).
 */
const REGGAE_RACKS: readonly IGenreRack[] = [
  {
    // One drop at about 76 BPM under a thick bass guitar with its highs
    // rolled off and a bright staccato skank, and a soft kick that should
    // stay so. Forge is offered and left off: the warmth is the curve's.
    id: 'reggae',
    bassForge: forge(90, 0, 0.4, 0.8, 0.95, 0.3),
    dimension: width(0.6, 1, 1, 150, 3_200, 0),
    maximizer: ceiling(1, -1, 8, beatMs(76)),
    offered: ['bassForge'],
  },
  {
    // Drums and sub-bass up front at 65-75 BPM, the rest dropping in and out
    // through tape echo: the drops are the composition, so the ceiling only
    // catches. The bottom mono under 150 Hz, as the originals were narrow;
    // Forge offered, left off.
    id: 'dub',
    bassForge: forge(80, 0, 0.8, 0.4, 0.95, 0.3),
    dimension: width(0.5, 1, 1, 150, 3_000, 0),
    maximizer: ceiling(0.75, -1, 10, beatMs(70)),
    offered: ['bassForge'],
  },
  {
    // Digital riddims at about 100 BPM on an 808-style sub, everything else
    // high-passed under 80 Hz by the producer. Sub support from the curve,
    // mono under 120 Hz, Forge offered and left off, and a ceiling quick
    // enough to leave the percussion crisp.
    id: 'dancehall',
    bassForge: forge(90, 0, 0.7, 0.5, 0.9, 0.3),
    dimension: width(0.5, 1, 1.05, 150, 3_000, 0.05),
    maximizer: ceiling(1, -1, 4, sixteenthMs(100)),
    offered: ['bassForge'],
  },
  {
    // A walking bass, a light kick and horns on the offbeat, 1960s records
    // in mono and tape-saturated. No invented bass under a vintage
    // recording, and a shade of narrowing rather than any width.
    id: 'ska',
    dimension: width(0.8, 0.95, 0.95, 170, 3_200, 0),
    maximizer: ceiling(1, -1, 6, sixteenthMs(150)),
  },
];

export default REGGAE_RACKS;
