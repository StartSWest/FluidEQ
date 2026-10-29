/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { memberLookId } from './memberScenes';
import { readCount, readNames } from './plusGallery';
import { premiumLookId } from './scenePacks';
import type { TLocalizedName } from './scenePackFields';

/**
 * Which scenes members add and like, for the admin (premium migrations 0047
 * and 0071): one account's scenes, and every scene by how many people get
 * it. Asked for so new sets follow what members actually choose. What they
 * watch, and for how long, is not kept (Ivan, 2026-10-24): only what people
 * do on purpose.
 *
 * A scene is named the way the server files it: FluidEQ's own by its pack id
 * with no author, a member's by author and scene id. The server decides who
 * may read any of this; these are only the shapes on their way to the page.
 */

/** The periods the favourites page offers, in days; the last is "all time". */
export const FAVOURITE_PERIODS = [7, 30, 90, 3650] as const;
export type TFavouritePeriod = (typeof FAVOURITE_PERIODS)[number];

export const isFavouritePeriod = (value: unknown): value is TFavouritePeriod =>
  (FAVOURITE_PERIODS as readonly unknown[]).includes(value);

/** A scene as the server files it: no author for one of FluidEQ's own. */
export interface ISceneRef {
  authorId?: string;
  sceneId: string;
}

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
}

/** One scene in the favourites. */
export interface IFavouriteScene extends ISceneLabel {
  category2?: string;
  adds: number;
  likes: number;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const ACCOUNT_ID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const SCENE_ID = /^[a-z][a-z0-9-]{1,47}$/;

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
    const addedAt = timeOf(row.added_at);
    const likedAt = timeOf(row.liked_at);
    if (!label || Number.isNaN(addedAt) || Number.isNaN(likedAt)) {
      return false;
    }
    scenes.push({
      ...label,
      ...(addedAt === undefined ? {} : { addedAt }),
      ...(likedAt === undefined ? {} : { likedAt }),
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
    const adds = readCount(row.adds);
    const likes = readCount(row.likes);
    if (!label || adds === undefined || likes === undefined) {
      return false;
    }
    const category2 = textOf(row.category2, 32);
    scenes.push({
      ...label,
      ...(category2 ? { category2 } : {}),
      adds,
      likes,
    });
    return true;
  });
  return allRead ? scenes : undefined;
};

/**
 * Adds by kind, for "what to make more of": each scene's adds go to its
 * category, and a scene with two categories splits them. Largest share
 * first; a scene with no category counts under `other`.
 */
export const addsByCategory = (
  scenes: readonly IFavouriteScene[],
): Array<{ category: string; adds: number; scenes: number }> => {
  const totals = new Map<string, { adds: number; scenes: number }>();
  scenes.forEach((scene) => {
    const kinds = [scene.category ?? 'other', scene.category2].filter(
      (kind): kind is string => kind !== undefined,
    );
    kinds.forEach((kind) => {
      const entry = totals.get(kind) ?? { adds: 0, scenes: 0 };
      entry.adds += scene.adds / kinds.length;
      entry.scenes += 1;
      totals.set(kind, entry);
    });
  });
  return [...totals.entries()]
    .map(([category, entry]) => ({ category, ...entry }))
    .sort((a, b) => b.adds - a.adds || a.category.localeCompare(b.category));
};

/** The look a scene plays as, for its picture and for playing it. */
export const lookIdOfScene = (scene: ISceneRef): string =>
  scene.authorId === undefined
    ? premiumLookId(scene.sceneId)
    : memberLookId(scene.authorId, scene.sceneId);
