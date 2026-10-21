/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { sanitizeDisplayText } from './memberScenes';
import { readCount, readNames } from './plusGallery';
import type { TLocalizedName } from './scenePackFields';

/**
 * Announcements of new scenes (premium migration 0050): the admin writes one
 * — a title, a line, up to six of FluidEQ's own scenes, when it goes out and
 * who it is for — and every signed-in app shows it once, big, over the
 * window. Which ones a person has seen stays on their computer.
 *
 * The limits are the server's own checks, repeated so the composer can say
 * what is wrong before anything is sent.
 */

export const ANNOUNCEMENT_AUDIENCES = [
  'everyone',
  'members',
  'trial-ending',
] as const;
export type TAnnouncementAudience = (typeof ANNOUNCEMENT_AUDIENCES)[number];

export const MAX_ANNOUNCEMENT_TITLE = 80;
export const MAX_ANNOUNCEMENT_BODY = 280;
export const MAX_ANNOUNCEMENT_SCENES = 6;

export const isAnnouncementAudience = (
  value: unknown,
): value is TAnnouncementAudience =>
  typeof value === 'string' &&
  (ANNOUNCEMENT_AUDIENCES as readonly string[]).includes(value);

export interface IAnnouncedScene {
  sceneId: string;
  version: number;
  names: TLocalizedName;
}

/** An announcement as a member's app receives it. */
export interface IAnnouncement {
  id: number;
  title: string;
  body: string;
  scenes: IAnnouncedScene[];
  startsAt: number;
}

/** An announcement as the admin's page lists it. */
export interface IAdminAnnouncement extends IAnnouncement {
  audience: TAnnouncementAudience;
  createdAt: number;
}

/** What the composer sends: a new one, or one not yet out changed. */
export interface IAnnouncementDraft {
  id?: number;
  title: string;
  body: string;
  scenes: string[];
  startsAt: number;
  audience: TAnnouncementAudience;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const SCENE_ID = /^[a-z][a-z0-9-]{1,47}$/;

const timeOf = (value: unknown) =>
  typeof value === 'string' ? Date.parse(value) : Number.NaN;

const scenesOf = (value: unknown): IAnnouncedScene[] | undefined => {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const scenes: IAnnouncedScene[] = [];
  value.forEach((raw: unknown) => {
    if (!isRecord(raw) || typeof raw.scene !== 'string') {
      return;
    }
    const version = readCount(raw.version);
    const names = readNames(raw.names);
    if (SCENE_ID.test(raw.scene) && version && names) {
      scenes.push({ sceneId: raw.scene, version, names });
    }
  });
  return scenes;
};

/** What every announcement row carries, or undefined. */
const readCommon = (row: unknown) => {
  if (!isRecord(row)) {
    return undefined;
  }
  const id = readCount(row.id);
  const title = sanitizeDisplayText(row.title);
  const body =
    row.body === '' ? '' : (sanitizeDisplayText(row.body) ?? undefined);
  const scenes = scenesOf(row.scenes);
  const startsAt = timeOf(row.starts_at);
  // A scene taken out since leaves the rest; one with none left says nothing.
  if (
    !id ||
    !title ||
    body === undefined ||
    !scenes ||
    scenes.length === 0 ||
    !Number.isFinite(startsAt)
  ) {
    return undefined;
  }
  return {
    row,
    announcement: {
      id,
      title: title.slice(0, MAX_ANNOUNCEMENT_TITLE),
      body: body.slice(0, MAX_ANNOUNCEMENT_BODY),
      scenes: scenes.slice(0, MAX_ANNOUNCEMENT_SCENES),
      startsAt,
    },
  };
};

/**
 * `current_announcements`: the ones that read. A member's card is a courtesy,
 * so a row that does not read is passed over rather than costing the rest.
 */
export const parseAnnouncements = (rows: unknown): IAnnouncement[] => {
  if (!Array.isArray(rows)) {
    return [];
  }
  // The row's `trial_ends_at` is not read: the card's line about a trial
  // ending offered Plus, which is not sold any more.
  return rows.flatMap((raw: unknown): IAnnouncement[] => {
    const read = readCommon(raw);
    return read ? [read.announcement] : [];
  });
};

/**
 * `admin_announcements`, or undefined when any row does not read: the admin
 * deciding whether to write one more must see every one that exists.
 */
export const parseAdminAnnouncements = (
  rows: unknown,
): IAdminAnnouncement[] | undefined => {
  if (!Array.isArray(rows)) {
    return undefined;
  }
  const listed: IAdminAnnouncement[] = [];
  const allRead = rows.every((raw: unknown) => {
    const read = readCommon(raw);
    const createdAt = read ? timeOf(read.row.created_at) : Number.NaN;
    if (
      !read ||
      !isAnnouncementAudience(read.row.audience) ||
      !Number.isFinite(createdAt)
    ) {
      return false;
    }
    listed.push({
      ...read.announcement,
      audience: read.row.audience,
      createdAt,
    });
    return true;
  });
  return allRead ? listed : undefined;
};

/** A draft as the server would take it, or undefined. */
export const readAnnouncementDraft = (
  value: unknown,
): IAnnouncementDraft | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }
  const { id, title, body, scenes, startsAt, audience } = value;
  const cleanTitle = sanitizeDisplayText(title);
  const cleanBody = body === '' ? '' : sanitizeDisplayText(body);
  if (
    (id !== undefined && !readCount(id)) ||
    !cleanTitle ||
    cleanTitle.length > MAX_ANNOUNCEMENT_TITLE ||
    cleanBody === undefined ||
    cleanBody.length > MAX_ANNOUNCEMENT_BODY ||
    !Array.isArray(scenes) ||
    scenes.length === 0 ||
    scenes.length > MAX_ANNOUNCEMENT_SCENES ||
    !scenes.every(
      (scene: unknown) => typeof scene === 'string' && SCENE_ID.test(scene),
    ) ||
    new Set(scenes).size !== scenes.length ||
    typeof startsAt !== 'number' ||
    !Number.isFinite(startsAt) ||
    !isAnnouncementAudience(audience)
  ) {
    return undefined;
  }
  return {
    ...(typeof id === 'number' ? { id } : {}),
    title: cleanTitle,
    body: cleanBody,
    scenes: scenes as string[],
    startsAt,
    audience,
  };
};

/**
 * The newest announcement this person has not been shown, or undefined. The
 * server lists them newest first.
 */
export const nextAnnouncement = (
  announcements: readonly IAnnouncement[],
  seen: ReadonlySet<number>,
): IAnnouncement | undefined =>
  announcements.find((announcement) => !seen.has(announcement.id));

/**
 * Trial ends counted by the admin's own calendar day, for "N trials end the
 * day after". Keys are local `YYYY-MM-DD`.
 */
export const trialEndsByDay = (
  ends: readonly number[],
): Map<string, number> => {
  const counts = new Map<string, number>();
  ends.forEach((end) => {
    const date = new Date(end);
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  });
  return counts;
};
