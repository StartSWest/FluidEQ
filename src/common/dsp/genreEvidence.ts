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

/**
 * A genre researched on its own, after its family's digest: it cites its own
 * shelf, not the family's. Ballad (2026-09-25) was tuned from the mixing and
 * mastering press and one large study of genre spectra, none of which the
 * pop digest used.
 */
const GENRE_OWN_SOURCES: Readonly<Record<string, string>> = {
  reggae:
    'iZotope · FabFilter · No Woman, No Cry — Bob Marley & The Wailers · Israelites — Desmond Dekker (Apple previews)',
  dub: 'iZotope · FabFilter · King Tubby Meets Rockers Uptown — Augustus Pablo · Blackboard Jungle Dub — The Upsetters (Apple previews)',
  dancehall:
    'iZotope · FabFilter · Get Busy — Sean Paul · Murder She Wrote — Chaka Demus & Pliers (Apple previews)',
  ska: 'iZotope · FabFilter · A Message to You, Rudy — The Specials · Guns of Navarone — The Skatalites (Apple previews)',
  afrobeat:
    'iZotope · FabFilter · Zombie — Fela Kuti · Water No Get Enemy — Fela Kuti (Apple previews)',
  afrobeats:
    'iZotope · FabFilter · Essence — Wizkid feat. Tems · Last Last — Burna Boy (Apple previews)',
  amapiano:
    'iZotope · FabFilter · Ke Star — Focalistic & Davido · Water — Tyla (Apple previews)',
  highlife:
    'iZotope · FabFilter · Sweet Mother — Prince Nico Mbarga · Joromi — Victor Uwaifo (Apple previews)',
  world:
    'iZotope · FabFilter · Malaika — Miriam Makeba · Mustt Mustt — Nusrat Fateh Ali Khan (Apple previews)',
  bollywood:
    'iZotope · FabFilter · Chaiyya Chaiyya — A. R. Rahman · Tum Hi Ho — Arijit Singh (Apple previews)',
  bhangra:
    'iZotope · FabFilter · Mundian To Bach Ke — Panjabi MC · Tunak Tunak Tun — Daler Mehndi (Apple previews)',
  indianClassical:
    'iZotope · FabFilter · Raga Jog — Ravi Shankar · Raga Darbari — Ustad Amir Khan (Apple previews)',
  arabicPop:
    'iZotope · FabFilter · Nour El Ain — Amr Diab · Ah W Noss — Nancy Ajram (Apple previews)',
  turkishPop:
    'iZotope · FabFilter · Şımarık — Tarkan · Gülümse — Sezen Aksu (Apple previews)',
  gospel:
    'iZotope · FabFilter · Oh Happy Day — Edwin Hawkins Singers · Total Praise — Richard Smallwood (Apple previews)',
  christian:
    'iZotope · FabFilter · Oceans (Where Feet May Fail) — Hillsong United · How Great Is Our God — Chris Tomlin (Apple previews)',
  latin:
    'iZotope · FabFilter · Oye Como Va — Tito Puente · La Vida Es un Carnaval — Celia Cruz (Apple previews)',
  latinPop:
    'iZotope · FabFilter · Livin’ la Vida Loca — Ricky Martin · Hips Don’t Lie — Shakira (Apple previews)',
  reggaeton:
    'iZotope · FabFilter · Gasolina — Daddy Yankee · Dákiti — Bad Bunny & Jhay Cortez (Apple previews)',
  salsa:
    'iZotope · FabFilter · Pedro Navaja — Rubén Blades · Vivir Mi Vida — Marc Anthony (Apple previews)',
  bachata:
    'iZotope · FabFilter · Obsesión — Aventura · Propuesta Indecente — Romeo Santos (Apple previews)',
  merengue:
    'iZotope · FabFilter · Suavemente — Elvis Crespo · La Bilirrubina — Juan Luis Guerra (Apple previews)',
  cumbia:
    'iZotope · FabFilter · La Pollera Colorá — Wilson Choperena · Cumbia sobre el río — Celso Piña (Apple previews)',
  bossaNova:
    'iZotope · FabFilter · The Girl from Ipanema — Stan Getz & João Gilberto · Chega de Saudade — João Gilberto (Apple previews)',
  samba:
    'iZotope · FabFilter · Mas Que Nada — Jorge Ben · O Que É, O Que É? — Gonzaguinha (Apple previews)',
  flamenco:
    'iZotope · FabFilter · Entre Dos Aguas — Paco de Lucía · Malamente — Rosalía (Apple previews)',
  regionalMexican:
    'iZotope · FabFilter · El Rey — Vicente Fernández · Contrabando y Traición — Los Tigres del Norte (Apple previews)',
  corridos:
    'iZotope · FabFilter · Ella Baila Sola — Eslabon Armado & Peso Pluma · AMG — Natanael Cano, Peso Pluma & Gabito Ballesteros (Apple previews)',
  electronic:
    'iZotope · FabFilter · Around the World — Daft Punk · Strobe — deadmau5 (Apple previews)',
  edm: 'iZotope · FabFilter · Levels — Avicii · Animals — Martin Garrix (Apple previews)',
  house:
    'iZotope · FabFilter · Show Me Love — Robin S · Music Sounds Better with You — Stardust (Apple previews)',
  techno:
    'iZotope · FabFilter · Strings of Life — Rhythim Is Rhythim · Spastik — Plastikman (Apple previews)',
  trance:
    'iZotope · FabFilter · Children — Robert Miles · Café del Mar — Energy 52 (Apple previews)',
  drumBass:
    'iZotope · FabFilter · Brown Paper Bag — Roni Size / Reprazent · Tarantula — Pendulum (Apple previews)',
  dubstep:
    'iZotope · FabFilter · Scary Monsters and Nice Sprites — Skrillex · Midnight Request Line — Skream (Apple previews)',
  downtempo:
    'iZotope · FabFilter · Teardrop — Massive Attack · Glory Box — Portishead (Apple previews)',
  chillout:
    'iZotope · FabFilter · Porcelain — Moby · La Femme d’Argent — Air (Apple previews)',
  lofi: 'iZotope · FabFilter · Feather — Nujabes · Affection — Jinsang (Apple previews)',
  ambient:
    'iZotope · FabFilter · An Ending (Ascent) — Brian Eno · Xtal — Aphex Twin (Apple previews)',
  newAge:
    'iZotope · FabFilter · Orinoco Flow — Enya · Reflections of Passion — Yanni (Apple previews)',
  jazz: 'iZotope · FabFilter · So What — Miles Davis · Take Five — The Dave Brubeck Quartet (Apple previews)',
  smoothJazz:
    'iZotope · FabFilter · Songbird — Kenny G · Breezin’ — George Benson (Apple previews)',
  fusion:
    'iZotope · FabFilter · Birdland — Weather Report · Chameleon — Herbie Hancock (Apple previews)',
  blues:
    'iZotope · FabFilter · The Thrill Is Gone — B.B. King · Hoochie Coochie Man — Muddy Waters (Apple previews)',
  classical:
    'iZotope · FabFilter · Symphony No. 5 — Beethoven · The Four Seasons — Vivaldi (Apple previews)',
  orchestra:
    'iZotope · FabFilter · The Rite of Spring — Stravinsky · Symphony No. 9, From the New World — Dvořák (Apple previews)',
  opera:
    'iZotope · FabFilter · Nessun dorma, Turandot — Puccini · Der Hölle Rache, The Magic Flute — Mozart (Apple previews)',
  piano:
    'iZotope · FabFilter · Clair de lune — Debussy · Goldberg Variations — Bach, Glenn Gould (Apple previews)',
  strings:
    'iZotope · FabFilter · Adagio for Strings — Barber · Cello Suite No. 1 — Bach (Apple previews)',
  hiphop:
    'iZotope · FabFilter · C.R.E.A.M. — Wu-Tang Clan · N.Y. State of Mind — Nas (Apple previews)',
  rap: 'iZotope · FabFilter · Lose Yourself — Eminem · HUMBLE. — Kendrick Lamar (Apple previews)',
  trap: 'iZotope · FabFilter · Mask Off — Future · Bad and Boujee — Migos (Apple previews)',
  rnb: 'iZotope · FabFilter · No Scrubs — TLC · Adorn — Miguel (Apple previews)',
  soul: 'iZotope · FabFilter · Respect — Aretha Franklin · What’s Going On — Marvin Gaye (Apple previews)',
  neoSoul:
    'iZotope · FabFilter · On & On — Erykah Badu · Untitled (How Does It Feel) — D’Angelo (Apple previews)',
  funk: 'iZotope · FabFilter · Superstition — Stevie Wonder · Flash Light — Parliament (Apple previews)',
  disco:
    'iZotope · FabFilter · Stayin’ Alive — Bee Gees · Le Freak — Chic (Apple previews)',
  country:
    'iZotope · FabFilter · Jolene — Dolly Parton · He Stopped Loving Her Today — George Jones (Apple previews)',
  modernCountry:
    'iZotope · FabFilter · Meant to Be — Bebe Rexha & Florida Georgia Line · Last Night — Morgan Wallen (Apple previews)',
  americana:
    'iZotope · FabFilter · If We Were Vampires — Jason Isbell and the 400 Unit · Wagon Wheel — Old Crow Medicine Show (Apple previews)',
  bluegrass:
    'iZotope · FabFilter · Foggy Mountain Breakdown — Flatt & Scruggs · Blue Moon of Kentucky — Bill Monroe (Apple previews)',
  folk: 'iZotope · FabFilter · The Times They Are a-Changin’ — Bob Dylan · Both Sides Now — Joni Mitchell (Apple previews)',
  acoustic:
    'iZotope · FabFilter · Blackbird — The Beatles · Dust in the Wind — Kansas (Apple previews)',
  singerSongwriter:
    'iZotope · FabFilter · Fast Car — Tracy Chapman · Hallelujah — Jeff Buckley (Apple previews)',
  rock: 'iZotope · FabFilter · Everlong — Foo Fighters · Seven Nation Army — The White Stripes (Apple previews)',
  popRock:
    'iZotope · FabFilter · Mr. Brightside — The Killers · Clocks — Coldplay (Apple previews)',
  classicRock:
    'iZotope · FabFilter · Hotel California — Eagles · Stairway to Heaven — Led Zeppelin (Apple previews)',
  alternativeRock:
    'iZotope · FabFilter · Creep — Radiohead · Bullet with Butterfly Wings — The Smashing Pumpkins (Apple previews)',
  indieRock:
    'iZotope · FabFilter · Last Nite — The Strokes · Do I Wanna Know? — Arctic Monkeys (Apple previews)',
  progressiveRock:
    'iZotope · FabFilter · Roundabout — Yes · Time — Pink Floyd (Apple previews)',
  hardRock:
    'iZotope · FabFilter · Back in Black — AC/DC · Sweet Child o’ Mine — Guns N’ Roses (Apple previews)',
  metal:
    'iZotope · FabFilter · Master of Puppets — Metallica · Chop Suey! — System of a Down (Apple previews)',
  punk: 'iZotope · FabFilter · Blitzkrieg Bop — Ramones · London Calling — The Clash (Apple previews)',
  popPunk:
    'iZotope · FabFilter · All the Small Things — blink-182 · Basket Case — Green Day (Apple previews)',
  grunge:
    'iZotope · FabFilter · Smells Like Teen Spirit — Nirvana · Black Hole Sun — Soundgarden (Apple previews)',
  indiePop:
    'iZotope · FabFilter · Young Folks — Peter Bjorn and John · Electric Feel — MGMT (Apple previews)',
  synthPop:
    'iZotope · FabFilter · Don’t You Want Me — The Human League · Enjoy the Silence — Depeche Mode (Apple previews)',
  newWave:
    'iZotope · FabFilter · Once in a Lifetime — Talking Heads · Just What I Needed — The Cars (Apple previews)',
  jPop: 'iZotope · FabFilter · Idol — YOASOBI · Lemon — Kenshi Yonezu (Apple previews)',
  cPop: 'iZotope · FabFilter · Tian Mi Mi — Teresa Teng · Qing Tian — Jay Chou (Apple previews)',
  pop: 'iZotope · FabFilter · The Weeknd — Blinding Lights · Dua Lipa — Levitating (Apple preview)',
  kPop: 'BIGHIT MUSIC · YG Entertainment · iZotope · FabFilter · BTS — Dynamite · BLACKPINK — How You Like That (Apple previews)',
  ballad:
    'Sound On Sound · Mix · Waves · Elowsson & Friberg (KTH) · DR Database',
};

