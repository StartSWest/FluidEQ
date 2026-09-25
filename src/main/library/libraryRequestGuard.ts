/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A question from the window, proved to be one before the store is asked it.
 *
 * Nothing in a query reaches the SQL as text — every value is bound — so this
 * is not what keeps the store safe. It is what keeps a malformed question a
 * refusal rather than a wrong answer: an unknown shelf read as songs, a page
 * of a million rows, a list of ids a megabyte long.
 */

import type {
  ILibraryListQuery,
  ILibraryScope,
  TLibraryListShelf,
  TLibraryNaturalOrder,
  TLibraryRequest,
} from '../../common/library/query';
import type { TLibrarySort } from '../../common/library/types';

/** A page is what one screen draws, with room to scroll. */
const MAX_PAGE_ROWS = 500;

/**
 * Ids asked for in one question: a playlist's scope, a queue's lookup, a
 * run of ids for "play all". A queue of the whole library is the listener's
 * own choice, so this is the size of a large library, not of a screen.
 */
const MAX_IDS = 100_000;

/** Typed text: a search, a mark. Longer is not somebody typing. */
const MAX_TEXT = 500;

/** A folder path, as Windows' own long-path limit allows. */
const MAX_PATH = 32_767;

const SHELVES: readonly TLibraryListShelf[] = [
  'albums',
  'artists',
  'genres',
  'folders',
  'children',
  'roots',
  'tracks',
];

const SORTS: readonly TLibrarySort[] = [
  'title',
  'artist',
  'album',
  'year',
  'added',
  'track',
];

const NATURAL_ORDERS: readonly TLibraryNaturalOrder[] = [
  'library',
  'album',
  'disc',
  'path',
  'ids',
];

type TRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is TRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isText = (value: unknown, limit: number): value is string =>
  typeof value === 'string' && value.length <= limit;

const isOptionalText = (value: unknown, limit: number): boolean =>
  value === undefined || isText(value, limit);

const isCount = (value: unknown, limit: number): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= limit;

const isIdList = (value: unknown): value is string[] =>
  Array.isArray(value) &&
  value.length <= MAX_IDS &&
  value.every((entry) => isText(entry, MAX_TEXT));

const isOneOf = <T extends string>(
  value: unknown,
  options: readonly T[],
): value is T =>
  typeof value === 'string' && options.some((option) => option === value);

const isScope = (value: unknown): value is ILibraryScope =>
  isRecord(value) &&
  isOptionalText(value.beneath, MAX_PATH) &&
  isOptionalText(value.folder, MAX_PATH) &&
  isOptionalText(value.album, MAX_TEXT) &&
  isOptionalText(value.artist, MAX_TEXT) &&
  isOptionalText(value.genre, MAX_TEXT) &&
  (value.withFolderMates === undefined ||
    typeof value.withFolderMates === 'boolean') &&
  (value.ids === undefined || isIdList(value.ids)) &&
  (value.kind === undefined ||
    value.kind === 'audio' ||
    value.kind === 'video');

const isListQuery = (value: unknown): value is ILibraryListQuery =>
  isRecord(value) &&
  isOneOf(value.shelf, SHELVES) &&
  isScope(value.scope) &&
  isOptionalText(value.search, MAX_TEXT) &&
  isOptionalText(value.near, MAX_PATH) &&
  (value.sort === undefined || isOneOf(value.sort, SORTS)) &&
  (value.direction === 'asc' || value.direction === 'desc') &&
  (value.folderHeadings === undefined ||
    typeof value.folderHeadings === 'boolean') &&
  isOptionalText(value.mark, MAX_TEXT) &&
  (value.natural === undefined || isOneOf(value.natural, NATURAL_ORDERS)) &&
  (value.unranked === undefined || typeof value.unranked === 'boolean') &&
  isOptionalText(value.parent, MAX_PATH);

/** The request, if it is one this store answers; otherwise nothing. */
const parseLibraryRequest = (value: unknown): TLibraryRequest | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  switch (value.type) {
    case 'page':
      return isListQuery(value.query) &&
        isCount(value.offset, Number.MAX_SAFE_INTEGER) &&
        isCount(value.limit, MAX_PAGE_ROWS)
        ? {
            type: 'page',
            query: value.query,
            offset: value.offset,
            limit: value.limit,
          }
        : undefined;
    case 'position':
      return isListQuery(value.query) && isText(value.id, MAX_PATH)
        ? { type: 'position', query: value.query, id: value.id }
        : undefined;
    case 'letters':
      return isListQuery(value.query)
        ? { type: 'letters', query: value.query }
        : undefined;
    case 'ids':
      return isListQuery(value.query) &&
        isCount(value.offset, Number.MAX_SAFE_INTEGER) &&
        isCount(value.limit, MAX_IDS)
        ? {
            type: 'ids',
            query: value.query,
            offset: value.offset,
            limit: value.limit,
          }
        : undefined;
    case 'tracks':
      return isIdList(value.ids)
        ? { type: 'tracks', ids: value.ids }
        : undefined;
    case 'continuation':
      return isText(value.seedId, MAX_TEXT) &&
        isIdList(value.exclude) &&
        isCount(value.count, MAX_PAGE_ROWS)
        ? {
            type: 'continuation',
            seedId: value.seedId,
            exclude: value.exclude,
            count: value.count,
          }
        : undefined;
    case 'duration':
      return isIdList(value.ids)
        ? { type: 'duration', ids: value.ids }
        : undefined;
    case 'headings':
      return isListQuery(value.query)
        ? { type: 'headings', query: value.query }
        : undefined;
    case 'rest':
      return isListQuery(value.query) &&
        isText(value.afterId, MAX_PATH) &&
        isIdList(value.exclude)
        ? {
            type: 'rest',
            query: value.query,
            afterId: value.afterId,
            exclude: value.exclude,
          }
        : undefined;
    default:
      return undefined;
  }
};

export default parseLibraryRequest;
