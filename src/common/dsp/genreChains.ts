/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IDspPresetRecipe } from './presetRecipes';

/**
 * What a style switches on besides its own curve.
 *
 * Every EQ genre is also a complete chain, and for a while every one of them
 * was the same chain: its curve and nothing else. Seventy-one styles that
 * differed only in tone, when the thing that actually separates hip-hop
 * from bluegrass on a master is which PROCESSORS are in front of it at all.
 *
 * The rules the table follows, in the order they decide a row:
 *
 * - **One stage owns the bass.** Forge generates what the recording lacks
 *   below; Punch re-times the hit that is already there. Together they are
 *   the overdone low end this catalogue was rebuilt to stop, so a row has one
 *   or neither. Forge goes to the styles built on a synthesised sub — trap,
 *   dubstep, amapiano's log drum, dub, dancehall, reggaeton — and Punch to
 *   the ones built on a struck drum: rock, house, the pop family.
 * - **An Exciter only where the top is clean.** Distorted guitars already
 *   generate their own harmonics, and more of them land in the 5-9 kHz fizz
 *   band, so nothing in the rock family gets one. The styles that do are the
 *   ones whose top is a voice, a string or brass — and they use the top-band
 *   profiles, which leave the octave below to whichever bass stage the row
 *   already chose.
 * - **Width follows how the music was made.** Styles built on a kick and a
 *   bass under a voice narrow the bottom and spend the width above it; styles
 *   recorded in a room keep their low end, because a hall's bass arrives from
 *   everywhere. `dimensionPresets.ts` carries the two families.
 * - **No compression.** The rack carried a hidden multiband compressor until
 *   2026-09-22, set by these rows and shown by no page; Ivan had it removed.
 *   A master arrives compressed and limited already, and glue on top of glue
 *   is the density that measures as loudness and hears as fatigue.
 * - **The Maximizer is a ceiling here, not a loudness tool.** Nearly every
 *   profile these rows name drives it by a decibel or less, and the quiet
 *   genres — classical, jazz, acoustic, reggae — drive it by nothing at all.
 *   Second-pass limiting on an already-limited master buys distortion rather
 *   than level.
 *
 * Levels are measured, not assumed: every chain in this table renders through
 * the real engine against DSP Off and lands within about a decibel of it, so
 * auditioning one is a comparison of sound rather than of volume.
 */
export type TGenreChainStages = Pick<
  IDspPresetRecipe,
  | 'exciter'
  | 'bassForge'
  | 'bassPunch'
  | 'dimension'
  | 'maximizer'
  | 'maximizerDriveDb'
>;

/**
 * Keyed by the EQ genre id, which is also the chain's id.
 *
 * A style with no row here still ships as a chain — its curve alone — so a
 * curve added without a row is a plainer sound rather than a missing one.
 */
export const GENRE_CHAIN_STAGES: Readonly<
  Record<string, TGenreChainStages | undefined>
