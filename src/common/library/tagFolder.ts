/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { FOLDER_ART_EXTENSIONS, findFolderArt } from './folderArt';
import { stripJunk } from './tagText';

/** Where a value read from the folders came from. */
export type TFolderSource = 'folder' | 'parentFolder';

export interface IFolderValue {
  value: string;
  source: TFolderSource;
}

/** What an album's folders say about it, where they say anything. */
export interface IFolderTags {
  album?: IFolderValue;
  artist?: IFolderValue;
  year?: IFolderValue;
  genre?: IFolderValue;
  discNo?: IFolderValue;
}

/**
 * Folder names that hold music but name nothing about it: "D:\Music\Album"
 * must not make "Music" the artist. Compared after `nameKey`.
 */
const GENERIC_NAMES = new Set([
  'music',
  'musica',
  'musik',
  'musique',
  'muziek',
  'musiche',
  'my music',
  'mi musica',
  'mis canciones',
  'mp3',
  'mp3s',
  'flac',
  'audio',
  'songs',
  'canciones',
  'albums',
  'albumes',
  'downloads',
  'download',
  'descargas',
  'desktop',
  'escritorio',
  'documents',
  'documentos',
  'itunes',
  'itunes media',
  'media',
  'library',
  'biblioteca',
  'new folder',
  'nueva carpeta',
  'onedrive',
  'users',
  'usuarios',
]);

/** "Various Artists" is a fine album artist and nobody's song artist. */
const VARIOUS_NAMES = new Set([
  'various artists',
  'various',
  'va',
  'varios artistas',
  'varios',
  'artistes divers',
  'verschiedene interpreten',
  'artisti vari',
  'varios interpretes',
]);

const nameKey = (name: string): string =>
  name.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase().trim();

/** A disc folder inside an album: "CD1", "Disc 2", "Disco 1", "CD 03". */
const DISC_FOLDER = /^(?:cd|disc|disk|disco|disque)\s*0*(\d{1,2})$/i;

/** A whole name in brackets is a shelf label: "[Rock]", "(Jazz)". */
const LABEL_FOLDER = /^\s*[[(]([^\])]+)[\])]\s*$/;

/**
 * Brackets that describe the files, not the album: "[FLAC]", "(320 kbps)",
 * "[24bit-96kHz]", "(Web)". Edition names ("(Deluxe Edition)") stay.
 */
const FORMAT_BRACKET =
  /\s*[[(](?:[^\])]*\b(?:flac|mp3|aac|ogg|opus|m4a|alac|wav|ape|wv|kbps|kbit|vbr|cbr|v0|v2|\d+\s*-?\s*bits?|\d+(?:[.,]\d+)?\s*khz|lossless|web|cd|vinyl|rip|320|256|192)\b[^\])]*)[\])]/gi;

const YEAR_BRACKET = /\s*[[(]((?:19|20)\d\d)[\])]\s*/;

const YEAR_PART = /^(?:19|20)\d\d$/;

const isUsableName = (name: string): boolean => {
  const key = nameKey(name);
  return (
    key !== '' &&
    !GENERIC_NAMES.has(key) &&
    // A drive ("C:"), or a name of digits alone, says nothing.
    !/^[a-z]:$/i.test(key) &&
    !/^\d+$/.test(key) &&
    !LABEL_FOLDER.test(name)
  );
};

/**
 * The album, its artist, its year, a disc number and a genre, read from the
 * folders an album sits in, for an album whose songs carry none of them:
 *
 *   [Rock]\Avril Lavigne\Avril Lavigne - 2011 - Goodbye Lullaby
 *     album "Goodbye Lullaby", artist "Avril Lavigne", year 2011, genre Rock
 *   Marea Alta\Luna de Papel                album, artist from the folder above
 *   Pink Floyd\The Wall\CD2                 the album folder is above the disc
 *
 * The folder's own name splits on " - "; a part that is a year is the year,
 * and of the rest the first part is the artist only when there are two or
 * more. A bracketed year anywhere is the year, and brackets that describe
 * the files ("[FLAC]") are dropped. The artist otherwise comes from the
 * folder above, unless that name is a generic one ("Music") or a shelf label
 * in brackets, which is read as the genre instead.
 */
