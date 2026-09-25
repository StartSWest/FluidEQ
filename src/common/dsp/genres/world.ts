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
 * Africa, South Asia, the Middle East, and sacred music.
 *
 * The drums lead nearly everywhere here — the dhol's boom and crack, the
 * darbuka's doum and tek, Tony Allen's kick, amapiano's log drum — and every
 * source asks for the same two things: their attack kept, and their bottom
 * tight and centred rather than bigger. The tops are bright already (tumbi,
 * riq, strings, playback vocals) and harsh under an exciter; the older
 * records, Fela's and Osibisa's and the 90s film scores, were mastered with
 * room and take warmth well. The two catch-all rows — World and the Indian
 * classical tradition — impose the least of anything in the catalogue.
 */
const WORLD_RACKS: readonly IGenreRack[] = [
  {
    // Long grooves at 105-135 BPM from a big live band, the 1970s originals
    // at DR 11-16. Warmth and a little air for the analog masters, the bass
    // tightened a little, and a slow ceiling.
    id: 'afrobeat',
    exciter: exciterProfile(
      [
        { enabled: false },
        { enabled: false },
        { freqHz: 9_000, range: 0.22, drive: 2.2, mix: 0.12, texture: 0.5 },
      ],
      { enabled: true, amount: 0.1, focusHz: 300, range: 0.3 },
    ),
    bassPunch: punch(100, 0.1, -0.3, 0, 60, 0),
    dimension: width(0.75, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(1, -1, 10, beatMs(120)),
  },
  {
    // About 110 BPM, a round kick and a sine sub (log drums in the newer
    // records), everything under 100-150 Hz in mono and the shakers wide.
    // The sub warmed by the curve and mono under 150 Hz, never widened, and
    // the shakers
    // left alone; Forge offered and left off, as a sine sub is clean and
    // wants no octave or grit made under it.
    id: 'afrobeats',
    bassForge: forge(90, 0, 0.6, 0.5, 0.9, 0.3),
    dimension: width(0.5, 1, 1.1, 150, 3_000, 0.1),
    maximizer: ceiling(0.75, -1, 4, sixteenthMs(110)),
    offered: ['bassForge'],
  },
  {
    // The log drum is a pitched, percussive bass whose attack "is the
    // energy", already driven in production. Mild sub support from the
    // curve, the sub mono under 120 Hz and the body narrowed up to 200 so it
    // stays centred, and width only above 3 kHz. Forge offered and left off: the research's one rule
    // for the log drum is no saturation on it.
    id: 'amapiano',
    bassForge: forge(90, 0, 0.6, 0.3, 0.95, 0.25),
    dimension: width(0.5, 1, 1.15, 200, 3_000, 0.15),
    maximizer: ceiling(0.75, -1, 5, sixteenthMs(113)),
    offered: ['bassForge'],
  },
  {
    // Sweet, clean guitars and jazzy horns over a melodic bass. A little
    // warmth and air for the older recordings, and no width.
    id: 'highlife',
    exciter: exciterProfile(
      [
        { enabled: false },
        { enabled: false },
        { freqHz: 9_000, range: 0.22, drive: 2.2, mix: 0.12, texture: 0.5 },
      ],
      { enabled: true, amount: 0.08, focusHz: 250, range: 0.3 },
    ),
    dimension: width(0.75, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(1, -1, 8, beatMs(118)),
  },
  {
    // Recordings made in every way there is, field recordings in mono among
    // them, with timbres a Western reference does not know. The least a
    // chain can do: no picture changed, and a ceiling that only catches.
    id: 'world',
    maximizer: ceiling(0.5, -1, 14, beatMs(90)),
  },
  {
    // Lush film backdrops around a centred playback vocal, modern dance
    // numbers bass-heavy and mastered at DR 5-8. The sub tightened, the
    // picture — wide already — left alone.
    id: 'bollywood',
    bassPunch: punch(100, 0.1, -0.3, 0, 60, 0),
    dimension: width(0.6, 1, 1, 150, 3_200, 0),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(100)),
  },
  {
    // The dhol is the genre: a thick boom and a treble crack at 90-110 BPM.
    // The boom tightened, never raised, and a look-ahead long enough to let
    // the crack through.
    id: 'bhangra',
    bassPunch: punch(110, 0.15, -0.4, 0, 50, 0),
    dimension: width(0.6, 1, 1, 150, 3_200, 0),
    maximizer: ceiling(0.5, -1, 5, sixteenthMs(100)),
  },
  {
    // An unmetered alap over a drone, then tabla: harmonics built in by the
    // jivari bridge, and dynamics a leveller would ruin by lifting the drone.
    // A ceiling and nothing else.
    id: 'indianClassical',
    maximizer: ceiling(0.5, -1, 16, beatMs(60)),
  },
  {
    // A reverberant, ornamented voice over the maqsum's doum and tek. The
    // low end tightened, the strings' brightness and the darbuka's attack
    // left as they are.
    id: 'arabicPop',
    bassPunch: punch(100, 0.1, -0.3, 0, 60, 0),
    dimension: width(0.6, 1, 1, 150, 3_200, 0),
    maximizer: ceiling(0.75, -1, 4, sixteenthMs(100)),
  },
  {
    // Polished pop with Turkish colour, the modern albums at DR 5-6. A tight
    // bottom, the darbuka crisp, and the ceiling barely pushing.
    id: 'turkishPop',
    bassPunch: punch(100, 0.1, -0.3, 0, 60, 0),
    dimension: width(0.6, 1, 1, 150, 3_200, 0),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(110)),
  },
  {
    // A choir and a lead voice over organ and a busy bass, with vamps that
    // build for minutes (LRA about 11). Warmth, the choir left as wide as it
    // was recorded, and a slow ceiling that lets a vamp build.
    id: 'gospel',
    // Offered under its name and not played: no excitement on the choir.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.12, focusHz: 350, range: 0.32 },
    ),
    dimension: width(0.75, 1, 1, 170, 3_400, 0),
    maximizer: ceiling(1, -1, 10, beatMs(100)),
    offered: ['exciter'],
  },
  {
    // Worship pop-rock: a quiet verse building to a big bridge, the lyric
    // clear, ambient guitars already very wide. A narrowed bottom and a
    // ceiling
    // slow enough to keep the arc.
    id: 'christian',
    dimension: width(0.65, 1, 1, 160, 3_200, 0),
    maximizer: ceiling(1, -1, 8, beatMs(95)),
  },
];

export default WORLD_RACKS;
