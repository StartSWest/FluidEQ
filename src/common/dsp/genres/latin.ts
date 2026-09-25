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
 * Latin music: clave, percussion and brass, and two ways of carrying the
 * bottom.
 *
 * The band styles — salsa, bachata, merengue, cumbia, the Mexican regional
 * styles — put an anticipated bass under hand drums, often with no kick at
 * all, in a picture that keeps most of its energy in the middle ninety
 * degrees. Their tops are brass, cowbell, timbales and güira, rich in
 * harmonics already and harsh under an exciter; conga slaps are what a fast
 * limiter flattens first. So these rows keep the attack (slower ceilings),
 * warm the bass rather than brightening the top, and never widen. The urban
 * styles — reggaeton, Latin pop, tumbados — are programmed on a kick every
 * beat over a mono 808, and get the treatment the rest of the catalogue
 * gives that sound: the sub deepened by the curve and summed to mono under
 * it, and nothing generated under an 808 that is saturated already.
 */
const LATIN_RACKS: readonly IGenreRack[] = [
  {
    // Everything from bolero to dembow, so the plainest row: the picture
    // kept as mixed and a ceiling that keeps the percussion's attack. Its
    // old top-band Exciter is offered for a listener who wants the shine.
    id: 'latin',
    exciter: exciterProfile([
      { enabled: false },
      { freqHz: 1_800, mix: 0.2, texture: 0.28 },
      { freqHz: 7_500, drive: 2.6, mix: 0.36, texture: 0.62 },
    ]),
    dimension: width(0.7, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(1, -1, 5, sixteenthMs(110)),
    offered: ['exciter'],
  },
  {
    // Dembow and tresillo at 85-105 BPM, a programmed kick locked to a mono
    // sub, mastered at -8 LUFS peaking over full scale. The sub tightened a
    // little, the rest left as polished as it arrived.
    id: 'latinPop',
    bassPunch: punch(100, 0.1, -0.3, 0, 60, 0),
    dimension: width(0.55, 1, 1, 150, 3_200, 0.05),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(96)),
  },
  {
    // A kick on every beat at about 95 BPM over a long, tuned, saturated
    // 808. The sub deepened by the curve and mono under 150 Hz, Forge
    // offered and left off — its octave and harmonics under an 808 distorted already
    // came to 13% of the note — and a ceiling that hardly pushes a DR 5
    // master.
    id: 'reggaeton',
    bassForge: forge(85, 0, 0.7, 0.4, 0.9, 0.3),
    dimension: width(0.5, 1, 1.05, 150, 3_000, 0.05),
    maximizer: ceiling(0.5, -1, 3, sixteenthMs(95)),
    offered: ['bassForge'],
  },
  {
    // Clave at 160-220 BPM, a tumbao that skips the downbeat and no kick,
    // congas to one side and timbales in the middle. The tumbao warmed
    // gently, the band left where it was placed, and a ceiling slow enough
    // to let every conga slap through.
    id: 'salsa',
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 200, range: 0.3 },
    ),
    dimension: width(0.75, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(1, -1, 8, beatMs(190)),
  },
  {
    // A weeping requinto and a metallic güira over syncopated bass at
    // 120-140 BPM. Fatiguing if its 3-8 kHz is lifted, so only the bass is
    // warmed, and the güira's attack — the dancers' metronome — kept.
    id: 'bachata',
    // Offered under its name and not played: an exciter makes the requinto and
    // the guira harsh.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 180, range: 0.3 },
    ),
    dimension: width(0.7, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(0.75, -1, 5, sixteenthMs(128)),
    offered: ['exciter'],
  },
  {
    // Tambora and a sixteenth-note güira at up to 160 BPM, dense enough for
    // a limiter to smear. The tambora's punch kept tight, and no top added
    // to saxes and güira that are bright already.
    id: 'merengue',
    bassPunch: punch(110, 0.2, -0.3, 0, 50, 0),
    dimension: width(0.7, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(0.75, -1, 4, sixteenthMs(140)),
  },
  {
    // The slowest of the dance family, 85-110 BPM over a steady scrape and a
    // two-beat bass, warm and mid-forward. Bass warmth, and a slow ceiling
    // that leaves the scraper's pulse alone.
    id: 'cumbia',
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 250, range: 0.3 },
    ),
    dimension: width(0.75, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(1, -1, 8, beatMs(95)),
  },
  {
    // Nylon guitar and a restrained voice, felt at 60-75, among the most
    // dynamic records in the family (DR 11-16). Warmth for the guitar, a
    // little air for the voice, and a ceiling that only catches.
    id: 'bossaNova',
    exciter: exciterProfile(
      [
        { enabled: false },
        { enabled: false },
        { freqHz: 9_000, range: 0.22, drive: 2.2, mix: 0.12, texture: 0.5 },
      ],
      { enabled: true, amount: 0.1, focusHz: 250, range: 0.3 },
    ),
    dimension: width(0.9, 1, 1, 180, 3_500, 0),
    maximizer: ceiling(0.75, -1, 12, beatMs(65)),
  },
  {
    // Surdos in call and response under tamborim, pandeiro and caixa. The
    // surdo tightened rather than made to boom, and the percussion's attack
    // kept by a ceiling that does not rush.
    id: 'samba',
    bassPunch: punch(100, 0.15, -0.4, 0, 60, 0),
    dimension: width(0.75, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(1, -1, 6, sixteenthMs(105)),
  },
  {
    // Rasgueado, palmas and footwork are the rhythm itself, on recordings as
    // dynamic as any (Paco de Lucía DR 13-17). Body, never top, and a
    // ceiling that keeps every peak it can.
    id: 'flamenco',
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 250, range: 0.3 },
    ),
    dimension: width(0.9, 1, 1, 180, 3_500, 0),
    maximizer: ceiling(0.5, -1, 16, beatMs(120)),
  },
  {
    // Banda's tuba and tambora, norteño's accordion and bajo sexto,
    // mariachi's guitarrón and trumpets. Warmth for the tuba and guitarrón,
    // the tambora's punch kept tight, and nothing added to the brass and
    // accordion upper mids.
    id: 'regionalMexican',
    // Offered under its name and not played: brass, accordion and violins are
    // bright already.
    exciter: exciterProfile(
      [{ enabled: false }, { enabled: false }, { enabled: false }],
      { enabled: true, amount: 0.1, focusHz: 220, range: 0.3 },
    ),
    bassPunch: punch(100, 0.2, -0.3, 0, 60, 0),
    dimension: width(0.75, 1, 1, 170, 3_200, 0),
    maximizer: ceiling(1, -1, 5, sixteenthMs(100)),
    offered: ['exciter'],
  },
  {
    // A steel-string requinto over tuba, felt at about 105, and in the
    // tumbados an 808 doubling the tuba. The tuba warmed by the curve and
    // the sub mono under 120 Hz, Forge offered and left off — the 808 brings its own
    // sub — and the pick attack left to the ceiling's look-ahead.
    id: 'corridos',
    bassForge: forge(85, 0, 0.6, 0.4, 0.9, 0.25),
    dimension: width(0.6, 1, 1, 150, 3_200, 0),
    maximizer: ceiling(0.75, -1, 5, sixteenthMs(105)),
    offered: ['bassForge'],
  },
];

export default LATIN_RACKS;