export const readFolderTags = (folder: string): IFolderTags => {
  const parts = folder.split(/[\\/]+/).filter((part) => part !== '');
  const read: IFolderTags = {};
  let albumIndex = parts.length - 1;
  const disc = DISC_FOLDER.exec(parts[albumIndex] ?? '');
  if (disc && albumIndex > 0) {
    read.discNo = { value: String(Number(disc[1])), source: 'folder' };
    albumIndex -= 1;
  }
  const own = parts[albumIndex];
  if (own === undefined || !isUsableName(own)) {
    return read;
  }
  const albumSource: TFolderSource =
    albumIndex === parts.length - 1 ? 'folder' : 'parentFolder';

  let name = stripJunk(own).replace(/_/g, ' ');
  const bracketYear = YEAR_BRACKET.exec(name);
  if (bracketYear) {
    read.year = { value: bracketYear[1], source: albumSource };
    name = name.replace(YEAR_BRACKET, ' ');
  }
  name = name.replace(FORMAT_BRACKET, '').replace(/\s+/g, ' ').trim();
  const pieces = name
    .split(/\s+[-–—]\s+/)
    .map((piece) => piece.trim())
    .filter((piece) => piece !== '');
  const words = pieces.filter((piece) => {
    if (YEAR_PART.test(piece)) {
      read.year ??= { value: piece, source: albumSource };
      return false;
    }
    return true;
  });
  if (words.length === 0) {
    return read;
  }

  const above = parts[albumIndex - 1];
  const aboveIsArtist = above !== undefined && isUsableName(above);
  // "Avril Lavigne - Goodbye Lullaby" names its artist first. Under an
  // artist's own folder a dash is only part of the album's name unless it
  // splits off that same artist: "Marea Alta\Grandes Éxitos - Vol. 2".
  const namesArtist =
    words.length >= 2 &&
    (!aboveIsArtist || nameKey(words[0]) === nameKey(above));
  if (namesArtist) {
    const [artist, ...album] = words;
    read.artist = { value: artist, source: albumSource };
    read.album = { value: album.join(' - '), source: albumSource };
  } else {
    read.album = { value: words.join(' - '), source: albumSource };
    if (aboveIsArtist) {
      read.artist = { value: above.trim(), source: 'parentFolder' };
    }
  }

  // A shelf label in brackets, just above the album or above its artist.
  const labels = [parts[albumIndex - 1], parts[albumIndex - 2]];
  const label = labels
    .map((part) => (part === undefined ? null : LABEL_FOLDER.exec(part)))
    .find((match) => match !== null && match !== undefined);
  if (label) {
    read.genre = { value: label[1].trim(), source: 'parentFolder' };
  }
  return read;
};

/** True for an artist name that stands for many: an album artist only. */
export const isVariousArtists = (name: string): boolean =>
  VARIOUS_NAMES.has(nameKey(name));

/** A picture in an album folder: its name and size in bytes. */
export interface IFolderPicture {
  name: string;
  size: number;
}

const splitName = (name: string): { stem: string; ext: string } => {
  const dot = name.lastIndexOf('.');
  return dot > 0
    ? {
        stem: name.slice(0, dot).toLocaleLowerCase(),
        ext: name.slice(dot + 1).toLocaleLowerCase(),
      }
    : { stem: name.toLocaleLowerCase(), ext: '' };
};

/** True for a file name the folder picture can be read from. */
export const isFolderPicture = (name: string): boolean =>
  FOLDER_ART_EXTENSIONS.includes(splitName(name).ext);

/**
 * The album picture among a folder's pictures, as the Library finds it
 * first ("cover.jpg", "folder.jpg"… — `findFolderArt`), so Fix offers the
 * picture the Library already draws. Past the Library's names: Windows
 * Media Player's large "AlbumArt_{…}_Large.jpg", a picture named after the
 * folder or the album ("Goodbye Lullaby.jpg"), then the largest picture —
 * a front scan is the usual one, and the offer is looked at before it is
 * written.
 */
export const pickFolderCover = (
  pictures: readonly IFolderPicture[],
  folderName: string,
): string | undefined => {
  const names = pictures.map((picture) => picture.name);
  const library = findFolderArt(names);
  if (library !== undefined) {
    return library;
  }
  const mediaPlayer = names.find((name) =>
    /^albumart_.+_large$/.test(splitName(name).stem),
  );
  if (mediaPlayer) {
    return mediaPlayer;
  }
  const folderKey = nameKey(folderName);
  const named = names.find((name) => {
    const key = nameKey(splitName(name).stem);
    return key !== '' && (folderKey === key || folderKey.endsWith(` - ${key}`));
  });
  if (named) {
    return named;
  }
  return [...pictures].sort((a, b) => b.size - a.size)[0]?.name;
};

/** The folder's CUE sheet: the first by name where a rip left several. */
export const pickCueFile = (names: readonly string[]): string | undefined =>
  [...names]
    .filter((name) => splitName(name).ext === 'cue')
    .sort((a, b) => a.localeCompare(b))[0];
