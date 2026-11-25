/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { ILyricsLine } from 'common/library/lyrics';
import type { ILibraryRoot, ILibraryTrack } from 'common/library/types';
import {
  FAVORITES_PLAYLIST_ID,
  type ILibraryPlaylist,
} from 'common/library/playlists';
import type { ITrackTagSheet, TTagFields } from 'common/library/tagFields';
import {
  PICTURE_COVERS,
  pictureCover,
} from '../../components/featureTour/playerPictureData';
import type { ILibraryRailWidth } from '../../library/LibraryRailSplitter';

/**
 * The made-up collection Help's Library drawings shelve (`libraryFigures`,
 * `libraryPaneFigures`, `libraryTagFigure`): a dozen albums by invented
 * artists with drawn covers, the record that is playing, what Up next holds,
 * the playing song's timed words and an untagged folder for Fix tags. The
 * first five albums are the Compact player's own (`playerPictureData`), so
 * the player's picture and the Library's tell one story. Nothing here is
 * anybody's music, and nothing is read from the reader's library.
 */

const nothing = () => undefined;

/**
 * The studio rail's width in the Library's and Online Media's drawings:
 * the drawings' own, never read from or written to the reader's
 * (`useRailWidth`), and never dragged, a figure being inert.
 */
export const HELP_RAIL: ILibraryRailWidth = {
  width: 216,
  isResizing: false,
  storageKey: '',
  setWidth: nothing,
  setIsResizing: nothing,
};

/** The seven covers the player's picture has no album for. */
const MORE_COVERS = {
  // Glass panes over a harbour at night.
  glassHarbour: pictureCover(
    '<rect width="120" height="120" fill="#0d2230"/>' +
      '<path d="M0 84 L40 30 L64 70Z" fill="#1f6f7a" opacity=".9"/><path d="M30 120 L74 22 L120 96 V120Z" fill="#2fa3a0" opacity=".55"/>' +
      '<path d="M70 120 L104 48 L120 70 V120Z" fill="#e7c66b" opacity=".75"/><circle cx="92" cy="26" r="8" fill="#f4e3a6"/>',
  ),
  // A low sun over red dunes.
  desertStatic: pictureCover(
    '<defs><linearGradient id="d" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffb35c"/><stop offset="1" stop-color="#d4462f"/></linearGradient></defs>' +
      '<rect width="120" height="120" fill="url(#d)"/><circle cx="60" cy="58" r="22" fill="#fff0c9" opacity=".9"/>' +
      '<path d="M0 80 Q30 64 62 78 T120 74 V120 H0Z" fill="#8e2a22"/><path d="M0 96 Q40 82 80 96 T120 92 V120 H0Z" fill="#5c1a1a"/>',
  ),
  // City lights out of focus on deep blue.
  midnightTram: pictureCover(
    '<rect width="120" height="120" fill="#0b1240"/>' +
      '<g opacity=".85"><circle cx="26" cy="40" r="14" fill="#ff7ab6" opacity=".55"/><circle cx="70" cy="30" r="10" fill="#ffd36e" opacity=".6"/>' +
      '<circle cx="96" cy="58" r="16" fill="#5fd0ff" opacity=".45"/><circle cx="44" cy="76" r="12" fill="#ffb15c" opacity=".55"/>' +
      '<circle cx="84" cy="94" r="9" fill="#c38bff" opacity=".6"/></g><rect y="104" width="120" height="3" fill="#ffd36e" opacity=".7"/>',
  ),
  // Petals opening in pink and cyan.
  polarBloom: pictureCover(
    '<rect width="120" height="120" fill="#1a0f2e"/>' +
      '<g transform="translate(60 60)"><g fill="#ff6fb1" opacity=".55"><ellipse rx="12" ry="40"/><ellipse rx="12" ry="40" transform="rotate(60)"/><ellipse rx="12" ry="40" transform="rotate(120)"/></g>' +
      '<g fill="#5ff0e6" opacity=".45"><ellipse rx="8" ry="28" transform="rotate(30)"/><ellipse rx="8" ry="28" transform="rotate(90)"/><ellipse rx="8" ry="28" transform="rotate(150)"/></g>' +
      '<circle r="7" fill="#fff4fb"/></g>',
  ),
  // Copper hills under a pale sky.
  copperSky: pictureCover(
    '<rect width="120" height="120" fill="#f0d9b5"/>' +
      '<path d="M0 70 L30 46 L58 66 L86 38 L120 62 V120 H0Z" fill="#c4743c"/><path d="M0 88 L36 68 L70 86 L100 70 L120 80 V120 H0Z" fill="#8a4a25"/>' +
      '<path d="M0 104 L44 92 L84 106 L120 96 V120 H0Z" fill="#4e2a17"/>',
  ),
  // A kite over striped sea.
  kitesLisbon: pictureCover(
    '<rect width="120" height="120" fill="#1e5fa8"/><g fill="#f5c542"><rect y="84" width="120" height="6"/><rect y="98" width="120" height="6"/><rect y="112" width="120" height="6"/></g>' +
      '<path d="M70 18 L88 40 L70 62 L52 40Z" fill="#ff5a4e"/><path d="M70 18 V62M52 40 H88" stroke="#fff" stroke-width="1.2"/>' +
      '<path d="M70 62 Q62 72 72 80 T66 96" fill="none" stroke="#fff" stroke-width="1.2"/>',
  ),
  // Machines humming in a grid of dots.
  hushMachines: pictureCover(
    '<defs><linearGradient id="h" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a2a3a"/><stop offset="1" stop-color="#111118"/></linearGradient></defs>' +
      '<rect width="120" height="120" fill="url(#h)"/>' +
      `<g fill="#9ef0b4">${Array.from({ length: 36 }, (_, at) => {
        const x = 20 + (at % 6) * 16;
        const y = 20 + Math.floor(at / 6) * 16;
        const r = 1.2 + ((at * 7) % 5) * 0.8;
        return `<circle cx="${x}" cy="${y}" r="${r}" opacity=".${4 + ((at * 3) % 6)}"/>`;
      }).join('')}</g>`,
  ),
};