/** Where a genre's research came from, or nothing for an id no family has. */
export const genreSources = (id: string): string | undefined =>
  GENRE_OWN_SOURCES[id] ??
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
 *
 * Pop was remeasured on 2026-11-04 against its two named references: the
 * complete Blinding Lights recording and Apple's 30-second Levitating
 * preview. Only its rack and preset curve, with no headphone correction,
 * other EQ or system Auto normalize. Its input is levelled to -18 LUFS;
 * output measured -10.74 and -10.79 LUFS with gentle centre de-essing, both
 * under the -1 dBTP ceiling. Rendering opens no output device and reads no
 * live application settings, so a listener's on/off comparison cannot alter it.
 * Its count below is two, not the older catalogue's twenty-five.
 *
 * K-pop was remeasured on the same date against the original-version Apple
 * previews of Dynamite and How You Like That, with the same isolated method.
 * These are two 30-second excerpts, not whole-track loudness measurements.
 * From a -18 LUFS input they rendered at -10.58 and -11.19 LUFS, below the
 * -1 dBTP ceiling. De-essing changed overall loudness by -0.010/-0.032 LU;
 * repeating was byte-identical and a source 18 dB quieter converged within
 * 0.001 LU. No output device or live application settings were involved.
 */
export const GENRE_MEASURED: Readonly<
  Record<string, readonly [number, number]>
