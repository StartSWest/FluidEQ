/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memberLookId, parseMemberLookId } from './memberScenes';
import { FLUIDEQ_CREATOR_ID, readCount, readNames } from './plusGallery';
import { isPremiumLookId, packIdOfLook, premiumLookId } from './scenePacks';
import type { TLocalizedName } from './scenePackFields';

/**
 * Which scenes members play, add and like, for the admin (premium migration
 * 0047): one account's scenes, and every scene by how many people come back
 * to it. Asked for so new sets follow what members actually watch.
 *
 * A scene is named the way the server files it: FluidEQ's own by its pack id
 * with no author, a member's by author and scene id. The server decides who
 * may read any of this; these are only the shapes on their way to the page.
 */

/** The terms revision that names what the app sends about scenes and engines. */
export const SCENE_TASTE_TERMS = 10;

/** The periods the favourites page offers, in days; the last is "all time". */
export const FAVOURITE_PERIODS = [7, 30, 90, 3650] as const;
export type TFavouritePeriod = (typeof FAVOURITE_PERIODS)[number];

export const isFavouritePeriod = (value: unknown): value is TFavouritePeriod =>
  (FAVOURITE_PERIODS as readonly unknown[]).includes(value);

/** A scene as the server files a play: no author for one of FluidEQ's own. */
export interface ISceneRef {
  authorId?: string;
  sceneId: string;
}

/**
 * The scene a look plays, or nothing for a look that is not a scene (the
 * built-in styles, a custom look). A member's scene under the gallery's
 * reserved creator is FluidEQ's own.
 */
export const sceneRefOfLook = (lookId: string): ISceneRef | undefined => {
  if (isPremiumLookId(lookId)) {
    const sceneId = packIdOfLook(lookId);
    return /^[a-z][a-z0-9-]{1,47}$/.test(sceneId) ? { sceneId } : undefined;
  }
  const member = parseMemberLookId(lookId);
  if (!member) {
    return undefined;
  }
  return member.authorId === FLUIDEQ_CREATOR_ID
    ? { sceneId: member.packId }
    : { authorId: member.authorId, sceneId: member.packId };
};

/** What both admin readings say about a scene's identity and looks. */
export interface ISceneLabel extends ISceneRef {
  /** The version its picture is asked for by; absent for one never published. */
  version?: number;
  names?: TLocalizedName;
  category?: string;
  /** A member scene's maker, by display name or handle. */
  authorName?: string;
}

/** One scene in one account's list. */
export interface IAccountScene extends ISceneLabel {
  addedAt?: number;
  likedAt?: number;
  /** Seconds it was drawn on that account's screens, all days together. */
  seconds: number;
  days: number;
  /** The last day it played, as the member's computer counted the day. */
  lastPlayed?: string;
}