export interface IHelpAlbum {
  id: string;
  title: string;
  artist: string;
  year: number;
  genre: string;
  songs: number;
  cover: string;
}

/** The Albums shelf, in the order Recently added puts it. */
export const HELP_ALBUMS: readonly IHelpAlbum[] = [
  {
    id: 'neon-weather',
    title: 'Neon Weather',
    artist: 'Velvet Circuit',
    year: 2024,
    genre: 'Synthpop',
    songs: 10,
    cover: PICTURE_COVERS.neonWeather,
  },
  {
    id: 'paper-moons',
    title: 'Paper Moons',
    artist: 'Kestrel Bay',
    year: 2022,
    genre: 'Indie folk',
    songs: 9,
    cover: PICTURE_COVERS.paperMoons,
  },
  {
    id: 'slow-currents',
    title: 'Slow Currents',
    artist: 'Mono Atlas',
    year: 2023,
    genre: 'Ambient',
    songs: 8,
    cover: PICTURE_COVERS.slowCurrents,
  },
  {
    id: 'midnight-tram',
    title: 'Midnight Tram',
    artist: 'Clara Vossberg',
    year: 2025,
    genre: 'Soul',
    songs: 12,
    cover: MORE_COVERS.midnightTram,
  },
  {
    id: 'coastlines',
    title: 'Coastlines',
    artist: 'Aurora Lane',
    year: 2021,
    genre: 'Dream pop',
    songs: 11,
    cover: PICTURE_COVERS.coastlines,
  },
  {
    id: 'glass-harbour',
    title: 'Glass Harbour',
    artist: 'The Lumen Assembly',
    year: 2019,
    genre: 'Jazz',
    songs: 7,
    cover: MORE_COVERS.glassHarbour,
  },
  {
    id: 'frequencies',
    title: 'Frequencies',
    artist: 'Northbound Echo',
    year: 2020,
    genre: 'Electronic',
    songs: 10,
    cover: PICTURE_COVERS.frequencies,
  },
  {
    id: 'polar-bloom',
    title: 'Polar Bloom',
    artist: 'Saltmarsh Radio',
    year: 2023,
    genre: 'Electronic',
    songs: 9,
    cover: MORE_COVERS.polarBloom,
  },
  {
    id: 'desert-static',
    title: 'Desert Static',
    artist: 'Rustline',
    year: 2018,
    genre: 'Rock',
    songs: 11,
    cover: MORE_COVERS.desertStatic,
  },
  {
    id: 'kites-over-lisbon',
    title: 'Kites over Lisbon',
    artist: 'Marisol Duartez',
    year: 2022,
    genre: 'Bossa nova',
    songs: 10,
    cover: MORE_COVERS.kitesLisbon,
  },
  {
    id: 'copper-sky',
    title: 'Copper Sky',
    artist: 'Copperline Hollow',
    year: 2017,
    genre: 'Indie rock',
    songs: 12,
    cover: MORE_COVERS.copperSky,
  },
  {
    id: 'hush-machines',
    title: 'Hush Machines',
    artist: 'Tin Orchard',
    year: 2024,
    genre: 'Downtempo',
    songs: 8,
    cover: MORE_COVERS.hushMachines,
  },
];

