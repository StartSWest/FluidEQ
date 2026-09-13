import {
  MAX_MEMBER_NAME_LENGTH,
  memberLookId,
  parseMemberLookId,
  sanitizeDisplayText,
} from './memberScenes';
import { premiumLookId, type TLocalizedName } from './scenePacks';

/** Reserved catalogue identity, never a member account or leaderboard entry. */
export const FLUIDEQ_CREATOR_ID = '00000000-0000-4000-8000-000000000001';

/**
 * The Plus gallery: scenes members publish, as the server lists them and the
 * app shows them.
 *
 * Everything that arrives from the server is read through the parsers here
 * before anything is drawn from it. The server already refuses what does not
 * belong, but a name is still text somebody typed, so it is cleaned the way
 * every other name on screen is, and a row that does not parse is dropped
 * rather than shown half-read.
 */

/**
 * The categories a member files a scene under, in the order they are offered.
 * The server holds the same list (`gallery_categories()` in migration 0012 and
 * `publish-member-scene`); a new one is added to all three in one release.
 */
export const PLUS_CATEGORIES = [
  'nature',
  'cities',
  'space',
  'water',
  'fire-light',
  'retro-games',
  'animals',
  'abstract',
  'worlds-3d',
] as const;

export type TPlusCategory = (typeof PLUS_CATEGORIES)[number];

export const isPlusCategory = (value: unknown): value is TPlusCategory =>
  typeof value === 'string' &&
  (PLUS_CATEGORIES as readonly string[]).includes(value);

export type TGallerySort = 'liked' | 'week' | 'new';

export const isGallerySort = (value: unknown): value is TGallerySort =>
  value === 'liked' || value === 'week' || value === 'new';

/** Rows asked for at a time; the server answers at most a hundred. */
export const GALLERY_PAGE_SIZE = 60;

/** Longest search the gallery sends. Longer matches nothing anyway. */
export const MAX_GALLERY_QUERY = 60;

export interface IGalleryQuery {
  category?: TPlusCategory;
  /** One maker's page. */
  authorId?: string;
  query?: string;
  sort: TGallerySort;
  offset?: number;
}

export interface IGalleryScene {
  /** The signed FluidEQ collection, delivered through the official pack store. */
  official?: boolean;
  /** The id the look picker uses once it is added. */
  lookId: string;
  authorId: string;
  sceneId: string;
  /** Their profile's display name and handle, or null without a profile. */
  authorName: string | null;
  authorHandle: string | null;
  version: number;
  category: TPlusCategory;
  /**
   * A second category the scene is filed under, never the first again
   * (fluideq-premium 0018). The gallery finds it under either; a card names
   * the first.
   */
  category2?: TPlusCategory;
  names: TLocalizedName;
  swatch: string[];
  hasPhoto: boolean;
  likes: number;
  likesWeek: number;
  adds: number;
  /** When it was last published or updated, as the server wrote it. */
  updatedAt: string;
  liked: boolean;
  added: boolean;
}

export interface IPublishedScene {
  /** Server-authorized FluidEQ publication, separate from this account's member scenes. */
  official?: boolean;
  sceneId: string;
  version: number;
  category: TPlusCategory;
  category2?: TPlusCategory;
  names: TLocalizedName;
  swatch: string[];
  likes: number;
  adds: number;
  publishedAt: string;
  updatedAt: string;
  /** Taken down by the maker of FluidEQ: listed for its author, shown to nobody. */
  blocked: boolean;
}

export const REPORT_REASONS = [
  'rights',
  'flashing',
  'offensive',
  'broken',
] as const;

export type TReportReason = (typeof REPORT_REASONS)[number];

export const isReportReason = (value: unknown): value is TReportReason =>
  typeof value === 'string' &&
  (REPORT_REASONS as readonly string[]).includes(value);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const HEX_COLOUR = /^#[0-9a-f]{6}$/i;
const HANDLE = /^[a-z0-9_]{3,20}$/;
const LOCALE = /^[a-z]{2}$/;
const MAX_AUTHOR_NAME = 60;

/** PostgREST hands a `bigint` back as a string; both read as a count. */
export const readCount = (value: unknown): number | undefined => {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isInteger(number) && number >= 0
    ? number
    : undefined;
};

