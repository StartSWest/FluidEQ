/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rooms the Room card offers, each a whole room.
 *
 * A preset sets the room's shape and where the speakers stand; it leaves the
 * head, the headphone switch and the power switch as they are, because those
 * are about the listener and not the room. Touching any dial or dragging a
 * speaker afterwards makes the result `custom`.
 */

import { DSP_DEFAULTS, IRoomSettings, TRoomPreset } from './chain';

type TRoomShape = Pick<
  IRoomSettings,
  'sizeM' | 'walls' | 'distanceM' | 'centreDb' | 'subDb' | 'angles' | 'levels'
>;

const RING = DSP_DEFAULTS.room.angles;
const FLAT = DSP_DEFAULTS.room.levels;

/**
 * Measured against the living room's 4.2 m and its half-absorbent walls: the
 * studio is close and dead, the cinema large and far with the centre and
 * the sub brought up as a theatre's are, and the front stage is the living
 * room with the surrounds pulled back so music sits in front.
 */
export const ROOM_PRESET_SHAPES: Record<
  Exclude<TRoomPreset, 'custom'>,
  TRoomShape
> = {
  studio: {
    sizeM: 3.2,
    walls: 0.8,
    distanceM: 1.4,
    centreDb: 0,
    subDb: 0,
    angles: RING,
    levels: FLAT,
  },
  livingRoom: {
    sizeM: DSP_DEFAULTS.room.sizeM,
    walls: DSP_DEFAULTS.room.walls,
    distanceM: DSP_DEFAULTS.room.distanceM,
    centreDb: 0,
    subDb: 0,
    angles: RING,
    levels: FLAT,
  },
  cinema: {
    sizeM: 9,
    walls: 0.35,
    distanceM: 4,
    centreDb: 1.5,
    subDb: 2,
    angles: RING,
    levels: FLAT,
  },
  frontStage: {
    sizeM: 4.2,
    walls: 0.6,
    distanceM: 2,
    centreDb: 0,
    subDb: 0,
    angles: RING,
    levels: [0, 0, 0, -6, -6, -6, -6],
  },
};

export const isRoomPresetId = (
  id: string,
): id is Exclude<TRoomPreset, 'custom'> => id in ROOM_PRESET_SHAPES;

/** `current` with the preset's room, and its name on it. */
export const roomPresetSettings = (
  current: IRoomSettings,
  id: Exclude<TRoomPreset, 'custom'>,
): IRoomSettings => {
  const shape = ROOM_PRESET_SHAPES[id];
  return {
    ...current,
    ...shape,
    angles: [...shape.angles],
    levels: [...shape.levels],
    presetId: id,
  };
};