/** The library's folder, and what the rail and the status line count. */
export const HELP_ROOTS: readonly ILibraryRoot[] = [
  {
    id: 'root-music',
    path: 'D:\\Music',
    addedAt: 0,
    trackCount: 1284,
    karaokeSkipped: 0,
  },
];

export const HELP_COUNTS = {
  album: 112,
  artist: 64,
  genre: 18,
  song: 1284,
  video: 23,
} as const;

/** Favourites and the reader's own playlists, as the rail lists them. */
export const HELP_PLAYLISTS: readonly ILibraryPlaylist[] = [
  {
    id: FAVORITES_PLAYLIST_ID,
    name: 'Favourites',
    isBuiltIn: true,
    trackIds: Array.from({ length: 48 }, (_, at) => `f${at}`),
    createdAt: 0,
    updatedAt: 0,
  },
  {
    id: 'pl-night-drive',
    name: 'Night drive',
    trackIds: Array.from({ length: 27 }, (_, at) => `n${at}`),
    createdAt: 1,
    updatedAt: 1,
  },
  {
    id: 'pl-sunday',
    name: 'Sunday morning',
    trackIds: Array.from({ length: 19 }, (_, at) => `s${at}`),
    createdAt: 2,
    updatedAt: 2,
  },
];

const album = (id: string): IHelpAlbum => {
  const found = HELP_ALBUMS.find((entry) => entry.id === id);
  if (!found) {
    throw new Error(`No made-up album ${id}`);
  }
  return found;
};

/** One made-up song of `albumId`, as the Library holds a track. */
const song = (
  albumId: string,
  trackNo: number,
  title: string,
  seconds: number,
): ILibraryTrack & { cover: string } => {
  const record = album(albumId);
  return {
    id: `${albumId}-${trackNo}`,
    rootId: 'root-music',
    path: `D:/Music/${record.artist}/${record.title}/${String(trackNo).padStart(2, '0')} ${title}.flac`,
    kind: 'audio',
    isPlayable: true,
    title,
    artist: record.artist,
    albumArtist: record.artist,
    album: record.title,
    trackNo,
    year: record.year,
    genre: record.genre,
    durationMs: seconds * 1000,
    sizeBytes: 0,
    mtimeMs: 0,
    addedAt: 0,
    cover: record.cover,
  };
};

/** The record the queue's chapter opens: Neon Weather, every song. */
export const HELP_RECORD = album('neon-weather');

export const HELP_RECORD_SONGS = [
  song('neon-weather', 1, 'Signal Bloom', 214),
  song('neon-weather', 2, 'Afterglow Avenue', 245),
  song('neon-weather', 3, 'Low Orbit', 302),
  song('neon-weather', 4, 'Chrome Hearts Club', 228),
  song('neon-weather', 5, 'Static on the Line', 197),
  song('neon-weather', 6, 'Weather Report', 263),
  song('neon-weather', 7, 'Satellite Kiss', 239),
  song('neon-weather', 8, 'Rain in Neon', 251),
  song('neon-weather', 9, 'Late Bus Home', 286),
  song('neon-weather', 10, 'Night Swim', 318),
];

/** Which of the record's songs plays: the second, Afterglow Avenue. */
export const HELP_PLAYING = HELP_RECORD_SONGS[1];

/** What Up next holds after it: the rest of the record, then two picks. */
export const HELP_UP_NEXT = {
  rest: HELP_RECORD_SONGS.slice(2, 6),
  added: [
    song('slow-currents', 3, 'Tidewater', 204),
    song('coastlines', 5, 'Lanterns', 235),
  ],
};

/** Where the playing song is, in milliseconds. */
export const HELP_POSITION_MS = 68_600;

