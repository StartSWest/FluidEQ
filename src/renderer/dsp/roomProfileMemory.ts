/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which room the one on the card was edited away from, so "Restore" has
 * something to restore.
 *
 * Moving any dial makes the room `custom`, and `custom` does not say what it
 * used to be. The card remembers: the room that was applied — a built-in one
 * or a saved one — and the shape its own last edit left. Restore is offered
 * only while the room on the card IS that last edit. A rack preset, an
 * import or Reset puts a different room there, and a custom room met after a
 * restart was edited in a session nobody remembers: in both cases the card
 * offers nothing rather than guess a profile that may never have been there.
 *
 * Module state and not the card's: the card unmounts whenever another page of
 * the rack is opened, and coming back to a room that has forgotten where it
 * came from thirty seconds ago is the same bug as guessing.
 */

import { IRoomSettings, TRoomPreset } from '../../common/dsp/chain';
import {
  roomPresetOf,
  roomShapeOf,
  TRoomShape,
} from '../../common/dsp/roomPresets';
import { roomShapesMatch } from './savedRooms';

export interface IRoomSource {
  /** A built-in room's id, or `custom` for a saved room. */
  presetId: TRoomPreset;
  /** The saved room's own name; a built-in room is named by its id. */
  name?: string;
  shape: TRoomShape;
}

let source: IRoomSource | undefined;
let edited: TRoomShape | undefined;

/** Its own arrays: the caller's room goes on being edited. */
const copyOf = (shape: TRoomShape): TRoomShape => ({
  ...shape,
  angles: [...shape.angles],
  levels: [...shape.levels],
  distances: [...shape.distances],
  mutes: [...shape.mutes],
});

/** A room was applied whole: it is what an edit will have come from. */
export const rememberRoomSource = (next: IRoomSource): void => {
  source = { ...next, shape: copyOf(next.shape) };
  edited = undefined;
};

/**
 * The card changed the room from `before` to `after`. A room edited for the
 * first time is remembered as where the edit came from: the built-in room it
 * was, or the saved room it stood in (`standingIn`, which only the card can
 * know — a saved room's name is not in the settings).
 */
export const trackRoomEdit = (
  before: IRoomSettings,
  after: IRoomSettings,
  standingIn?: IRoomSource,
): void => {
  const builtIn = roomPresetOf(before.presetId);
  if (builtIn !== undefined) {
    rememberRoomSource({ presetId: builtIn.id, shape: builtIn.shape });
  } else if (standingIn !== undefined) {
    rememberRoomSource(standingIn);
  }
  edited = roomShapeOf(after);
};

/**
 * What Restore would put back, or nothing: only for a custom room that is
 * exactly the card's own last edit of a room it remembers applying.
 */
export const roomRestoreSource = (
  room: IRoomSettings,
): IRoomSource | undefined =>
  room.presetId === 'custom' &&
  source !== undefined &&
  edited !== undefined &&
  roomShapesMatch(edited, room)
    ? source
    : undefined;

/** For tests, and for Reset: nothing is remembered. */
export const forgetRoomSource = (): void => {
  source = undefined;
  edited = undefined;
};
