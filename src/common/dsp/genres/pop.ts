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
 * Pop and its regional and period cousins.
 *
 * A chart pop master is the most finished record there is: limited to about
 * -8 LUFS, true peaks around +1 dBTP, a bright vocal "just shy of harsh"
 * already, and the side channel made mono below about 140 Hz. What these
 * rows add is only what such a record cannot already have: a bottom that
 * cannot cancel, a kick with less tail under the bass line, and level where
 * a stream has turned the record down. The 80s rows keep their dynamics,
 * which is what those masters had and their reissues lost.
 */
const POP_RACKS: readonly IGenreRack[] = [
  {
    // Retain the small body return from the approved 2026-11-04 voicing.
    // Removing it and reducing the bass together lost the requested punch.
    // The high-band generator stays off; de-essing is light and Dynamics off.
    id: 'pop',
    // A common input level, then seven decibels into the final ceiling:
    // approximately -11 LUFS for Pop, with the song's dynamics kept between
    // its peaks. The former +0.75 dB fed unnormalised masters into continuous
    // reduction: Why? lost 2.51 LU before the output correction. Normalizing
    // to -18 first leaves room for the curve and its generated harmonics.
    normalizer: { mode: 'loudness', targetLufs: -18, truePeakDbtp: -3 },
    // A finished mix, not an isolated vocal: narrow spectral cuts in the
    // centre spare the bass and the sides. iZotope's mastering de-essing
    // guide recommends mid-only processing, and FabFilter's Pro-DS manual
    // recommends frequency-selective processing for full mixes:
    // https://www.izotope.com/community/blog/de-essing-a-master-tools-tips-and-tricks
    // https://www.fabfilter.com/help/pro-ds/using/advancedcontrols
    // These dials are FluidEQ's calibrated starting point, not an industry
    // standard or a translation of another processor's threshold.
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
        { freqHz: 1_250, mix: 0.12, texture: 0.2 },
        { enabled: false },
      ],
      { enabled: true, amount: 0.08, focusHz: 500, range: 0.28 },
    ),
    bassForge: forge(90, 1, 0.9, 0.9, 0.8, 0.3),
    // Tightens rather than hits: a shorter tail under the bass line, and an
    // attack only just lifted, because the master's kick is already shaped.
    bassPunch: punch(110, 0.2, -0.35, 0, 60, 0),
    // Mono under 140 Hz as pop masters are made, the centre left alone, and
    // the air a little wider than the record. No synthetic side from the
    // centre: the lead stays as focused as it was mixed.
    dimension: width(0.6, 1, 1.08, 140, 3_200, 0),
    maximizer: ceiling(7, -1, 3, sixteenthMs(116)),
    offered: ['bassForge'],
  },
  {
    // Lighter and warmer than chart pop, often deliberately lo-fi, and about
    // a decibel quieter: the warmth is the look, so nothing here brightens
    // it. The Exciter adds to the warmth alone — Organic's body in the low
    // mids, no band and nothing on the top.
    id: 'indiePop',
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 320, range: 0.3 },
    ),
    dimension: width(0.75, 1, 1.1, 160, 3_400, 0.12),
    maximizer: ceiling(1, -1, 5, sixteenthMs(110)),
  },
  {
    // Drum machines and sequenced bass under wide chorused pads. The 80s
    // masters lean bright and are dynamic (DR 12-13), so the only colour is
    // a little low-mid body, the one direction those mixes welcome, and a
    // ceiling that lets go over a whole beat, which leaves those dynamics in
    // (it let go within a sixteenth until 2026-09-24).
    id: 'synthPop',
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.12, focusHz: 350, range: 0.3 },
    ),
    dimension: width(0.65, 1, 1.15, 150, 3_000, 0.15),
    maximizer: ceiling(1, -1, 5, beatMs(118)),
  },
  {
    // Up-tempo, choppy guitars and synths over a lean bottom, mastered with
    // dynamics its reissues lost (DR 14 against 6). A little body and a
    // little air, which is what a thin original welcomes, and a ceiling that
    // only catches: the snap is the genre.
    id: 'newWave',
    exciter: exciterProfile(
      [
        { enabled: false },
        { enabled: false },
        { freqHz: 9_000, range: 0.22, drive: 2.25, mix: 0.15, texture: 0.5 },
      ],
      { enabled: true, amount: 0.1, focusHz: 260, range: 0.3 },
    ),
    dimension: width(0.8, 1, 1.05, 170, 3_200, 0.08),
    maximizer: ceiling(1.25, -1, 8, beatMs(135)),
  },
  {
    // Among the loudest masters made (-10 to -6 LUFS, true peaks over full
    // scale), a vocal already lifted at 3-5 kHz and 12 kHz, and a kick with
    // its sub punch built in. A narrowed bottom, a ceiling that barely
    // drives, and since 2026-10-15 the Exciter Ivan asked for, kept under
    // the vocal's own lifts: body and presence from a band that stops by
    // 2.5 kHz (its harmonics an octave over it at most), mostly even orders,
    // and Organic's warmth — nothing on the top that is lifted already.
    id: 'kPop',
    exciter: exciterProfile(
      [
        { enabled: false },
        { freqHz: 1_100, range: 0.2, mix: 0.16, texture: 0.22 },
        { enabled: false },
      ],
      { enabled: true, amount: 0.1, focusHz: 400, range: 0.3 },
    ),
    dimension: width(0.55, 1, 1.1, 150, 3_000, 0.1),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(122)),
  },
  {
    // A dense, bright wall at up to 200 BPM, with overs common (+2.3 dBTP)
    // and distorted guitars in it. No width, no air: a touch of low-mid body
    // is the one direction these mixes take well.
    id: 'jPop',
    // Warmth alone, in the low mids, and nothing on a top that is bright and
    // clipped already: offered and left off until Ivan asked for the Exciter
    // in pop on 2026-10-15, and this profile adds no treble to object to.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 300, range: 0.3 },
    ),
    dimension: width(0.65, 1, 1, 160, 3_000, 0.05),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(160)),
  },
  {
    // Ballad-led, the vocal front and centre and warm, with consonants that
    // want de-essing rather than excitement. The console warmth of the
    // classic Mandopop sound, the mids a shade narrower so the voice holds
    // the middle, and a slow ceiling for the ballads' dynamics: a whole beat
    // of release, where until 2026-09-24 it let go within a sixteenth.
    id: 'cPop',
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 400, range: 0.32 },
    ),
    dimension: width(0.75, 0.95, 1.1, 180, 3_600, 0.12),
    maximizer: ceiling(1, -1, 6, beatMs(84)),
  },
  {
    // The slow song of every catalogue, pop, rock, soul and Latin alike:
    // "Someone Like You" at 67.5 BPM, "November Rain" at 84, the lead vocal
    // mixed first and over everything. Nothing here generates: harmonics
    // land on the sibilants of a voice this close (SOS, "Psychoacoustic
    // enhancers"), and a sub is in a modern ballad where its producer chose
    // one (Capaldi's "Someone You Loved"). A ballad master keeps more of its
    // dynamics than the same album's singles (Adele's "21": DR8 against DR5),
    // so the ceiling only lightly drives and lets go over a whole beat.
    id: 'ballad',
    // The bass narrowed toward the middle, where it is mixed (SOS: under
    // about 150 Hz); the voice and the piano or strings left as wide as
    // they were placed — a wider centre is a vaguer voice.
    dimension: width(0.7, 1, 1, 150, 3_500, 0),
    maximizer: ceiling(0.5, -1, 6, beatMs(72)),
  },
];

export default POP_RACKS;
