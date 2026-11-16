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

/**
 * "Fix this album": the changes proposed for a set of songs, as a list of
 * before → after lines, each saying where it came from.
 *
 * Everything here works from the songs' own tags, file names and folders — nothing
 * goes online. A line is proposed only where a rule is sure: a title that is
 * its file name, one written all in one case, junk a download left; a value
 * most of the album already agrees on; a total the album's own count gives.
 * Every line can be unticked or changed by hand before anything is written.
 */

import type { TTagFieldKey, TTagFields } from './tagFields';
import { cueTrackFor, type ICueSheet } from './cueSheet';
import {
  isVariousArtists,
  readFolderTags,
  type TFolderSource,
} from './tagFolder';
import {
  baseNameOf,
  countValues,
  isOneCase,
  sentenceCase,
  stripJunk,
  titleCase,
  titleFromFileName,
} from './tagText';

export type TFixKind = 'online' | 'clean' | 'unify' | 'fill' | 'cover';

export type TFixSource =
  | 'fileName'
  | 'capitals'
  | 'junk'
  | 'majority'
  | 'count'
  | 'spelling'
  | 'hand'
  | 'artistInTitle'
  | 'cue'
  | TFolderSource;

/** One proposed change: the same before and after for every song it names. */
export interface IFixLine {
  id: string;
  kind: TFixKind;
  field: TTagFieldKey;
  trackIds: string[];
  before: string;
  after: string;
  source: TFixSource;
}

/** What the rules read of each song. */
export interface IFixSong {
  trackId: string;
  fileName: string;
  /** The folder the file sits in: an untagged album's name and artist. */
  folder?: string;
  fields: TTagFields;
}

export type TCapitals = 'released' | 'title' | 'sentence';

export interface IFixRules {
  /** "%track% - %title%": how a file name says what the song is. */
  pattern: string;
  /** Text taken out of titles wherever it appears, as typed. */
  strip: string[];
  capitals: TCapitals;
  /** Spellings to use every time: "Jesse y Joy" → "Jesse & Joy". */
  spellings: Array<{ from: string; to: string }>;
}

export const DEFAULT_FIX_RULES: IFixRules = {
  pattern: '%track% - %title%',
  strip: [],
  capitals: 'released',
  spellings: [],
};

const PATTERN_TOKENS = ['track', 'title', 'artist', 'album', 'year'] as const;

type TPatternToken = (typeof PATTERN_TOKENS)[number];

const escapeRegExp = (text: string): string =>
  text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * What a file name says under `pattern`, or `undefined` where it does not
 * fit. Separators between tokens are matched as typed, with any run of
 * spaces around them.
 */
export const readFileNamePattern = (
  fileName: string,
  pattern: string,
): Partial<Record<TPatternToken, string>> | undefined => {
  if (!pattern.includes('%title%')) {
    return undefined;
  }
  const names: TPatternToken[] = [];
  const source = pattern
    .split(/(%[a-z]+%)/)
    .map((part) => {
      const token = /^%([a-z]+)%$/.exec(part)?.[1];
      if (
        token !== undefined &&
        (PATTERN_TOKENS as readonly string[]).includes(token)
      ) {
        names.push(token as TPatternToken);
        return token === 'track' || token === 'year' ? '(\\d{1,4})' : '(.+?)';
      }
      // The split leaves an empty piece before a leading token and after a
      // trailing one: those stand for nothing. Asking whitespace of them made
      // the pattern match no file name at all.
      if (part === '') {
        return '';
      }
      return part.trim() === ''
        ? '\\s+'
        : `\\s*${escapeRegExp(part.trim())}\\s*`;
    })
    .join('');
  const match = new RegExp(`^\\s*${source}\\s*$`).exec(baseNameOf(fileName));
  if (match === null) {
    return undefined;
  }
  const read: Partial<Record<TPatternToken, string>> = {};
  names.forEach((name, index) => {
    read[name] = match[index + 1].trim();
  });
  return read;
};

/** "Jesse y Joy", "Jesse & Joy" and "jesse and joy" are one spelling apart. */
export const spellingKey = (value: string): string =>
  value
    .toLocaleLowerCase()
    .replace(/\s+(y|and|e|et|und)\s+/g, ' & ')
    .replace(/[^\p{L}\p{N}&]+/gu, ' ')
    .trim();