/** One scene in the favourites. */
export interface IFavouriteScene extends ISceneLabel {
  category2?: string;
  players: number;
  seconds: number;
  adds: number;
  likes: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ACCOUNT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SCENE_ID = /^[a-z][a-z0-9-]{1,47}$/;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

const textOf = (value: unknown, longest: number) =>
  typeof value === 'string' && value.length > 0
    ? value.slice(0, longest)
    : undefined;

/** A time, undefined for an empty column; NaN marks one that does not read. */
const timeOf = (value: unknown) => {
  if (value === null || value === undefined) {
    return undefined;
  }
  return typeof value === 'string' ? Date.parse(value) : Number.NaN;
};

const labelOf = (row: Record<string, unknown>): ISceneLabel | undefined => {
  const { author_id: author, scene_id: scene } = row;
  if (typeof scene !== 'string' || !SCENE_ID.test(scene)) {
    return undefined;
  }
  if (
    author !== null &&
    (typeof author !== 'string' || !ACCOUNT_ID.test(author))
  ) {
    return undefined;
  }
  const version = readCount(row.version);
  const names = readNames(row.names);
  const category = textOf(row.category, 32);
  const authorName = textOf(row.author_name, 60);
  return {
    ...(typeof author === 'string' ? { authorId: author } : {}),
    sceneId: scene,
    ...(version ? { version } : {}),
    ...(names ? { names } : {}),
    ...(category ? { category } : {}),
    ...(authorName ? { authorName } : {}),
  };
};

/**
 * `admin_account_scenes`, or undefined when any row does not read: a list
 * quietly shorter than the server's would say a member never touched a
 * scene they did.
 */
export const parseAccountScenes = (
  rows: unknown,
): IAccountScene[] | undefined => {
  if (!Array.isArray(rows)) {
    return undefined;
  }
  const scenes: IAccountScene[] = [];
  const allRead = rows.every((row: unknown) => {
    if (!isRecord(row)) {
      return false;
    }
    const label = labelOf(row);
    const seconds = readCount(row.seconds);
    const days = readCount(row.days);
    const addedAt = timeOf(row.added_at);
    const likedAt = timeOf(row.liked_at);
    const lastPlayed =
      typeof row.last_played === 'string' && DAY.test(row.last_played)
        ? row.last_played
        : undefined;
    if (
      !label ||
      seconds === undefined ||
      days === undefined ||
      Number.isNaN(addedAt) ||
      Number.isNaN(likedAt) ||
      (row.last_played !== null && lastPlayed === undefined)
    ) {
      return false;
    }
    scenes.push({
      ...label,
      seconds,
      days,
      ...(addedAt === undefined ? {} : { addedAt }),
      ...(likedAt === undefined ? {} : { likedAt }),
      ...(lastPlayed ? { lastPlayed } : {}),
    });
    return true;
  });
  return allRead ? scenes : undefined;
};

/** `admin_scene_favourites`, or undefined when any row does not read. */
export const parseFavouriteScenes = (
  rows: unknown,
): IFavouriteScene[] | undefined => {
  if (!Array.isArray(rows)) {
    return undefined;
  }
  const scenes: IFavouriteScene[] = [];
  const allRead = rows.every((row: unknown) => {
    if (!isRecord(row)) {
      return false;
    }
    const label = labelOf(row);
    const players = readCount(row.players);
    const seconds = readCount(row.seconds);
    const adds = readCount(row.adds);
    const likes = readCount(row.likes);
    if (
      !label ||
      players === undefined ||
      seconds === undefined ||
      adds === undefined ||
      likes === undefined
    ) {
      return false;
    }
    const category2 = textOf(row.category2, 32);
    scenes.push({
      ...label,
      ...(category2 ? { category2 } : {}),
      players,
      seconds,
      adds,
      likes,
    });
    return true;
  });
  return allRead ? scenes : undefined;
};

/**
 * Time on screen by kind, for "what to make more of": each scene's seconds
 * go to its category, and a scene with two categories splits them. Largest
 * share first; a scene with no category counts under `other`.
 */
export const secondsByCategory = (
  scenes: readonly IFavouriteScene[],
): Array<{ category: string; seconds: number; scenes: number }> => {
  const totals = new Map<string, { seconds: number; scenes: number }>();
  scenes.forEach((scene) => {
    const kinds = [scene.category ?? 'other', scene.category2].filter(
      (kind): kind is string => kind !== undefined,
    );
    kinds.forEach((kind) => {
      const entry = totals.get(kind) ?? { seconds: 0, scenes: 0 };
      entry.seconds += scene.seconds / kinds.length;
      entry.scenes += 1;
      totals.set(kind, entry);
    });
  });
  return [...totals.entries()]
    .map(([category, entry]) => ({ category, ...entry }))
    .sort(
      (a, b) => b.seconds - a.seconds || a.category.localeCompare(b.category),
    );
};

/** The look a scene plays as, for its picture and for playing it. */
export const lookIdOfScene = (scene: ISceneRef): string =>
  scene.authorId === undefined
    ? premiumLookId(scene.sceneId)
    : memberLookId(scene.authorId, scene.sceneId);
