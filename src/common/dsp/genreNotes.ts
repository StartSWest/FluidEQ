/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What each genre preset tells a listener about itself, besides its text.
 *
 * Every genre carries notes (Ivan, 2026-09-24: "an explanation why the genre
 * and why its eq and its freq tuning so users understand the history behind
 * each genre EQ figures ... I want them to value the presets"): a hook under
 * its name in the pickers, where its sound comes from, why its curve moves at
 * the frequencies it moves at, and why each stage of its rack is on or off.
 * The words are in the `genre.<id>.*` keys, in every language; what is here
 * is what is not words — where the pins stand, which records to hear it in,
 * whose research it was tuned from, and what it measured.
 *
 * The notes are written from the research each preset was tuned from and
 * from the preset itself, never ahead of it: a pin's decibels are read off the
 * curve as it plays, and which stages it names on or off is read off the rack.
 * Retune a genre and its notes' words are what may need a second look.
 */
export interface IGenreNote {
  /**
   * The band centres its curve was tuned around, low to high: each is a pin on
   * the curve, with `genre.<id>.pin.<hz>` saying what is there and
   * `genre.<id>.pin.<hz>.why` why it moved (or why it was left alone).
   */
  pins: readonly number[];
  /** Records that show the sound, as "Title — Artist". Names, not translated. */
  listen: readonly string[];
}

export const GENRE_NOTES: Readonly<Record<string, IGenreNote>> = {
  // Pop and its cousins.
  pop: {
    pins: [50, 315, 5000],
    listen: ['Blinding Lights — The Weeknd', 'Levitating — Dua Lipa'],
  },
  indiePop: {
    pins: [50, 315, 1250, 12500],
    listen: ['Young Folks — Peter Bjorn and John', 'Electric Feel — MGMT'],
  },
  synthPop: {
    pins: [125, 500, 12500],
    listen: [
      'Don’t You Want Me — The Human League',
      'Enjoy the Silence — Depeche Mode',
    ],
  },
  newWave: {
    pins: [125, 315, 1250],
    listen: [
      'Once in a Lifetime — Talking Heads',
      'Just What I Needed — The Cars',
    ],
  },
  kPop: {
    pins: [80, 315, 12500],
    listen: ['Dynamite — BTS', 'How You Like That — BLACKPINK'],
  },
  jPop: {
    pins: [125, 500, 3150],
    listen: ['Idol — YOASOBI', 'Lemon — Kenshi Yonezu'],
  },
  cPop: {
    pins: [125, 1250, 12500],
    listen: ['Tian Mi Mi — Teresa Teng', 'Qing Tian — Jay Chou'],
  },
  // Rock and what grew out of it.
  rock: {
    pins: [80, 315, 3150, 12500],
    listen: [
      'Everlong — Foo Fighters',
      'Seven Nation Army — The White Stripes',
    ],
  },
  popRock: {
    pins: [32, 80, 315, 3150],
    listen: ['Mr. Brightside — The Killers', 'Clocks — Coldplay'],
  },
  classicRock: {
    pins: [32, 125, 3150],
    listen: ['Hotel California — Eagles', 'Stairway to Heaven — Led Zeppelin'],
  },
  alternativeRock: {
    pins: [125, 500, 3150, 8000],
    listen: [
      'Creep — Radiohead',
      'Bullet with Butterfly Wings — The Smashing Pumpkins',
    ],
  },
  indieRock: {
    pins: [50, 1250, 8000],
    listen: ['Last Nite — The Strokes', 'Do I Wanna Know? — Arctic Monkeys'],
  },
  progressiveRock: {
    pins: [125, 800, 12500],
    listen: ['Roundabout — Yes', 'Time — Pink Floyd'],
  },
  hardRock: {
    pins: [80, 315, 3150, 12500],
    listen: ['Back in Black — AC/DC', 'Sweet Child o’ Mine — Guns N’ Roses'],
  },
  metal: {
    pins: [32, 80, 315, 3150],
    listen: ['Master of Puppets — Metallica', 'Chop Suey! — System of a Down'],
  },
  punk: {
    pins: [32, 1250, 5000],
    listen: ['Blitzkrieg Bop — Ramones', 'London Calling — The Clash'],
  },
  popPunk: {
    pins: [125, 500, 3150],
    listen: ['All the Small Things — blink-182', 'Basket Case — Green Day'],
  },
  grunge: {
    pins: [125, 2000, 12500],
    listen: [
      'Smells Like Teen Spirit — Nirvana',
      'Black Hole Sun — Soundgarden',
    ],
  },
  // Country, folk and the acoustic styles.
  country: {
    pins: [125, 500, 3150],
    listen: [
      'Jolene — Dolly Parton',
      'He Stopped Loving Her Today — George Jones',
    ],
  },
  modernCountry: {
    pins: [125, 500, 3150],
    listen: [
      'Meant to Be — Bebe Rexha & Florida Georgia Line',
      'Last Night — Morgan Wallen',
    ],
  },
  americana: {
    pins: [125, 800, 3150],
    listen: [
      'If We Were Vampires — Jason Isbell and the 400 Unit',
      'Wagon Wheel — Old Crow Medicine Show',
    ],
  },
  bluegrass: {
    pins: [80, 5000, 12500],
    listen: [
      'Foggy Mountain Breakdown — Flatt & Scruggs',
      'Blue Moon of Kentucky — Bill Monroe',
    ],
  },
  folk: {
    pins: [200, 3150, 12500],
    listen: [
      'The Times They Are a-Changin’ — Bob Dylan',
      'Both Sides Now — Joni Mitchell',
    ],
  },
  acoustic: {
    pins: [32, 5000, 12500],
    listen: ['Blackbird — The Beatles', 'Dust in the Wind — Kansas'],
  },
  singerSongwriter: {
    pins: [80, 2000, 12500],
    listen: ['Fast Car — Tracy Chapman', 'Hallelujah — Jeff Buckley'],
  },
  // Hip-hop, R&B, soul and the dance music that came out of soul.
  hiphop: {
    pins: [50, 500, 12500],
    listen: ['C.R.E.A.M. — Wu-Tang Clan', 'N.Y. State of Mind — Nas'],
  },
  rap: {
    pins: [50, 200, 2000],
    listen: ['Lose Yourself — Eminem', 'HUMBLE. — Kendrick Lamar'],
  },
  trap: {
    pins: [50, 315, 8000],
    listen: ['Mask Off — Future', 'Bad and Boujee — Migos'],
  },
  rnb: {
    pins: [50, 1250, 12500],
    listen: ['No Scrubs — TLC', 'Adorn — Miguel'],
  },
  soul: {
    pins: [32, 80, 5000],
    listen: ['Respect — Aretha Franklin', 'What’s Going On — Marvin Gaye'],
  },
  neoSoul: {
    pins: [125, 1250, 12500],
    listen: ['On & On — Erykah Badu', 'Untitled (How Does It Feel) — D’Angelo'],
  },
  funk: {
    pins: [80, 500, 2000, 12500],
    listen: ['Superstition — Stevie Wonder', 'Flash Light — Parliament'],
  },
  disco: {
    pins: [80, 800, 8000],
    listen: ['Stayin’ Alive — Bee Gees', 'Le Freak — Chic'],
  },
  // Jazz, the blues, and music recorded in a hall.
  jazz: {
    pins: [125, 1250, 12500],
    listen: ['So What — Miles Davis', 'Take Five — The Dave Brubeck Quartet'],
  },
  smoothJazz: {
    pins: [80, 2000, 12500],
    listen: ['Songbird — Kenny G', 'Breezin’ — George Benson'],
  },
  fusion: {
    pins: [80, 315, 12500],
    listen: ['Birdland — Weather Report', 'Chameleon — Herbie Hancock'],
  },
  blues: {
    pins: [50, 200, 5000],
    listen: [
      'The Thrill Is Gone — B.B. King',
      'Hoochie Coochie Man — Muddy Waters',
    ],
  },
  classical: {
    pins: [80, 800, 12500],
    listen: ['Symphony No. 5 — Beethoven', 'The Four Seasons — Vivaldi'],
  },
  orchestra: {
    pins: [125, 800, 12500],
    listen: [
      'The Rite of Spring — Stravinsky',
      'Symphony No. 9, From the New World — Dvořák',
    ],
  },
  opera: {
    pins: [315, 800, 3150],
    listen: [
      'Nessun dorma, Turandot — Puccini',
      'Der Hölle Rache, The Magic Flute — Mozart',
    ],
  },
  piano: {
    pins: [125, 315, 5000],
    listen: [
      'Clair de lune — Debussy',
      'Goldberg Variations — Bach, Glenn Gould',
    ],
  },
  strings: {
    pins: [200, 2000, 12500],
    listen: ['Adagio for Strings — Barber', 'Cello Suite No. 1 — Bach'],
  },
  // Electronic music, from the club to the chill-out room.
  electronic: {
    pins: [50, 315, 8000],
    listen: ['Around the World — Daft Punk', 'Strobe — deadmau5'],
  },
  edm: {
    pins: [80, 315, 5000],
    listen: ['Levels — Avicii', 'Animals — Martin Garrix'],
  },
  house: {
    pins: [80, 500, 12500],
    listen: [
      'Show Me Love — Robin S',
      'Music Sounds Better with You — Stardust',
    ],
  },
  techno: {
    pins: [80, 800, 5000],
    listen: ['Strings of Life — Rhythim Is Rhythim', 'Spastik — Plastikman'],
  },
  trance: {
    pins: [50, 315, 3150],
    listen: ['Children — Robert Miles', 'Café del Mar — Energy 52'],
  },
  drumBass: {
    pins: [50, 500, 5000],
    listen: ['Brown Paper Bag — Roni Size / Reprazent', 'Tarantula — Pendulum'],
  },
  dubstep: {
    pins: [32, 80, 500],
    listen: [
      'Scary Monsters and Nice Sprites — Skrillex',
      'Midnight Request Line — Skream',
    ],
  },
  downtempo: {
    pins: [50, 2000, 12500],
    listen: ['Teardrop — Massive Attack', 'Glory Box — Portishead'],
  },
  chillout: {
    pins: [80, 2000, 12500],
    listen: ['Porcelain — Moby', 'La Femme d’Argent — Air'],
  },
  lofi: {
    pins: [32, 200, 3150],
    listen: ['Feather — Nujabes', 'Affection — Jinsang'],
  },
  ambient: {
    pins: [50, 800, 12500],
    listen: ['An Ending (Ascent) — Brian Eno', 'Xtal — Aphex Twin'],
  },
  newAge: {
    pins: [200, 2000, 12500],
    listen: ['Orinoco Flow — Enya', 'Reflections of Passion — Yanni'],
  },
  // Jamaica.
  reggae: {
    pins: [80, 500, 12500],
    listen: [
      'No Woman, No Cry — Bob Marley & The Wailers',
      'Israelites — Desmond Dekker',
    ],
  },
  dub: {
    pins: [50, 500, 8000],
    listen: [
      'King Tubby Meets Rockers Uptown — Augustus Pablo',
      'Blackboard Jungle Dub — The Upsetters',
    ],
  },
  dancehall: {
    pins: [80, 315, 1250],
    listen: ['Get Busy — Sean Paul', 'Murder She Wrote — Chaka Demus & Pliers'],
  },
  ska: {
    pins: [32, 80, 315, 2000],
    listen: [
      'A Message to You, Rudy — The Specials',
      'Guns of Navarone — The Skatalites',
    ],
  },
  // Latin music.
  latin: {
    pins: [80, 315, 3150, 12500],
    listen: [
      'Oye Como Va — Tito Puente',
      'La Vida Es un Carnaval — Celia Cruz',
    ],
  },
  latinPop: {
    pins: [50, 200, 3150],
    listen: ['Livin’ la Vida Loca — Ricky Martin', 'Hips Don’t Lie — Shakira'],
  },
  reggaeton: {
    pins: [50, 315, 5000],
    listen: ['Gasolina — Daddy Yankee', 'Dákiti — Bad Bunny & Jhay Cortez'],
  },
  salsa: {
    pins: [80, 315, 1250, 12500],
    listen: ['Pedro Navaja — Rubén Blades', 'Vivir Mi Vida — Marc Anthony'],
  },
  bachata: {
    pins: [50, 1250, 8000],
    listen: ['Obsesión — Aventura', 'Propuesta Indecente — Romeo Santos'],
  },
  merengue: {
    pins: [80, 315, 5000],
    listen: ['Suavemente — Elvis Crespo', 'La Bilirrubina — Juan Luis Guerra'],
  },
  cumbia: {
    pins: [125, 315, 12500],
    listen: [
      'La Pollera Colorá — Wilson Choperena',
      'Cumbia sobre el río — Celso Piña',
    ],
  },
  bossaNova: {
    pins: [125, 800, 5000],
    listen: [
      'The Girl from Ipanema — Stan Getz & João Gilberto',
      'Chega de Saudade — João Gilberto',
    ],
  },
  samba: {
    pins: [80, 315, 5000],
    listen: ['Mas Que Nada — Jorge Ben', 'O Que É, O Que É? — Gonzaguinha'],
  },
  flamenco: {
    pins: [50, 2000, 12500],
    listen: ['Entre Dos Aguas — Paco de Lucía', 'Malamente — Rosalía'],
  },
  regionalMexican: {
    pins: [80, 1250, 3150, 12500],
    listen: [
      'El Rey — Vicente Fernández',
      'Contrabando y Traición — Los Tigres del Norte',
    ],
  },
  corridos: {
    pins: [80, 315, 12500],
    listen: [
      'Ella Baila Sola — Eslabon Armado & Peso Pluma',
      'AMG — Natanael Cano, Peso Pluma & Gabito Ballesteros',
    ],
  },
  // Africa, South Asia, the Middle East, and sacred music.
  afrobeat: {
    pins: [80, 315, 800, 3150],
    listen: ['Zombie — Fela Kuti', 'Water No Get Enemy — Fela Kuti'],
  },
  afrobeats: {
    pins: [50, 800, 12500],
    listen: ['Essence — Wizkid feat. Tems', 'Last Last — Burna Boy'],
  },
  amapiano: {
    pins: [125, 500, 8000],
    listen: ['Ke Star — Focalistic & Davido', 'Water — Tyla'],
  },
  highlife: {
    pins: [80, 315, 3150],
    listen: ['Sweet Mother — Prince Nico Mbarga', 'Joromi — Victor Uwaifo'],
  },
  world: {
    pins: [32, 3150, 12500],
    listen: ['Malaika — Miriam Makeba', 'Mustt Mustt — Nusrat Fateh Ali Khan'],
  },
  bollywood: {
    pins: [80, 315, 2000],
    listen: ['Chaiyya Chaiyya — A. R. Rahman', 'Tum Hi Ho — Arijit Singh'],
  },
  bhangra: {
    pins: [50, 500, 2000],
    listen: [
      'Mundian To Bach Ke — Panjabi MC',
      'Tunak Tunak Tun — Daler Mehndi',
    ],
  },
  indianClassical: {
    pins: [125, 800, 12500],
    listen: ['Raga Jog — Ravi Shankar', 'Raga Darbari — Ustad Amir Khan'],
  },
  arabicPop: {
    pins: [80, 500, 1250, 5000],
    listen: ['Nour El Ain — Amr Diab', 'Ah W Noss — Nancy Ajram'],
  },
  turkishPop: {
    pins: [80, 315, 1250, 8000],
    listen: ['Şımarık — Tarkan', 'Gülümse — Sezen Aksu'],
  },
  gospel: {
    pins: [80, 315, 2000],
    listen: [
      'Oh Happy Day — Edwin Hawkins Singers',
      'Total Praise — Richard Smallwood',
    ],
  },
  christian: {
    pins: [80, 800, 3150],
    listen: [
      'Oceans (Where Feet May Fail) — Hillsong United',
      'How Great Is Our God — Chris Tomlin',
    ],
  },
};
