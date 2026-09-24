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
 * Electronic music, from the club to the chill-out room.
 *
 * The club half arrives dense, bright and over full scale (true peaks of
 * +0.5 to +1.5 dBTP are routine), mixed narrow with a mono bottom because
 * a club system sums everything under about 150 Hz. Engineers warn that an
 * exciter makes that top "very harsh" quickly, the sub needs no help and
 * the drop's contrast with the breakdown is the arrangement — so these rows
 * add no harmonics, no sub and no width, and their ceilings barely drive.
 * The chill half is the opposite: dynamic, spacious, made to be listened to
 * quietly, and the one place in the catalogue where width is welcome.
 */
const ELECTRONIC_RACKS: readonly IGenreRack[] = [
  {
    // The whole family at its median: -9.3 LUFS, narrow, bass-weighted. Its
    // old Exciter, Forge and Bass Punch are offered under its name.
    id: 'electronic',
    exciter: exciterProfile(
      [
        { freqHz: 72, drive: 2.2, mix: 0.25, texture: 0.04 },
        { mix: 0.17 },
        { drive: 2.8, mix: 0.53, texture: 0.64 },
      ],
      { enabled: true, amount: 0.16, focusHz: 180, range: 0.28 },
    ),
    bassForge: forge(100, 4, 0.85, 0.8, 0.6, 0.65),
    bassPunch: punch(120, 0.75, -0.2, 0.1, 90, 0.5),
    dimension: width(0.5, 1, 1.1, 150, 3_000, 0.1),
    // Half a decibel more than the family's other rows: at 0.75 it sat 0.2 LU
    // over DSP Off where its siblings sat 0.3 to 0.6, and the extra half
    // pumps no more than they do (2026-09-23).
    maximizer: ceiling(1.25, -1, 3, sixteenthMs(125)),
    offered: ['exciter', 'bassForge', 'bassPunch'],
  },
  {
    // Big room at 126-132 BPM: the kick is the bass in the drop, supersaws
    // are spread already and the master is clipped. A mono bottom, and
    // nothing else between the record and its ceiling. Its old top-band
    // Exciter is offered.
    id: 'edm',
    exciter: exciterProfile([
      { enabled: false },
      { enabled: false },
      { freqHz: 8_200, drive: 2.8, mix: 0.5, texture: 0.64 },
    ]),
    dimension: width(0.5, 1, 1, 150, 3_000, 0.05),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(128)),
    offered: ['exciter'],
  },
  {
    // Four on the floor at 125, a deep kick with the bass pumping against
    // it: that pump is the groove, so nothing re-times the kick. Mono below
    // 200 Hz, where house is widest of the club styles and still narrow.
    id: 'house',
    dimension: width(0.5, 1, 1.1, 200, 3_000, 0.1),
    maximizer: ceiling(0.75, -1, 3, sixteenthMs(125)),
  },
  {
    // A compressed 909 kick over a sustained rumble, dark, the narrowest
    // style measured. At most the kick tightened, so the rumble does not
    // smear it.
    id: 'techno',
    bassPunch: punch(110, 0.1, -0.35, 0, 50, 0),
    dimension: width(0.5, 1, 1, 150, 3_000, 0),
    maximizer: ceiling(0.75, -1, 3, sixteenthMs(133)),
  },
  {
    // Supersaws that "already generate plenty of top" and a drop built on
    // an eight-to-ten-LU contrast with the breakdown. Mono under 120 Hz and
    // nothing more.
    id: 'trance',
    dimension: width(0.5, 1, 1, 120, 3_000, 0),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(138)),
  },
  {
    // Breaks at 174 over a mono sine sub: the snare and the break are the
    // genre's identity. The kick tightened, never lifted, and the sub mono.
    // Stored as the chain it has always been.
    id: 'drumBass',
    chainId: 'drum-bass',
    bassPunch: punch(120, 0.25, -0.5, 0, 40, 0),
    dimension: width(0.5, 1, 1.05, 150, 3_000, 0.05),
    maximizer: ceiling(0.75, -1, 3, sixteenthMs(174)),
  },
  {
    // A mono sine sub under a mid-bass distorted by design. Neither is
    // helped: the growl is fizz already and the sub is the loudest thing in
    // the record. The snare's crack is what the ceiling must not flatten.
    id: 'dubstep',
    dimension: width(0.5, 1, 1.05, 120, 3_000, 0.05),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(140)),
  },
  {
    // Slowed breakbeats under deep, dub-influenced bass and wide
    // atmospheres, the top kept dark and the vinyl grain left as it is.
    // Mild bass support from the curve, wider air, and Forge offered and
    // left off: the bass is deep already.
    id: 'downtempo',
    bassForge: forge(85, 0, 0.5, 0.4, 0.95, 0.25),
    dimension: width(0.6, 1, 1.25, 150, 3_000, 0.25),
    maximizer: ceiling(1, -1, 8, beatMs(95)),
    offered: ['bassForge'],
  },
  {
    // Smooth and spacious under 120 BPM: light air and a slightly wider
    // top, and no pressure anywhere.
    id: 'chillout',
    exciter: exciterProfile([
      { enabled: false },
      { enabled: false },
      { freqHz: 9_000, range: 0.22, drive: 2.25, mix: 0.15, texture: 0.5 },
    ]),
    dimension: width(0.7, 1, 1.3, 170, 3_000, 0.3),
    maximizer: ceiling(1, -1, 10, beatMs(90)),
  },
  {
    // Deliberately dark and dusty, low-passed at 12-16 kHz, the crackle part
    // of the record and the master sometimes narrowed to 80-90%. Warmth and
    // nothing brighter; a slight narrowing, the bottom mono under 120 Hz.
    id: 'lofi',
    // Offered under its name and not played: the record is saturated on tape
    // already.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 300, range: 0.3 },
    ),
    dimension: width(0.7, 0.95, 0.95, 120, 3_000, 0),
    // Mastered around -12 LUFS, quieter than the rest of the family, so this
    // row drives a decibel more: at 1 dB it played level with DSP Off, at 2
    // it is 0.3 LU over and still pumps less than the dance rows (2026-09-23).
    maximizer: ceiling(2, -1, 8, beatMs(82)),
    offered: ['exciter'],
  },
  {
    // Drones and swells made for low levels, often beatless, mastered at
    // -14 to -18 LUFS with compression "gentle at most". Wide, and a ceiling
    // that only ever meets the top of a swell. Its old Exciter is offered.
    id: 'ambient',
    exciter: exciterProfile(
      [{ mix: 0.08 }, { mix: 0.13 }, { drive: 2.4, mix: 0.4 }],
      { enabled: true, amount: 0.12, focusHz: 500, range: 0.38 },
      { enabled: true, amount: 0.1 },
    ),
    dimension: width(0.9, 1.1, 1.45, 180, 2_600, 0.4),
    maximizer: ceiling(0.5, -1, 16, beatMs(70)),
    offered: ['exciter'],
  },
  {
    // Piano, flute and pads with long reverbs, and no sudden loud chords.
    // A little air, wide ambience, and nothing that levels the quiet.
    id: 'newAge',
    // Offered under its name and not played: transparent is the brief.
    exciter: exciterProfile([
      { enabled: false },
      { enabled: false },
      { freqHz: 9_500, range: 0.22, drive: 2.2, mix: 0.12, texture: 0.5 },
    ]),
    dimension: width(0.9, 1.05, 1.35, 180, 2_800, 0.3),
    maximizer: ceiling(0.5, -1, 16, beatMs(70)),
    offered: ['exciter'],
  },
];

export default ELECTRONIC_RACKS;
