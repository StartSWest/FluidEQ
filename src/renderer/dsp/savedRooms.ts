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
import { roomShapeOf, TRoomShape } from '../../common/dsp/roomPresets';

/**
 * Rooms the user shaped and named.
 *
 * The same arrangement as the crossfade's saved curves and for the same
 * reasons: stored whole, kept out of the DSP settings so nothing in the app
 * can overwrite them, not translated because the user named them. A saved
 * room is all of the room (`TRoomShape`) — size, walls, distance, centre,
 * sub, where the speakers stand, how loud and how far each is, which are
 * muted, bass management and whether stereo fills it — and never the head or
 * the headphone switch, which belong to the listener and not to the room,
 * exactly as the built-in presets leave them alone.
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

/**
 * The shape in a blob from storage, clamped through the settings clamp like
 * any room. A room saved before mutes were part of a shape reads as every
 * speaker playing, which is what the clamp gives a room with none.
 */
const storedShape = (room: unknown): TRoomShape =>
  roomShapeOf(
    clampDspSettings({
      ...DSP_DEFAULTS,
      room: { ...DSP_DEFAULTS.room, ...(isRecord(room) ? room : {}) },
    }).room,
  );

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
  shape.levels.every((level, at) => level === room.levels[at]) &&
  shape.distances.length === room.distances.length &&
  shape.distances.every((distance, at) => distance === room.distances[at]) &&
  shape.mutes.length === room.mutes.length &&
  shape.mutes.every((mute, at) => mute === room.mutes[at]) &&
  shape.bassManagement === room.bassManagement &&
  shape.crossoverHz === room.crossoverHz &&
  shape.musicUpmix === room.musicUpmix &&
  shape.upmixAmount === room.upmixAmount &&
  shape.rendererVersion === room.rendererVersion &&
  shape.earlyReflectionDb === room.earlyReflectionDb &&
  shape.ambienceMix === room.ambienceMix &&
  shape.ambienceDecayS === room.ambienceDecayS &&
  shape.ambienceDampingHz === room.ambienceDampingHz &&
  shape.preservePosition === room.preservePosition;

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
        { id: entry.id, name: entry.name, shape: storedShape(entry.shape) },
      ];
    });
  } catch {
    // Unreadable storage is the same answer as none: a saved room is a
    // convenience and losing the list must not cost the session.
    return [];
  }
};

/**
 * Whether the list reached storage. A full quota or a locked profile throws,
 * and a save that did not happen must not be announced as one: the caller
 * says so instead (`ISaveRoomResult.stored`).
 */
const write = (rooms: readonly ISavedRoom[]): boolean => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(rooms));
    return true;
  } catch {
    return false;
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

const NUMBERED = / \((\d+)\)$/;

/**
 * The name a room will be saved under: the one asked for, or, where a room
 * already has it (whatever the capitals), the same name numbered — "Den",
 * then "Den (2)", then "Den (3)". A name that already ends in a number counts
 * on from its stem, and a long one gives up letters, never the number, to
 * stay inside the limit. Empty when there is nothing to name a room with.
 */
export const uniqueRoomName = (
  name: string,
  taken: readonly string[],
): string => {
  const trimmed = name.trim().slice(0, SAVED_ROOM_NAME_MAX).trim();
  const used = new Set(taken.map((one) => one.trim().toLowerCase()));
  if (trimmed === '' || !used.has(trimmed.toLowerCase())) {
    return trimmed;
  }
  const stem = trimmed.replace(NUMBERED, '').trim();
  for (let n = 2; ; n += 1) {
    const suffix = ` (${n})`;
    const candidate = `${stem
      .slice(0, SAVED_ROOM_NAME_MAX - suffix.length)
      .trim()}${suffix}`;
    if (!used.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
};

export interface ISaveRoomResult {
  rooms: ISavedRoom[];
  /** The room as saved, under the name it actually got; none for no name. */
  saved: ISavedRoom | undefined;
  /** False when storage refused: `rooms` is then what was there before. */
  stored: boolean;
}

/**
 * Save under a name, beside every room already there. It used to replace a
 * room of the same name, silently and with its id: a shape somebody had
 * tuned and named was gone for typing the name again. A taken name is
 * numbered instead (`uniqueRoomName`), and the dialog says which name it will
 * be before the press.
 */
export const saveRoom = (
  name: string,
  room: Pick<IRoomSettings, keyof TRoomShape>,
): ISaveRoomResult => {
  const existing = readSavedRooms();
  const label = uniqueRoomName(
    name,
    existing.map((one) => one.name),
  );
  if (label === '') {
    return { rooms: existing, saved: undefined, stored: false };
  }
  const saved: ISavedRoom = {
    id: freshId(existing),
    name: label,
    shape: storedShape(room),
  };
  const next = [...existing, saved];
  return write(next)
    ? { rooms: next, saved, stored: true }
    : { rooms: existing, saved: undefined, stored: false };
};

/** The list without that room; unchanged when storage refuses the write. */
export const deleteSavedRoom = (id: string): ISavedRoom[] => {
  const existing = readSavedRooms();
  const next = existing.filter((room) => room.id !== id);
  return write(next) ? next : existing;
};
