/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { IExciterPreset, exciterProfile } from './exciterProfile';

/**
 * The genre profiles, split out for the same reason the EQ's world styles are:
 * this half of the catalogue grows a style at a time and the rest of it does
 * not.
 *
 * Four of them — `soul`, `edm`, `latin` and `country` — are TOP-BAND
 * voicings, with the low band and the Organic body generator switched off,
 * and that is what lets a chain run them beside Bass Forge or Bass Punch.
 * Two harmonic generators working on the same octave is where "excited"
 * turns into mud; the hardware pairs solved it the same way, by high-passing
 * the exciter and letting the bass unit own everything below (Aphex Big
 * Bottom, BBE Lo Contour). `pop` gave up its low band to join them, which
 * cost nothing audible — that band was the quietest return in the catalogue.
 *
 * What separates the four is the mid band rather than the air: `soul` sits
 * low and almost purely even-order for a warm, unbright presence, `country`
 * at the consonants of a voice, `latin` higher and grittier where brass and
 * hand percussion live, and `edm` has no mid band at all, because a synth
 * arrives with its own harmonics and only the air is missing.
 */
export const EXCITER_GENRE_PRESETS = {
  rock: {
    id: 'rock',
    labelKey: 'dsp.eqPreset.rock',
    group: 'genre',
    settings: exciterProfile(
      [
        { freqHz: 90, range: 0.3, drive: 2, mix: 0.25 },
        {
          freqHz: 1_100,
          range: 0.28,
          drive: 2.1,
          mix: 0.28,
          texture: 0.22,
        },
        { freqHz: 6_800, drive: 2.65, mix: 0.45, texture: 0.62 },
      ],
      {},
      { enabled: true, amount: 0.3 },
    ),
  },
  pop: {
    id: 'pop',
    labelKey: 'dsp.eqPreset.pop',
    group: 'genre',
    /**
     * Low band off, which is what lets a chain run this beside Bass Punch.
     *
     * It used to carry the catalogue's quietest low return — 0.11 mix, its
     * octave about 33 dB under the note — so switching it off is not a sound
     * anybody can hear leaving. What it buys is the pairing: Aphex sold the
     * Exciter with Big Bottom and BBE the Sonic Maximizer with Lo Contour,
     * and in both the harmonic generator is fed through a high-pass so the
     * two never make harmonics of the same octave. That is the arrangement
     * this profile is now built for, and the one `dspChain.test.ts` holds.
     */
    settings: exciterProfile(
      [
        { enabled: false },
        { freqHz: 1_250, mix: 0.19, texture: 0.2 },
        { freqHz: 7_200, drive: 2.65, mix: 0.32, texture: 0.62 },
      ],
      {
        enabled: true,
        amount: 0.13,
        focusHz: 500,
        range: 0.28,
      },
    ),
  },
  jazz: {
    id: 'jazz',
    labelKey: 'dsp.eqPreset.jazz',
    group: 'genre',
    settings: exciterProfile(
      [{ mix: 0.07 }, { mix: 0.11 }, { mix: 0.16, texture: 0.5 }],
      { enabled: true, amount: 0.16, focusHz: 450, range: 0.35 },
    ),
  },
  soul: {
    id: 'soul',
    labelKey: 'dsp.eqPreset.soul',
    group: 'genre',
    settings: exciterProfile([
      { enabled: false },
      { freqHz: 1_100, mix: 0.16, texture: 0.08 },
      { freqHz: 8_000, drive: 2.3, mix: 0.24, texture: 0.45 },
    ]),
  },
  classical: {
    id: 'classical',
    labelKey: 'dsp.eqPreset.classical',
    group: 'genre',
    // The most transparent profile in the catalogue, and the one that has to
    // stay that way: its harmonics sit around 32 dB under the note.
    settings: exciterProfile([
      { mix: 0.035 },
      { mix: 0.065 },
      { freqHz: 8_500, drive: 2.25, mix: 0.15, texture: 0.52 },
    ]),
  },
  electronic: {
    id: 'electronic',
    labelKey: 'dsp.eqPreset.electronic',
    group: 'genre',
    settings: exciterProfile(
      [
        { freqHz: 72, drive: 2.2, mix: 0.25, texture: 0.04 },
        { mix: 0.17 },
        { drive: 2.8, mix: 0.53, texture: 0.64 },
      ],
      { enabled: true, amount: 0.16, focusHz: 180, range: 0.28 },
      { enabled: true, amount: 0.28 },
    ),
  },
  edm: {
    id: 'edm',
    labelKey: 'dsp.eqPreset.edm',
    group: 'genre',
    settings: exciterProfile([
      { enabled: false },
      { enabled: false },
      { freqHz: 8_200, drive: 2.8, mix: 0.5, texture: 0.64 },
    ]),
  },
  hiphop: {
    id: 'hiphop',
    labelKey: 'dsp.eqPreset.hiphop',
    group: 'genre',
    settings: exciterProfile(
      [
        // The most forward low band in the catalogue: its octave sits 18 dB
        // under the note, which is where a small speaker starts finding a
        // fundamental it cannot reproduce.
        { freqHz: 65, drive: 2.15, mix: 0.26, texture: 0.03 },
        { mix: 0.15 },
        { drive: 2.35, mix: 0.19, texture: 0.5 },
      ],
      {
        enabled: true,
        amount: 0.18,
        focusHz: 150,
        range: 0.25,
      },
      { enabled: true, amount: 0.2 },
    ),
  },
  latin: {
    id: 'latin',
    labelKey: 'dsp.eqPreset.latin',
    group: 'genre',
    settings: exciterProfile([
      { enabled: false },
      { freqHz: 1_800, mix: 0.2, texture: 0.28 },
      { freqHz: 7_500, drive: 2.6, mix: 0.36, texture: 0.62 },
    ]),
  },
  acoustic: {
    id: 'acoustic',
    labelKey: 'dsp.eqPreset.acoustic',
    group: 'genre',
    settings: exciterProfile(
      [
        { mix: 0.08 },
        { freqHz: 800, mix: 0.24, texture: 0.12 },
        { drive: 2.45, mix: 0.38, texture: 0.55 },
      ],
      { enabled: true, amount: 0.16, focusHz: 420, range: 0.32 },
      { enabled: true, amount: 0.12 },
    ),
  },
  country: {
    id: 'country',
    labelKey: 'dsp.eqPreset.country',
    group: 'genre',
    // Top-band: the consonants of a voice and the edge of a plucked string.
    settings: exciterProfile([
      { enabled: false },
      { freqHz: 2_000, mix: 0.18, texture: 0.15 },
      { freqHz: 7_000, drive: 2.5, mix: 0.32, texture: 0.55 },
    ]),
  },
  metal: {
    id: 'metal',
    labelKey: 'dsp.eqPreset.metal',
    group: 'genre',
    settings: exciterProfile(
      [
        { mix: 0.18 },
        { freqHz: 1_500, mix: 0.25, texture: 0.28 },
        { freqHz: 6_800, drive: 2.7, mix: 0.5, texture: 0.64 },
      ],
      {},
      { enabled: true, amount: 0.35 },
    ),
  },
  ambient: {
    id: 'ambient',
    labelKey: 'dsp.eqPreset.ambient',
    group: 'genre',
    settings: exciterProfile(
      [{ mix: 0.08 }, { mix: 0.13 }, { drive: 2.4, mix: 0.4 }],
      { enabled: true, amount: 0.12, focusHz: 500, range: 0.38 },
      { enabled: true, amount: 0.1 },
    ),
  },
} satisfies Record<string, IExciterPreset>;
