/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { sanitizeDisplayText } from './memberScenes';
import { readCount, readNames } from './plusGallery';
import type { TLocalizedName } from './scenePackFields';

/**
 * Announcements of new scenes (premium migration 0050): a title, a line and
 * up to six of FluidEQ's own scenes, which every signed-in app shows once,
 * big, over the window. Which ones a person has seen stays on their computer.
 *
 * The limits are the server's own checks.
 */

export const MAX_ANNOUNCEMENT_TITLE = 80;
export const MAX_ANNOUNCEMENT_BODY = 280;
export const MAX_ANNOUNCEMENT_SCENES = 6;

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

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const SCENE_ID = /^[a-z][a-z0-9-]{1,47}$/;

export const timeOf = (value: unknown) =>
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
export const readCommon = (row: unknown) => {
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
 * The newest announcement this person has not been shown, or undefined. The
 * server lists them newest first.
 */
export const nextAnnouncement = (
  announcements: readonly IAnnouncement[],
  seen: ReadonlySet<number>,
): IAnnouncement | undefined =>
  announcements.find((announcement) => !seen.has(announcement.id));