> = {
  // Pop: a centred voice over a programmed kick, and a top that is meant to
  // sparkle. The ones that lean on a ballad get no transient shaping.
  indiePop: { exciter: 'pop', dimension: 'pop', maximizer: 'pop' },
  synthPop: {
    exciter: 'edm',
    bassPunch: 'electronic',
    dimension: 'pop',
    maximizer: 'pop',
  },
  newWave: {
    exciter: 'pop',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  kPop: {
    exciter: 'pop',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  jPop: {
    exciter: 'pop',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  cPop: { exciter: 'soul', dimension: 'pop', maximizer: 'pop' },

  // Rock: the kick re-timed, the guitars left alone, and the bus compression
  // the genre's own masters have. Progressive keeps its dynamics; grunge and
  // its room are not a sound anything should sharpen.
  classicRock: {
    bassPunch: 'rock',
    dimension: 'rock',
    maximizer: 'rock',
  },
  alternativeRock: {
    bassPunch: 'rock',
    dimension: 'rock',
    maximizer: 'rock',
  },
  indieRock: {
    bassPunch: 'rock',
    dimension: 'rock',
    maximizer: 'rock',
  },
  progressiveRock: {
    dimension: 'rock',
    maximizer: 'rock',
  },
  hardRock: {
    bassPunch: 'rock',
    dimension: 'rock',
    maximizer: 'rock',
  },
  punk: {
    bassPunch: 'rock',
    dimension: 'rock',
    maximizer: 'rock',
  },
  popPunk: {
    bassPunch: 'rock',
    dimension: 'rock',
    maximizer: 'rock',
  },
  grunge: { dimension: 'rock', maximizer: 'rock' },

  // Country and folk: wood, strings and a voice, in a natural picture. Modern
  // country is a pop record with a steel guitar on it, and is treated as one.
  country: {
    exciter: 'country',
    dimension: 'acoustic',
    maximizer: 'acoustic',
  },
  modernCountry: {
    exciter: 'country',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  americana: {
    exciter: 'country',
    dimension: 'acoustic',
    maximizer: 'acoustic',
  },
  bluegrass: {
    exciter: 'country',
    dimension: 'acoustic',
    maximizer: 'acoustic',
  },
  folk: { exciter: 'acoustic', dimension: 'acoustic', maximizer: 'acoustic' },
  singerSongwriter: {
    exciter: 'acoustic',
    dimension: 'acoustic',
    maximizer: 'acoustic',
  },

  // Urban: the 808 is the instrument, so Forge owns it and the image keeps it
  // in the middle. Soul and R&B are sung rather than programmed, and get the
  // silk profile instead of a bass stage.
  rap: { bassForge: 'hiphop', dimension: 'hiphop', maximizer: 'hiphop' },
  trap: { bassForge: 'trap', dimension: 'hiphop', maximizer: 'hiphop' },
  rnb: { exciter: 'soul', dimension: 'pop', maximizer: 'pop' },
  soul: {
    exciter: 'soul',
    dimension: 'jazz',
    maximizer: 'acoustic',
  },
  neoSoul: {
    exciter: 'soul',
    dimension: 'pop',
    maximizer: 'pop',
  },
  funk: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  disco: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },

  // Jazz and blues: played in a room, in front of microphones. Nothing here
  // drives a limiter, and the picture stays the width the record was made at.
  smoothJazz: { exciter: 'soul', dimension: 'jazz', maximizer: 'jazz' },
  fusion: { exciter: 'jazz', dimension: 'jazz', maximizer: 'jazz' },
  blues: { dimension: 'jazz', maximizer: 'jazz' },

  // Classical: the hall's own width, and a ceiling that only ever catches an
  // isolated peak. A crescendo held down is the piece edited.
  orchestra: { dimension: 'classical', maximizer: 'classical' },
  opera: { dimension: 'classical', maximizer: 'classical' },
  piano: { dimension: 'classical', maximizer: 'classical' },
  strings: { dimension: 'classical', maximizer: 'classical' },

  // Dance: a four-on-the-floor kick wants re-timing rather than more weight,
  // and the styles whose bass is a synthesised sub want the opposite.
  edm: {
    exciter: 'edm',
    bassPunch: 'electronic',
    dimension: 'electronic',
    maximizer: 'electronic',
  },
  house: {
    exciter: 'edm',
    bassPunch: 'club',
    dimension: 'electronic',
    maximizer: 'electronic',
  },
  techno: {
    bassPunch: 'club',
    dimension: 'electronic',
    maximizer: 'electronic',
  },
  trance: {
    exciter: 'edm',
    bassPunch: 'electronic',
    dimension: 'electronic',
    maximizer: 'electronic',
  },
  dubstep: {
    bassForge: 'electronic',
    dimension: 'electronic',
    maximizer: 'electronic',
  },
  downtempo: { dimension: 'expansive', maximizer: 'ambient' },
  chillout: { dimension: 'expansive', maximizer: 'ambient' },
  // Dark and soft on purpose. Sharpening any of it would be undoing the
  // record: this one gets the room it is played in and nothing else.
  lofi: { dimension: 'intimate' },
  ambient: { dimension: 'expansive', maximizer: 'ambient' },
  newAge: { dimension: 'expansive', maximizer: 'ambient' },

  // Reggae: the bass line is the lead instrument and the system it is played
  // on sums the bottom to mono, so the picture is a club's.
  dub: { bassForge: 'dub', dimension: 'club', maximizer: 'reggae' },
  dancehall: { bassForge: 'hiphop', dimension: 'club', maximizer: 'reggae' },
  ska: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },

  // Latin: hand percussion and brass up top, a kick underneath, and the
  // guitar-led styles treated as the acoustic music they are.
  latin: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  latinPop: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  reggaeton: {
    bassForge: 'hiphop',
    dimension: 'hiphop',
    maximizer: 'hiphop',
  },
  salsa: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  bachata: { exciter: 'latin', dimension: 'acoustic', maximizer: 'acoustic' },
  merengue: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  cumbia: { exciter: 'latin', dimension: 'pop', maximizer: 'pop' },
  bossaNova: {
    exciter: 'acoustic',
    dimension: 'acoustic',
    maximizer: 'acoustic',
  },
  samba: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  flamenco: {
    exciter: 'acoustic',
    dimension: 'acoustic',
    maximizer: 'acoustic',
  },
  regionalMexican: {
    exciter: 'country',
    dimension: 'acoustic',
    maximizer: 'acoustic',
  },
  corridos: { exciter: 'country', dimension: 'acoustic', maximizer: 'pop' },

  // Africa: highlife and afrobeat are played by a band, afrobeats is produced
  // like a pop record, and amapiano's log drum is a synthesised sub.
  afrobeat: {
    exciter: 'latin',
    dimension: 'pop',
    maximizer: 'pop',
  },
  afrobeats: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  amapiano: {
    bassForge: 'deep',
    dimension: 'electronic',
    maximizer: 'electronic',
  },
  highlife: { exciter: 'latin', dimension: 'pop', maximizer: 'pop' },

  // Everything else, where "world" covers records made in every way there is
  // — so it stays the plainest row in the table.
  world: { dimension: 'default' },
  bollywood: {
    exciter: 'pop',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  bhangra: {
    exciter: 'latin',
    bassPunch: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
  indianClassical: { dimension: 'classical', maximizer: 'classical' },
  // Sung in one voice at the front of the picture, which is what the Exciter's
  // vocal profile works on: the mid channel alone, and never the sides.
  arabicPop: { exciter: 'vocal', dimension: 'pop', maximizer: 'pop' },
  turkishPop: { exciter: 'vocal', dimension: 'pop', maximizer: 'pop' },

  gospel: {
    exciter: 'vocal',
    dimension: 'classical',
    maximizer: 'pop',
  },
  christian: {
    exciter: 'pop',
    dimension: 'pop',
    maximizer: 'pop',
  },
};