> = {
  pop: [-3.39, -1],
  indiePop: [-4.16, -1.5],
  synthPop: [0.26, -1],
  newWave: [-1.68, -1],
  kPop: [-3.08, -1],
  jPop: [-5.21, -2],
  cPop: [-1.92, -1],
  ballad: [1.93, -1],
  rock: [-3.82, -1.01],
  popRock: [-3.2, -1],
  classicRock: [0.75, -1],
  alternativeRock: [1.46, -1],
  indieRock: [-1.75, -1],
  progressiveRock: [2.69, -1],
  hardRock: [-1.54, -1],
  metal: [0.9, -1],
  punk: [-2.99, -1.62],
  popPunk: [-2.35, -1],
  grunge: [-3.13, -1],
  country: [1.5, -1],
  modernCountry: [-2.37, -1.01],
  americana: [-0.06, -1],
  bluegrass: [-1.4, -1.07],
  folk: [-2.63, -2.51],
  acoustic: [-1.76, -1],
  singerSongwriter: [3.24, -1],
  hiphop: [-3.11, -1],
  rap: [-2.06, -1],
  trap: [-2.9, -1],
  rnb: [-3.74, -1],
  soul: [0.88, -1],
  neoSoul: [0, -1.11],
  funk: [1.2, -1],
  disco: [1.82, -1],
  jazz: [4.4, -1],
  smoothJazz: [0.85, -1],
  fusion: [1.51, -1],
  blues: [1.03, -1],
  classical: [5.84, -1.19],
  orchestra: [6.46, -1.02],
  opera: [-1.5, -1.18],
  piano: [5.01, -1],
  strings: [4.54, -1.05],
  electronic: [-3.23, -1],
  edm: [-1.11, -1],
  house: [-1.27, -1],
  techno: [-2.09, -1],
  trance: [-0.66, -1.38],
  drumBass: [-2.82, -1],
  dubstep: [-4.49, -1],
  downtempo: [-2.92, -1.66],
  chillout: [-4.72, -1.6],
  lofi: [-4.7, -1.1],
  ambient: [-0.79, -3.95],
  newAge: [3.56, -1.02],
  reggae: [-0.82, -1],
  dub: [0.16, -1],
  dancehall: [-1.47, -1],
  ska: [-0.57, -1],
  latin: [-0.9, -1],
  latinPop: [-4.04, -1],
  reggaeton: [-3.58, -1],
  salsa: [-1.11, -1],
  bachata: [-2.37, -1.15],
  merengue: [0.3, -1],
  cumbia: [-3.04, -1.08],
  bossaNova: [2.99, -1.13],
  samba: [-0.42, -1],
  flamenco: [-1.11, -1],
  regionalMexican: [-3.76, -1.03],
  corridos: [-3.42, -1.04],
  afrobeat: [-4.82, -1],
  afrobeats: [-2.36, -1],
  amapiano: [-2.81, -1],
  highlife: [-1.58, -1],
  world: [9.49, -1],
  bollywood: [4.74, -1],
  bhangra: [-1.5, -1],
  indianClassical: [3.6, -1.36],
  arabicPop: [-1.63, -1],
  turkishPop: [0.75, -1],
  gospel: [-1.55, -1.06],
  christian: [-2.09, -1.17],
};