const applyCapitals = (text: string, capitals: TCapitals): string => {
  if (capitals === 'title') {
    return titleCase(text.toLocaleLowerCase());
  }
  if (capitals === 'sentence') {
    return sentenceCase(text);
  }
  return isOneCase(text) ? titleCase(text) : text;
};

const stripTyped = (text: string, strip: readonly string[]): string =>
  strip
    .filter((piece) => piece.trim() !== '')
    .reduce((acc, piece) => acc.split(piece).join(''), text)
    .replace(/\s+/g, ' ')
    .trim();

/**
 * What rippers and players write where they know nothing: "<Desconocido>",
 * "Unknown Artist", "[Unknown]". Read as empty, so the album's folders and
 * majorities can fill the field, and cleared where nothing does (Ivan's
 * Avril Lavigne folder, 2026-11-16, said "<Desconocido>" on every song).
 */
const PLACEHOLDER_NAMES = new Set([
  'unknown',
  'unknown artist',
  'unknown album',
  'unknown genre',
  'desconocido',
  'desconocida',
  'artista desconocido',
  'album desconocido',
  'genero desconocido',
  'inconnu',
  'artiste inconnu',
  'album inconnu',
  'unbekannt',
  'unbekannter kunstler',
  'unbekanntes album',
  'sconosciuto',
  'artista sconosciuto',
  'album sconosciuto',
  'desconhecido',
  'artista desconhecido',
  'album desconhecido',
  'no artist',
  'no album',
]);

/** The fields a placeholder stands in for; a title is the song's own. */
const PLACEHOLDER_FIELDS: readonly TTagFieldKey[] = [
  'artist',
  'albumArtist',
  'album',
  'genre',
  'composer',
];

export const isPlaceholderName = (value: string): boolean =>
  PLACEHOLDER_NAMES.has(
    value
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/^[\s<[(]+|[\s>\])]+$/g, '')
      .toLocaleLowerCase(),
  );

/** "Avril Lavigne - Black Star": the artist, then the title. */
const ARTIST_TITLE = /^(.+?)\s+[-–—]\s+(.+)$/;

/** A value for an album field and where it was read. */
interface IFixValue {
  value: string;
  source: TFixSource;
}

/** Fields that belong to the album, where most songs agreeing is evidence. */
const ALBUM_FIELDS: readonly TTagFieldKey[] = [
  'album',
  'albumArtist',
  'year',
  'genre',
  'publisher',
];

/** The value more than half the songs hold, ignoring empty ones. */
const majorityOf = (values: readonly string[]): string | undefined => {
  const filled = values.filter((value) => value !== '');
  const [top] = countValues(filled);
  return top !== undefined && top.count * 2 > values.length
    ? top.value
    : undefined;
};

interface ILineDraft {
  kind: TFixKind;
  field: TTagFieldKey;
  trackId: string;
  before: string;
  after: string;
  source: TFixSource;
}

/**
 * One line per change, songs merged where the change is the same: "Artist
 * Jesse y Joy → Jesse & Joy" names songs 9 and 12 once.
 */
const mergeLines = (drafts: readonly ILineDraft[]): IFixLine[] => {
  const lines = new Map<string, IFixLine>();
  drafts.forEach((draft) => {
    const perSong = draft.field === 'title' || draft.field === 'trackNo';
    const key = perSong
      ? `${draft.kind}|${draft.field}|${draft.trackId}`
      : `${draft.kind}|${draft.field}|${draft.before}|${draft.after}|${draft.source}`;
    const line = lines.get(key);
    if (line && perSong) {
      // Two rules on one title (junk out, then capitals) are one change:
      // from what the file says to what the last rule made of it.
      line.after = draft.after;
    } else if (line) {
      line.trackIds.push(draft.trackId);
    } else {
      lines.set(key, {
        id: key,
        kind: draft.kind,
        field: draft.field,
        trackIds: [draft.trackId],
        before: draft.before,
        after: draft.after,
        source: draft.source,
      });
    }
  });
  return [...lines.values()];
};

/**
 * Every change the rules propose for `songs`, one album at a time (a folder
 * is split by album before it gets here). Each song's fields are read as the
 * earlier rules left them, so a title cleaned from its file name is then the
 * one the capitals see.
 */
