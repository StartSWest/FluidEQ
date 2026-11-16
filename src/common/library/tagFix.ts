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
 * Everything here works from the songs' own tags and file names — nothing
 * goes online. A line is proposed only where a rule is sure: a title that is
 * its file name, one written all in one case, junk a download left; a value
 * most of the album already agrees on; a total the album's own count gives.
 * Every line can be unticked or changed by hand before anything is written.
 */

import type { TTagFieldKey, TTagFields } from './tagFields';
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
  'fileName' | 'capitals' | 'junk' | 'majority' | 'count' | 'spelling' | 'hand';

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
): IFixLine[] => {
  const drafts: ILineDraft[] = [];
  const current = new Map(
    songs.map((song) => [song.trackId, { ...song.fields }]),
  );
  const add = (draft: ILineDraft) => {
    drafts.push(draft);
    const fields = current.get(draft.trackId);
    if (fields) {
      fields[draft.field] = draft.after;
    }
  };

  // Titles: out of the file name, junk out, capitals.
  songs.forEach((song) => {
    const fields = current.get(song.trackId) ?? {};
    const title = fields.title ?? '';
    const base = baseNameOf(song.fileName);
    const isFileName =
      title === '' ||
      title.toLocaleLowerCase() === base.toLocaleLowerCase() ||
      /^\d{1,3}\s*[-.]\s+/.test(title);
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