const readNames = (value: unknown): TLocalizedName | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const names: Record<string, string> = {};
  Object.entries(value).forEach(([locale, raw]) => {
    const name = sanitizeDisplayText(raw);
    if (LOCALE.test(locale) && name && name.length <= MAX_MEMBER_NAME_LENGTH) {
      names[locale] = name;
    }
  });
  return names.en ? (names as TLocalizedName) : undefined;
};

const readSwatch = (value: unknown): string[] | undefined =>
  Array.isArray(value) &&
  value.length >= 2 &&
  value.length <= 4 &&
  value.every((colour) => typeof colour === 'string' && HEX_COLOUR.test(colour))
    ? value.map((colour: string) => colour.toLowerCase())
    : undefined;

/**
 * The second category a row carries, or nothing: a server older than 0018
 * sends none, and one that is not a category or repeats the first is not a
 * second category, so the row keeps its first alone rather than being lost.
 */
const readSecondCategory = (
  value: unknown,
  first: TPlusCategory,
): { category2?: TPlusCategory } =>
  isPlusCategory(value) && value !== first ? { category2: value } : {};

export const readDate = (value: unknown): string | undefined =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value))
    ? value
    : undefined;

/** One row of `gallery_scenes`, or nothing when any part of it is not right. */
export const parseGalleryRow = (value: unknown): IGalleryScene | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const authorId =
    typeof value.author_id === 'string' ? value.author_id.toLowerCase() : '';
  const sceneId = typeof value.scene_id === 'string' ? value.scene_id : '';
  const lookId = memberLookId(authorId, sceneId);
  if (!parseMemberLookId(lookId)) {
    return undefined;
  }
  const official = value.official === true;
  if (official !== (authorId === FLUIDEQ_CREATOR_ID)) {
    return undefined;
  }
  const names = readNames(value.names);
  const swatch = readSwatch(value.swatch);
  const version = readCount(value.version);
  const likes = readCount(value.likes);
  const likesWeek = readCount(value.likes_week);
  const adds = readCount(value.adds);
  const updatedAt = readDate(value.updated_at);
  if (
    !names ||
    !swatch ||
    !version ||
    likes === undefined ||
    likesWeek === undefined ||
    adds === undefined ||
    !updatedAt ||
    !isPlusCategory(value.category)
  ) {
    return undefined;
  }
  const authorName = sanitizeDisplayText(value.author_name);
  const authorHandle =
    typeof value.author_handle === 'string' && HANDLE.test(value.author_handle)
      ? value.author_handle
      : null;
  return {
    lookId: official ? premiumLookId(sceneId) : lookId,
    ...(official ? { official: true } : {}),
    authorId,
    sceneId,
    authorName: official
      ? 'FluidEQ'
      : authorName?.slice(0, MAX_AUTHOR_NAME) || null,
    authorHandle: official ? 'fluideq' : authorHandle,
    version,
    category: value.category,
    ...readSecondCategory(value.category2, value.category),
    names,
    swatch,
    hasPhoto: value.has_photo === true,
    likes,
    likesWeek,
    adds,
    updatedAt,
    liked: value.liked === true,
    added: value.added === true,
  };
};

/** One row of `my_published_scenes`. */
export const parsePublishedRow = (
  value: unknown,
): IPublishedScene | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const sceneId = typeof value.scene_id === 'string' ? value.scene_id : '';
  const names = readNames(value.names);
  const swatch = readSwatch(value.swatch);
  const version = readCount(value.version);
  const likes = readCount(value.likes);
  const adds = readCount(value.adds);
  const publishedAt = readDate(value.published_at);
  const updatedAt = readDate(value.updated_at);
  if (
    !/^[a-z][a-z0-9-]{1,47}$/.test(sceneId) ||
    !names ||
    !swatch ||
    !version ||
    likes === undefined ||
    adds === undefined ||
    !publishedAt ||
    !updatedAt ||
    !isPlusCategory(value.category)
  ) {
    return undefined;
  }
  return {
    sceneId,
    version,
    category: value.category,
    ...readSecondCategory(value.category2, value.category),
    names,
    swatch,
    likes,
    adds,
    publishedAt,
    updatedAt,
    blocked: value.blocked === true,
    ...(value.official === true ? { official: true } : {}),
  };
};

/** A search as the server is sent it: trimmed, bounded, or nothing at all. */
export const cleanGalleryQuery = (value: unknown): string | undefined => {
  const text = sanitizeDisplayText(value);
  return text ? text.slice(0, MAX_GALLERY_QUERY) : undefined;
};