export const proposeFixes = (
  songs: readonly IFixSong[],
  rules: IFixRules,
  /** The album folder's CUE sheet, when every song is in that folder. */
  cue?: ICueSheet,
): IFixLine[] => {
  const drafts: ILineDraft[] = [];
  // Placeholders read as empty from the start; each line's "before" is
  // given back its placeholder at the end.
  const current = new Map(
    songs.map((song) => {
      const fields = { ...song.fields };
      PLACEHOLDER_FIELDS.forEach((field) => {
        if (isPlaceholderName(fields[field] ?? '')) {
          fields[field] = '';
        }
      });
      return [song.trackId, fields];
    }),
  );
  const add = (draft: ILineDraft) => {
    drafts.push(draft);
    const fields = current.get(draft.trackId);
    if (fields) {
      fields[draft.field] = draft.after;
    }
  };

  // Titles: from the CUE sheet, else out of the file name, junk out,
  // capitals. A sheet's titles are the ripper's own words and are taken as
  // written.
  songs.forEach((song) => {
    const fields = current.get(song.trackId) ?? {};
    const title = fields.title ?? '';
    const base = baseNameOf(song.fileName);
    const isFileName =
      title === '' ||
      title.toLocaleLowerCase() === base.toLocaleLowerCase() ||
      /^\d{1,3}\s*[-.]\s+/.test(title);
    const trackNo = Number.parseInt(fields.trackNo ?? '', 10);
    const fromCue = cue
      ? cueTrackFor(
          cue,
          song.fileName,
          Number.isFinite(trackNo)
            ? trackNo
            : Number.parseInt(
                titleFromFileName(song.fileName)?.trackNo ?? '',
                10,
              ),
        )
      : undefined;
    if (fromCue?.performer && (fields.artist ?? '') === '') {
      add({
        kind: 'fill',
        field: 'artist',
        trackId: song.trackId,
        before: '',
        after: fromCue.performer,
        source: 'cue',
      });
    }
    if (isFileName && fromCue?.title) {
      if (fromCue.title !== title) {
        add({
          kind: 'clean',
          field: 'title',
          trackId: song.trackId,
          before: title,
          after: fromCue.title,
          source: 'cue',
        });
      }
      if ((fields.trackNo ?? '') === '') {
        add({
          kind: 'fill',
          field: 'trackNo',
          trackId: song.trackId,
          before: '',
          after: String(fromCue.number),
          source: 'cue',
        });
      }
      return;
    }
    if (isFileName) {
      const byPattern = readFileNamePattern(song.fileName, rules.pattern);
      const read = byPattern?.title
        ? { title: stripJunk(byPattern.title), trackNo: byPattern.track }
        : titleFromFileName(song.fileName);
      const next = read?.title ? applyCapitals(read.title, rules.capitals) : '';
      if (next !== '' && next !== title) {
        add({
          kind: 'clean',
          field: 'title',
          trackId: song.trackId,
          before: title,
          after: next,
          source: 'fileName',
        });
      }
      const trackNo = read?.trackNo ? String(Number(read.trackNo)) : undefined;
      if (trackNo !== undefined && (fields.trackNo ?? '') === '') {
        add({
          kind: 'fill',
          field: 'trackNo',
          trackId: song.trackId,
          before: '',
          after: trackNo,
          source: 'fileName',
        });
      }
      return;
    }
    const unjunked = stripTyped(stripJunk(title), rules.strip);
    if (unjunked !== title && unjunked !== '') {
      add({
        kind: 'clean',
        field: 'title',
        trackId: song.trackId,
        before: title,
        after: unjunked,
        source: 'junk',
      });
    }
    const cased = applyCapitals(
      current.get(song.trackId)?.title ?? title,
      rules.capitals,
    );
    const now = current.get(song.trackId)?.title ?? title;
    if (cased !== now) {
      add({
        kind: 'clean',
        field: 'title',
        trackId: song.trackId,
        before: title,
        after: cased,
        source: 'capitals',
      });
    }
    const comment = fields.comment ?? '';
    if (comment !== '' && stripJunk(comment) === '') {
      add({
        kind: 'clean',
        field: 'comment',
        trackId: song.trackId,
        before: comment,
        after: '',
        source: 'junk',
      });
    }
  });

  // Spellings the user keeps, then spellings the album itself disagrees on.
  (['artist', 'albumArtist', 'composer'] as const).forEach((field) => {
    songs.forEach((song) => {
      const value = current.get(song.trackId)?.[field] ?? '';
      const rule = rules.spellings.find((spelling) => spelling.from === value);
      if (rule && rule.to !== value) {
        add({
          kind: 'unify',
          field,
          trackId: song.trackId,
          before: value,
          after: rule.to,
          source: 'spelling',
        });
      }
    });
    const values = songs.map(
      (song) => current.get(song.trackId)?.[field] ?? '',
    );
    const byKey = new Map<string, string[]>();
    values.forEach((value) => {
      if (value !== '') {
        const key = spellingKey(value);
        byKey.set(key, [...(byKey.get(key) ?? []), value]);
      }
    });
    byKey.forEach((spellings) => {
      const [top, second] = countValues(spellings);
      if (
        top === undefined ||
        second === undefined ||
        top.count === second.count
      ) {
        return;
      }
      songs.forEach((song) => {
        const value = current.get(song.trackId)?.[field] ?? '';
        if (
          value !== '' &&
          value !== top.value &&
          spellingKey(value) === spellingKey(top.value)
        ) {
          add({
            kind: 'unify',
            field,
            trackId: song.trackId,
            before: value,
            after: top.value,
            source: 'majority',
          });
        }
      });
    });
  });

  // An album none of whose songs name it, read from its folders (Ivan,
  // 2026-11-16: "poner las etiquetas de acuerdo al nombre de la carpeta").
  // Only where every song shares one folder and the field is empty on all of
  // them: a field some songs fill is the majority's to settle, below.
  // A CUE sheet beside the songs says the same in words and comes first.
  const folders = new Set(songs.map((song) => song.folder ?? ''));
  const [folder] = [...folders];
  const isOneFolder =
    folders.size === 1 && folder !== undefined && folder !== '';
  if (isOneFolder || cue) {
    const read = isOneFolder ? readFolderTags(folder) : {};
    const fromCue = (value: string | undefined): IFixValue | undefined =>
      value ? { value, source: 'cue' } : undefined;
    const cueYear = /\b(?:19|20)\d\d\b/.exec(cue?.date ?? '')?.[0];
    const fillAll = (field: TTagFieldKey, value: IFixValue | undefined) => {
      if (
        value === undefined ||
        songs.some((song) => (current.get(song.trackId)?.[field] ?? '') !== '')
      ) {
        return;
      }
      songs.forEach((song) =>
        add({
          kind: 'fill',
          field,
          trackId: song.trackId,
          before: '',
          after: value.value,
          source: value.source,
        }),
      );
    };
    const artist = fromCue(cue?.performer) ?? read.artist;
    fillAll('album', fromCue(cue?.title) ?? read.album);
    if (artist && !isVariousArtists(artist.value)) {
      fillAll('artist', artist);
    }
    fillAll('albumArtist', artist);
    fillAll('year', fromCue(cueYear) ?? read.year);
    fillAll('genre', fromCue(cue?.genre) ?? read.genre);
    fillAll('composer', fromCue(cue?.songwriter));
    fillAll('discNo', read.discNo);
  }

  // Titles that start with their artist: "Avril Lavigne - Black Star". When
  // every title starts with the same name and no song names an artist, that
  // name is the artist; wherever a title starts with its song's artist, the
  // artist comes off it.
  const splits = songs.map((song) =>
    ARTIST_TITLE.exec(current.get(song.trackId)?.title ?? ''),
  );
  const prefixes = new Set(
    splits.map((split) => (split ? spellingKey(split[1]) : '')),
  );
  const [prefix] = [...prefixes];
  const firstSplit = splits[0];
  if (
    songs.length > 1 &&
    prefixes.size === 1 &&
    prefix !== '' &&
    firstSplit &&
    songs.every((song) => (current.get(song.trackId)?.artist ?? '') === '')
  ) {
    songs.forEach((song) =>
      add({
        kind: 'fill',
        field: 'artist',
        trackId: song.trackId,
        before: '',
        after: firstSplit[1],
        source: 'artistInTitle',
      }),
    );
  }
  songs.forEach((song, index) => {
    const split = splits[index];
    const fields = current.get(song.trackId);
    const artist = fields?.artist || fields?.albumArtist || '';
    if (
      split &&
      artist !== '' &&
      spellingKey(split[1]) === spellingKey(artist)
    ) {
      add({
        kind: 'clean',
        field: 'title',
        trackId: song.trackId,
        before: song.fields.title ?? '',
        after: split[2],
        source: 'artistInTitle',
      });
    }
  });

  // Album fields most of the album agrees on: differing values unified,
  // missing ones filled.
  if (songs.length > 1) {
    ALBUM_FIELDS.forEach((field) => {
      const values = songs.map(
        (song) => current.get(song.trackId)?.[field] ?? '',
      );
      let majority = majorityOf(values);
      if (
        majority === undefined &&
        field === 'albumArtist' &&
        values.every((value) => value === '')
      ) {
        majority = majorityOf(
          songs.map((song) => current.get(song.trackId)?.artist ?? ''),
        );
      }
      if (majority === undefined) {
        return;
      }
      songs.forEach((song, index) => {
        const value = values[index];
        if (value !== majority) {
          add({
            kind: value === '' ? 'fill' : 'unify',
            field,
            trackId: song.trackId,
            before: value,
            after: majority as string,
            source: 'majority',
          });
        }
      });
    });

    // A song with no artist, on an album whose every other song names the
    // same one. Unanimity, not a majority: a compilation's artists differ
    // song by song, and the most common of them is nobody's in particular.
    const artists = songs.map(
      (song) => current.get(song.trackId)?.artist ?? '',
    );
    const named = new Set(artists.filter((value) => value !== ''));
    if (named.size === 1 && artists.includes('')) {
      const [artist] = [...named];
      songs.forEach((song, index) => {
        if (artists[index] === '') {
          add({
            kind: 'fill',
            field: 'artist',
            trackId: song.trackId,
            before: '',
            after: artist,
            source: 'majority',
          });
        }
      });
    }

    // Track numbers still missing after the file names and the CUE sheet
    // (Ivan, 2026-11-16: "la corrección incluye los números de track
    // faltantes ... se debería autocompletar"): the numbers from 1 to the
    // album's count that no song holds go to the songs that hold none, in
    // the order of their file names — exactly as many of each, or nothing,
    // since a number to spare or a song too many means the album is not
    // simply 1 to N. Shown before anything is written, and Renumber after
    // a drag puts a wrong order right.
    const held = new Set(
      songs.map((song) => Number(current.get(song.trackId)?.trackNo ?? '')),
    );
    const unnumbered = songs
      .filter((song) => (current.get(song.trackId)?.trackNo ?? '') === '')
      .sort((a, b) =>
        baseNameOf(a.fileName).localeCompare(
          baseNameOf(b.fileName),
          undefined,
          {
            numeric: true,
            sensitivity: 'base',
          },
        ),
      );
    const free = Array.from({ length: songs.length }, (_, i) => i + 1).filter(
      (n) => !held.has(n),
    );
    if (unnumbered.length > 0 && unnumbered.length === free.length) {
      unnumbered.forEach((song, index) =>
        add({
          kind: 'fill',
          field: 'trackNo',
          trackId: song.trackId,
          before: '',
          after: String(free[index]),
          source: 'count',
        }),
      );
    }

    // The track total, where every song is numbered within the album's count.
    const numbers = songs.map((song) =>
      Number(current.get(song.trackId)?.trackNo ?? ''),
    );
    const allNumbered = numbers.every(
      (n) => Number.isInteger(n) && n >= 1 && n <= songs.length,
    );
    const distinct = new Set(numbers).size === numbers.length;
    if (allNumbered && distinct) {
      const total = String(songs.length);
      songs.forEach((song) => {
        const value = current.get(song.trackId)?.trackTotal ?? '';
        if (value !== total) {
          add({
            kind: 'fill',
            field: 'trackTotal',
            trackId: song.trackId,
            before: value,
            after: total,
            source: 'count',
          });
        }
      });
    }
  }

  songs.forEach((song) =>
    PLACEHOLDER_FIELDS.forEach((field) => {
      const was = song.fields[field] ?? '';
      if (!isPlaceholderName(was)) {
        return;
      }
      const touched = drafts.filter(
        (draft) => draft.trackId === song.trackId && draft.field === field,
      );
      touched.forEach((draft) => {
        if (draft.before === '') {
          // eslint-disable-next-line no-param-reassign -- this function's own drafts, given back what the file says
          draft.before = was;
        }
      });
      if (touched.length === 0) {
        drafts.push({
          kind: 'clean',
          field,
          trackId: song.trackId,
          before: was,
          after: '',
          source: 'junk',
        });
      }
    }),
  );

  return mergeLines(drafts);
};

/** Per song, the fields the ticked lines set — what the write sends. */
export const fieldsOfLines = (
  lines: readonly IFixLine[],
): Map<string, TTagFields> => {
  const fields = new Map<string, TTagFields>();
  lines.forEach((line) => {
    line.trackIds.forEach((trackId) => {
      fields.set(trackId, {
        ...(fields.get(trackId) ?? {}),
        [line.field]: line.after,
      });
    });
  });
  return fields;
};