/** How many songs `GENRE_MEASURED` was measured on. */
export const GENRE_MEASURED_SONGS = 25;

/** A retuned genre states the size of its own measurement, not the old corpus. */
const UPDATED_MEASURED_SONGS: Readonly<Record<string, number>> = {
  reggae: 2,
  dub: 2,
  dancehall: 2,
  ska: 2,
  afrobeat: 2,
  afrobeats: 2,
  amapiano: 2,
  highlife: 2,
  world: 2,
  bollywood: 2,
  bhangra: 2,
  indianClassical: 2,
  arabicPop: 2,
  turkishPop: 2,
  gospel: 2,
  christian: 2,
  latin: 2,
  latinPop: 2,
  reggaeton: 2,
  salsa: 2,
  bachata: 2,
  merengue: 2,
  cumbia: 2,
  bossaNova: 2,
  samba: 2,
  flamenco: 2,
  regionalMexican: 2,
  corridos: 2,
  electronic: 2,
  edm: 2,
  house: 2,
  techno: 2,
  trance: 2,
  drumBass: 2,
  dubstep: 2,
  downtempo: 2,
  chillout: 2,
  lofi: 2,
  ambient: 2,
  newAge: 2,
  jazz: 2,
  smoothJazz: 2,
  fusion: 2,
  blues: 2,
  classical: 2,
  orchestra: 2,
  opera: 2,
  piano: 2,
  strings: 2,
  hiphop: 2,
  rap: 2,
  trap: 2,
  rnb: 2,
  soul: 2,
  neoSoul: 2,
  funk: 2,
  disco: 2,
  country: 2,
  modernCountry: 2,
  americana: 2,
  bluegrass: 2,
  folk: 2,
  acoustic: 2,
  singerSongwriter: 2,
  rock: 2,
  popRock: 2,
  classicRock: 2,
  alternativeRock: 2,
  indieRock: 2,
  progressiveRock: 2,
  hardRock: 2,
  metal: 2,
  punk: 2,
  popPunk: 2,
  grunge: 2,
  indiePop: 2,
  synthPop: 2,
  newWave: 2,
  jPop: 2,
  cPop: 2,
  ballad: 2,
  pop: 2,
  kPop: 2,
};

export const genreMeasuredSongs = (id: string): number =>
  UPDATED_MEASURED_SONGS[id] ?? GENRE_MEASURED_SONGS;
