/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import COUNTRY_RACKS from './genres/country';
import ELECTRONIC_RACKS from './genres/electronic';
import JAZZ_CLASSICAL_RACKS from './genres/jazzClassical';
import LATIN_RACKS from './genres/latin';
import POP_RACKS from './genres/pop';
import REGGAE_RACKS from './genres/reggae';
import ROCK_RACKS from './genres/rock';
import URBAN_RACKS from './genres/urban';
import WORLD_RACKS from './genres/world';
import type { IGenreRack } from './genreRack';

// What the genre notes cite (`genreNotes.ts`): whose research each family was
// tuned from, and what each chain measured. Apart from the notes because both
// are evidence about a preset rather than words about it, and both move only
// when the research or the preset does.

/**
 * Whose research each family was tuned from, named as the sources name
 * themselves. One line per family: the digests were written a family at a
 * time, and every genre in one cites the same shelf.
 */
const FAMILY_SOURCES: readonly (readonly [readonly IGenreRack[], string])[] = [
  [
    POP_RACKS,
    'Mastering The Mix · Billboard top-10 survey · HOFA · Studio Nol · DR Database',
  ],
  [
    ROCK_RACKS,
    'DR Database · Freshly Baked LUFS by genre · Sage Audio · iZotope · Sound On Sound',
  ],
  [
    COUNTRY_RACKS,
    'Freshly Baked LUFS by genre · Sage Audio · iZotope · DR Database',
  ],
  [
    URBAN_RACKS,
    'Freshly Baked LUFS by genre · iZotope · Kirchberger & Russo · Sound On Sound',
  ],
  [
    JAZZ_CLASSICAL_RACKS,
    'Freshly Baked LUFS by genre · Sage Audio · Kirchberger & Russo · Sound On Sound',
  ],
  [
    ELECTRONIC_RACKS,
    'iZotope · Freshly Baked LUFS by genre · Attack Magazine · Sound On Sound · DR Database',
  ],
  [
    REGGAE_RACKS,
    'Freshly Baked LUFS by genre · DR Database · Sound On Sound · Mixgraph',
  ],
  [
    LATIN_RACKS,
    'Freshly Baked LUFS by genre · Sage Audio · Sound On Sound · Mixgraph · DR Database',
  ],
  [
    WORLD_RACKS,
    'Freshly Baked LUFS by genre · Sound On Sound · Mixgraph · DR Database',
  ],
];

/** Where a genre's research came from, or nothing for an id no family has. */
export const genreSources = (id: string): string | undefined =>
  FAMILY_SOURCES.find(([racks]) => racks.some((rack) => rack.id === id))?.[1];

/**
 * What each genre's chain measured, as [loudness against DSP Off in LU,
 * highest true peak after its curve in dBTP].
 *
 * Measured 2026-09-25 by rendering every chain, its curve after its rack as
 * the app sends them, over a 25-song corpus through the engine's own chain:
 * the mean K-weighted loudness change against the song untouched, both
 * through the engine's Auto normalize as they are heard with it on, and the
 * highest true peak of any song after the curve. A number on a screen about
 * a preset is a claim, so it is the preset's own, not the genre's: retune a
 * rack, a curve or the Maximizer and measure again — with Auto normalize
 * after both, or every figure comes out about 1.2 LU lower than the ones
 * beside it.
 */
export const GENRE_MEASURED: Readonly<
  Record<string, readonly [number, number]>
> = {
  pop: [0.41, -0.88],
  indiePop: [0.69, -0.86],
  synthPop: [0.28, -0.88],
  newWave: [0.35, -0.86],
  kPop: [0.39, -0.86],
  jPop: [0.63, -0.86],
  cPop: [0.24, -0.86],
  rock: [0.6, -0.86],
  popRock: [0.51, -0.87],
  classicRock: [0.28, -0.86],
  alternativeRock: [0.41, -0.89],
  indieRock: [0.59, -0.89],
  progressiveRock: [0.16, -0.86],
  hardRock: [0.61, -0.87],
  metal: [0.14, -0.88],
  punk: [0.41, -0.86],
  popPunk: [0.42, -0.86],
  grunge: [0.38, -0.87],
  country: [0.59, -0.88],
  modernCountry: [0.36, -0.87],
  americana: [0.23, -0.87],
  bluegrass: [0.21, -0.88],
  folk: [0.35, -0.87],
  acoustic: [0.34, -0.86],
  singerSongwriter: [0.25, -0.88],
  hiphop: [0.28, -0.89],
  rap: [0.55, -0.87],
  trap: [-0.08, -0.87],
  rnb: [0.54, -0.87],
  soul: [0.39, -0.88],
  neoSoul: [0.27, -0.89],
  funk: [0.53, -0.86],
  disco: [0.43, -0.86],
  jazz: [-0.07, -0.88],
  smoothJazz: [0.3, -0.86],
  fusion: [0.33, -0.86],
  blues: [0.06, -0.91],
  classical: [0.09, -0.88],
  orchestra: [-0.02, -0.9],
  opera: [0.1, -0.88],
  piano: [0.01, -0.87],
  strings: [-0.43, -0.86],
  electronic: [0.37, -0.86],
  edm: [0.06, -0.86],
  house: [0.47, -0.87],
  techno: [0.32, -0.86],
  trance: [0.42, -0.86],
  drumBass: [0.06, -0.88],
  dubstep: [0.29, -0.9],
  downtempo: [0.26, -0.89],
  chillout: [0.14, -0.86],
  lofi: [0.15, -0.87],
  ambient: [-0.19, -0.87],
  newAge: [-0.01, -0.87],
  reggae: [0.19, -0.88],
  dub: [0.03, -0.86],
  dancehall: [0.54, -0.86],
  ska: [0.64, -0.87],
  latin: [0.55, -0.87],
  latinPop: [0.29, -0.88],
  reggaeton: [0.31, -0.86],
  salsa: [0.44, -0.87],
  bachata: [0.69, -0.88],
  merengue: [0.62, -0.88],
  cumbia: [0.3, -0.88],
  bossaNova: [0, -0.86],
  samba: [0.58, -0.88],
  flamenco: [0.2, -0.88],
  regionalMexican: [0.54, -0.87],
  corridos: [0.51, -0.87],
  afrobeat: [0.15, -0.86],
  afrobeats: [0.46, -0.86],
  amapiano: [0.41, -0.87],
  highlife: [0.27, -0.87],
  world: [0.2, -0.86],
  bollywood: [0.34, -0.87],
  bhangra: [0.28, -0.89],
  indianClassical: [0.04, -0.88],
  arabicPop: [0.43, -0.89],
  turkishPop: [0.37, -0.87],
  gospel: [0.26, -0.88],
  christian: [0.31, -0.88],
};

/** How many songs `GENRE_MEASURED` was measured on. */
export const GENRE_MEASURED_SONGS = 25;
