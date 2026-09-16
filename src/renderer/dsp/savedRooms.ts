/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  clampDspSettings,
  DSP_DEFAULTS,
  IRoomSettings,
} from '../../common/dsp/chain';
import { TRoomShape } from '../../common/dsp/roomPresets';

/**
 * Rooms the user shaped and named.
 *
 * The same arrangement as the crossfade's saved curves and for the same
 * reasons: stored whole, kept out of the DSP settings so nothing in the app
 * can overwrite them, not translated because the user named them. A saved
 * room is the room's shape — size, walls, distance, centre, sub, where the
 * speakers stand and how loud each is — and never the head or the headphone
 * switch, which belong to the listener and not to the room, exactly as the
 * built-in presets leave them alone.
 */
export interface ISavedRoom {
  id: string;
  name: string;
  shape: TRoomShape;
}

const STORAGE_KEY = 'fluideq.dsp.savedRooms.v1';

/** Long enough to name a room, short enough to sit on a chip. */
export const SAVED_ROOM_NAME_MAX = 40;

/** What marks a saved room's id as the user's, never a built-in preset's. */
export const SAVED_ROOM_PREFIX = 'room:';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** The room's shape, clamped through the settings clamp like any room. */
export const roomShapeOf = (room: unknown): TRoomShape => {
  const source = isRecord(room) ? room : {};
  const clamped = clampDspSettings({
    ...DSP_DEFAULTS,
    room: { ...DSP_DEFAULTS.room, ...source },
  }).room;
  return {
    sizeM: clamped.sizeM,
    walls: clamped.walls,
    distanceM: clamped.distanceM,
    centreDb: clamped.centreDb,
    subDb: clamped.subDb,
    angles: [...clamped.angles],
    levels: [...clamped.levels],
  };
};

/** Whether a room stands exactly as a saved shape describes. */
export const roomShapesMatch = (
  shape: TRoomShape,
  room: Pick<IRoomSettings, keyof TRoomShape>,
): boolean =>
  shape.sizeM === room.sizeM &&
  shape.walls === room.walls &&
  shape.distanceM === room.distanceM &&
  shape.centreDb === room.centreDb &&
  shape.subDb === room.subDb &&
  shape.angles.length === room.angles.length &&
  shape.angles.every((angle, at) => angle === room.angles[at]) &&
  shape.levels.length === room.levels.length &&
  shape.levels.every((level, at) => level === room.levels[at]);

/**
 * Everything readable out of storage, clamped on the way in: this is JSON
 * from disk an older build may have written, and a speaker at an angle the
 * ring does not have is a kernel nobody measured.
 */
export const readSavedRooms = (): ISavedRoom[] => {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.flatMap((entry): ISavedRoom[] => {
      if (
        !isRecord(entry) ||
        typeof entry.id !== 'string' ||
        typeof entry.name !== 'string'
      ) {
        return [];
      }
      return [
        { id: entry.id, name: entry.name, shape: roomShapeOf(entry.shape) },
      ];
    });
  } catch {
    // Unreadable storage is the same answer as none: a saved room is a
    // convenience and losing the list must not cost the session.
    return [];
  }
};

const write = (rooms: readonly ISavedRoom[]): void => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
  } catch {
    // Quota or a locked profile. The room stays live on the card either way,
    // which is the part the user is looking at.
  }
};

/** An id no saved room already holds; see `crossfadeCurves.ts` for why. */
const freshId = (taken: readonly ISavedRoom[]): string => {
  const used = new Set(taken.map((room) => room.id));
  let id: string;
  do {
    id = `${SAVED_ROOM_PREFIX}${Date.now().toString(36)}${Math.random()
      .toString(36)
      .slice(2, 6)}`;
  } while (used.has(id));
  return id;
};

/**
 * Save under a name, replacing any room that already has it: two chips with
 * one name is a row nobody can use, and the dialog said it would overwrite.
 */
export const saveRoom = (
  name: string,
  room: Pick<IRoomSettings, keyof TRoomShape>,
): ISavedRoom[] => {
  const trimmed = name.trim().slice(0, SAVED_ROOM_NAME_MAX);
  if (!trimmed) {
    return readSavedRooms();
  }
  const existing = readSavedRooms();
  const match = existing.find(
    (one) => one.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const saved: ISavedRoom = {
    id: match?.id ?? freshId(existing),
    name: trimmed,
    shape: roomShapeOf(room),
  };
  const next = match
    ? existing.map((one) => (one.id === match.id ? saved : one))
    : [...existing, saved];
  write(next);
  return next;
};

export const deleteSavedRoom = (id: string): ISavedRoom[] => {
  const next = readSavedRooms().filter((room) => room.id !== id);
  write(next);
  return next;
};
