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

export type TRoomShape = Pick<
  IRoomSettings,
  | 'sizeM'
  | 'walls'
  | 'distanceM'
  | 'centreDb'
  | 'subDb'
  | 'angles'
  | 'levels'
  | 'distances'
>;

/** The same groups the other stages' pickers use, so the menu reads alike. */
export const ROOM_PRESET_GROUPS = ['basic', 'playback', 'character'] as const;

export type TRoomPresetGroup = (typeof ROOM_PRESET_GROUPS)[number];

export type TRoomPresetId = Exclude<TRoomPreset, 'custom'>;

export interface IRoomPreset {
  id: TRoomPresetId;
  labelKey: string;
  group: TRoomPresetGroup;
  shape: TRoomShape;
}

const RING = DSP_DEFAULTS.room.angles;
const FLAT = DSP_DEFAULTS.room.levels;

/**
 * The seven numbers a room is: side in metres, how much the walls absorb
 * (0 hard, 1 dead), the speakers' distance in metres, the centre and the sub
 * in dB, then where the seven speakers stand and how loud each is. The
 * speakers always stand inside the room (distance at most half the side),
 * which `dspRoomPresets.test.ts` holds for every room here.
 */
const shape = (
  sizeM: number,
  walls: number,
  distanceM: number,
  centreDb: number,
  subDb: number,
  angles: readonly number[] = RING,
  levels: readonly number[] = FLAT,
): TRoomShape => ({
  sizeM,
  walls,
  distanceM,
  centreDb,
  subDb,
  angles: [...angles],
  levels: [...levels],
  // A preset stands its speakers on the ring; a distance of its own is a
  // custom room's.
  distances: Array.from({ length: angles.length }, () => distanceM),
});

/**
 * Measured against the living room's 4.2 m and its half-absorbent walls.
 * Each room is a place someone has sat in: the near field is a desk with
 * monitors an arm away and the room treated dead; the home theatre a
 * sofa-sized room with the surrounds behind the shoulders and the centre and
 * sub brought up a little, the cinema the same idea at ten times the volume
 * with the surrounds further round; the concert hall is large and live with
 * the stage narrow in front and the surrounds turned into ambience; the jazz
 * club small, warm and close with the sub up a touch; the club hard-walled
 * with the sub well up and the rears held back; open air has no walls at
 * all, so nothing comes back — the sound is the speakers and the head only.
 * `room_presets_test.cpp` runs the engine's room through this exact table.
 */
const ROOM_PRESET_BY_ID = {
  studio: {
    id: 'studio',
    labelKey: 'dsp.room.preset.studio',
    group: 'basic',
    shape: shape(3.2, 0.8, 1.4, 0, 0),
  },
  livingRoom: {
    id: 'livingRoom',
    labelKey: 'dsp.room.preset.livingRoom',
    group: 'basic',
    shape: shape(
      DSP_DEFAULTS.room.sizeM,
      DSP_DEFAULTS.room.walls,
      DSP_DEFAULTS.room.distanceM,
      0,
      0,
    ),
  },
  frontStage: {
    id: 'frontStage',
    labelKey: 'dsp.room.preset.frontStage',
    group: 'basic',
    shape: shape(4.2, 0.6, 2, 0, 0, RING, [0, 0, 0, -6, -6, -6, -6]),
  },
  homeTheatre: {
    id: 'homeTheatre',
    labelKey: 'dsp.room.preset.homeTheatre',
    group: 'playback',
    shape: shape(5.5, 0.45, 2.6, 1, 1.5, [-28, 28, 0, -110, 110, -150, 150]),
  },
  cinema: {
    id: 'cinema',
    labelKey: 'dsp.room.preset.cinema',
    group: 'playback',
    shape: shape(9, 0.35, 4, 1.5, 2, [-30, 30, 0, -105, 105, -145, 145]),
  },
  gaming: {
    id: 'gaming',
    labelKey: 'dsp.room.preset.gaming',
    group: 'playback',
    shape: shape(
      4.5,
      0.5,
      1.8,
      0,
      1,
      [-30, 30, 0, -95, 95, -135, 135],
      [0, 0, 0, 1, 1, 1, 1],
    ),
  },
  concertHall: {
    id: 'concertHall',
    labelKey: 'dsp.room.preset.concertHall',
    group: 'playback',
    shape: shape(
      12,
      0.2,
      5,
      0,
      -2,
      [-25, 25, 0, -100, 100, -140, 140],
      [0, 0, 0, -3, -3, -4, -4],
    ),
  },
  jazzClub: {
    id: 'jazzClub',
    labelKey: 'dsp.room.preset.jazzClub',
    group: 'playback',
    shape: shape(5, 0.4, 2.2, 0, 1, [-35, 35, 0, -100, 100, -140, 140]),
  },
  club: {
    id: 'club',
    labelKey: 'dsp.room.preset.club',
    group: 'playback',
    shape: shape(6, 0.15, 2.5, 0, 4, RING, [0, 0, 0, -1, -1, -2, -2]),
  },
  nearField: {
    id: 'nearField',
    labelKey: 'dsp.room.preset.nearField',
    group: 'character',
    shape: shape(2.4, 0.9, 0.9, 0, 0, [-30, 30, 0, -90, 90, -135, 135]),
  },
  openAir: {
    id: 'openAir',
    labelKey: 'dsp.room.preset.openAir',
    group: 'character',
    shape: shape(12, 1, 3, 0, -1),
  },
} satisfies Record<TRoomPresetId, IRoomPreset>;

/** In the picker's order: by group, then as written above. */
export const ROOM_PRESET_LIST: readonly IRoomPreset[] =
  ROOM_PRESET_GROUPS.flatMap((group) =>
    Object.values(ROOM_PRESET_BY_ID).filter((preset) => preset.group === group),
  );

/** The shape of each room, by id, for whoever needs numbers and not names. */
export const ROOM_PRESET_SHAPES: Record<TRoomPresetId, TRoomShape> =
  Object.fromEntries(
    Object.values(ROOM_PRESET_BY_ID).map((preset) => [preset.id, preset.shape]),
  ) as Record<TRoomPresetId, TRoomShape>;

export const isRoomPresetId = (id: string): id is TRoomPresetId =>
  Object.prototype.hasOwnProperty.call(ROOM_PRESET_BY_ID, id);

/** `current` with the preset's room, and its name on it. */
export const roomPresetSettings = (
  current: IRoomSettings,
  id: TRoomPresetId,
): IRoomSettings => {
  const preset = ROOM_PRESET_SHAPES[id];
  return {
    ...current,
    ...preset,
    angles: [...preset.angles],
    levels: [...preset.levels],
    distances: [...preset.distances],
    presetId: id,
  };
};