/**
 * The playing song's timed words, line by line and word by word, as an
 * enhanced .lrc beside the song holds them; the line at `HELP_POSITION_MS`
 * is lit up to its third word.
 */
const LYRIC_LINES: readonly [number, string][] = [
  [41_000, 'Streetlights hum a quiet tune'],
  [45_400, 'Every window holds a moon'],
  [49_900, 'We keep walking, no one knows'],
  [54_300, 'Where the afterglow still goes'],
  [58_800, ''],
  [60_500, 'Down the avenue we run'],
  [64_400, 'Chasing colours of the sun'],
  [67_200, 'Hold the light before it fades'],
  [71_600, 'Paint the night in amber shades'],
  [76_000, 'Down the avenue, down the avenue'],
  [80_400, 'Every sign is calling you'],
  [84_800, ''],
  [86_400, 'Neon rivers, paper skies'],
  [90_700, 'Echoes dancing in your eyes'],
];

export const HELP_LYRICS: ILyricsLine[] = LYRIC_LINES.map(
  ([timeMs, text], at) => {
    const next = LYRIC_LINES[at + 1]?.[0] ?? timeMs + 4_000;
    const words = text === '' ? [] : text.split(' ');
    const step = (next - timeMs) / Math.max(1, words.length + 1);
    return {
      timeMs,
      text,
      words:
        words.length === 0
          ? undefined
          : words.map((word, index) => ({
              timeMs: Math.round(timeMs + index * step),
              text: index < words.length - 1 ? `${word} ` : word,
            })),
    };
  },
);

/** The lyrics file beside the playing song, by name. */
export const HELP_LYRICS_FILE = '02 Afterglow Avenue.lrc';

/**
 * An album as it came off an old rip: Kestrel Bay's Paper Moons, its files
 * named "01 - harbour lights.mp3", its folder spelled the way Fix tags reads
 * ("[Indie folk]\Kestrel Bay\Kestrel Bay - 2022 - Paper Moons"), and nothing
 * in its tags but a stray artist on two songs and a title left on one.
 */
const UNTAGGED: readonly {
  name: string;
  seconds: number;
  fields: TTagFields;
}[] = [
  { name: 'harbour lights', seconds: 221, fields: {} },
  { name: 'paper moons', seconds: 238, fields: { artist: 'Kestrel Bay' } },
  { name: 'the long way north', seconds: 254, fields: {} },
  { name: 'salt and cedar', seconds: 197, fields: { title: 'Salt & Cedar' } },
  { name: 'lantern season', seconds: 243, fields: {} },
  { name: 'winter almanac', seconds: 266, fields: { artist: 'Kestrel Bay' } },
  { name: 'tidelines', seconds: 209, fields: {} },
  { name: 'the quiet field', seconds: 231, fields: {} },
  { name: 'homeward', seconds: 288, fields: {} },
];

/** Spelled as main reads it, with the system's own separators. */
const UNTAGGED_FOLDER =
  'D:\\Music\\[Indie folk]\\Kestrel Bay\\Kestrel Bay - 2022 - Paper Moons';

export const HELP_TAG_SHEETS: ITrackTagSheet[] = UNTAGGED.map(
  ({ name, fields }, at) => ({
    trackId: `paper-moons-raw-${at + 1}`,
    fileName: `${String(at + 1).padStart(2, '0')} - ${name}.mp3`,
    folder: UNTAGGED_FOLDER,
    format: 'mp3',
    tagsInFile: ['ID3v2.3'],
    id3v2Version: 3,
    canChooseId3v2Version: true,
    hasId3v1: false,
    fields: { ...fields },
    codes: {},
    extras: [],
    canAddExtras: true,
    isReadOnly: false,
  }),
);

/** The same songs as the Library holds them, for the sheet's Time column. */
export const HELP_TAG_TRACKS: ReadonlyMap<string, ILibraryTrack> = new Map(
  HELP_TAG_SHEETS.map((sheet, at) => [
    sheet.trackId,
    {
      id: sheet.trackId,
      rootId: 'root-music',
      path: `${sheet.folder}\\${sheet.fileName}`,
      kind: 'audio',
      isPlayable: true,
      title: sheet.fields.title ?? sheet.fileName.replace(/\.mp3$/, ''),
      durationMs: (UNTAGGED[at]?.seconds ?? 0) * 1000,
      sizeBytes: 0,
      mtimeMs: 0,
      addedAt: 0,
    },
  ]),
);
