/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The rooms the Room card offers, each a whole room.
 *
 * A preset sets ALL of the room: its shape, where the speakers stand,
 * everything set per speaker — level, distance, mute — and how it sounds:
 * bass management and its crossover, the front stage or the filled room and
 * its amount. It used to leave those last four alone as "the listener's", so
 * "fill the room" switched on in one room followed the listener into every
 * other, and a preset was a different sound depending on what came before
 * it. What it leaves is the head and the headphone switch — the listener's
 * anatomy and machine, which no room can know — the power switch, and the
 * two choices that are about what is playing rather than about the room: the
 * comparison with the original and "my source is already spatial".
 * Touching any dial, dragging a speaker or muting one afterwards makes the
 * result `custom`.
 *
 * Two collections. The eleven classic rooms are the ones the card shipped
 * with, on the first renderer, and stay exactly as they sound: their ids,
 * their order and every number. The six featured rooms are on the second
 * renderer — speakers placed between the head's measured directions, the
 * walls' level a dial of its own (Space) and a tail after them (Ambience) —
 * and each is a purpose rather than a place.
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
  | 'mutes'
  | 'bassManagement'
  | 'crossoverHz'
  | 'musicUpmix'
  | 'upmixAmount'
  | 'rendererVersion'
  | 'earlyReflectionDb'
  | 'ambienceMix'
  | 'ambienceDecayS'
  | 'ambienceDampingHz'
  | 'preservePosition'
>;

/** The same groups the other stages' pickers use, so the menu reads alike. */
export const ROOM_PRESET_GROUPS = ['basic', 'playback', 'character'] as const;

export type TRoomPresetGroup = (typeof ROOM_PRESET_GROUPS)[number];

export type TRoomPresetId = Exclude<TRoomPreset, 'custom'>;

export type TRoomFeaturedId =
  | 'referenceV2'
  | 'musicSpaceV2'
  | 'cinemaV2'
  | 'gameWorldV2'
  | 'competitiveV2'
  | 'liveVenueV2';

export type TRoomClassicId = Exclude<TRoomPresetId, TRoomFeaturedId>;

export type TRoomCollection = 'featured' | 'classic';

export interface IRoomPreset {
  id: TRoomPresetId;
  collection: TRoomCollection;
  labelKey: string;
  /** What the room is for, in a line. The featured rooms have one. */
  purposeKey?: string;
  /** The classic rooms' group in a menu; a featured room has none. */
  group?: TRoomPresetGroup;
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
  // And every speaker of a built-in room plays. Everything set per speaker is
  // the room's: a preset, and Reset with it, puts all of it back — a mute
  // that outlived Reset left a room reading "Living room" with half its
  // speakers struck through.
  mutes: [...DSP_DEFAULTS.room.mutes],
  // How a built-in room sounds is the card's own defaults, the same for all
  // eleven: bass to the sub's path at 80 Hz, stereo on the front stage. They
  // are in the shape so that choosing a room puts them back, and a saved
  // room keeps whatever they were.
  bassManagement: DSP_DEFAULTS.room.bassManagement,
  crossoverHz: DSP_DEFAULTS.room.crossoverHz,
  musicUpmix: DSP_DEFAULTS.room.musicUpmix,
  upmixAmount: DSP_DEFAULTS.room.upmixAmount,
  rendererVersion: DSP_DEFAULTS.room.rendererVersion,
  earlyReflectionDb: DSP_DEFAULTS.room.earlyReflectionDb,
  ambienceMix: DSP_DEFAULTS.room.ambienceMix,
  ambienceDecayS: DSP_DEFAULTS.room.ambienceDecayS,
  ambienceDampingHz: DSP_DEFAULTS.room.ambienceDampingHz,
  preservePosition: DSP_DEFAULTS.room.preservePosition,
});

/** What a featured room adds to the seven numbers. */
interface IFeaturedSound {
  /** A stereo record fills the ring, and by how much; off, the front stage. */
  fill: number | false;
  /** The walls' level, dB; -60 is none at all. */
  space: number;
  /** The tail's share, its length in seconds and where it darkens, Hz. */
  tail: readonly [mix: number, decayS: number, dampingHz: number];
}

/**
 * A featured room: a classic room's seven numbers, then how the second
 * renderer sounds in it. Every one keeps the speakers where the room puts
 * them (`preservePosition`): Dimension's widening, downstream, would move
 * what the head just placed.
 */
const featured = (
  base: TRoomShape,
  { fill, space, tail }: IFeaturedSound,
): TRoomShape => ({
  ...base,
  musicUpmix: fill !== false,
  upmixAmount: fill === false ? DSP_DEFAULTS.room.upmixAmount : fill,
  rendererVersion: 2,
  earlyReflectionDb: space,
  ambienceMix: tail[0],
  ambienceDecayS: tail[1],
  ambienceDampingHz: tail[2],
  preservePosition: true,
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
const ROOM_CLASSIC_BY_ID = {
  studio: {
    id: 'studio',
    collection: 'classic',
    labelKey: 'dsp.room.preset.studio',
    group: 'basic',
    shape: shape(3.2, 0.8, 1.4, 0, 0),
  },
  livingRoom: {
    id: 'livingRoom',
    collection: 'classic',
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
    collection: 'classic',
    labelKey: 'dsp.room.preset.frontStage',
    group: 'basic',
    shape: shape(4.2, 0.6, 2, 0, 0, RING, [0, 0, 0, -6, -6, -6, -6]),
  },
  homeTheatre: {
    id: 'homeTheatre',
    collection: 'classic',
    labelKey: 'dsp.room.preset.homeTheatre',
    group: 'playback',
    shape: shape(5.5, 0.45, 2.6, 1, 1.5, [-28, 28, 0, -110, 110, -150, 150]),
  },
  cinema: {
    id: 'cinema',
    collection: 'classic',
    labelKey: 'dsp.room.preset.cinema',
    group: 'playback',
    shape: shape(9, 0.35, 4, 1.5, 2, [-30, 30, 0, -105, 105, -145, 145]),
  },
  gaming: {
    id: 'gaming',
    collection: 'classic',
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
    collection: 'classic',
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
    collection: 'classic',
    labelKey: 'dsp.room.preset.jazzClub',
    group: 'playback',
    shape: shape(5, 0.4, 2.2, 0, 1, [-35, 35, 0, -100, 100, -140, 140]),
  },
  club: {
    id: 'club',
    collection: 'classic',
    labelKey: 'dsp.room.preset.club',
    group: 'playback',
    shape: shape(6, 0.15, 2.5, 0, 4, RING, [0, 0, 0, -1, -1, -2, -2]),
  },
  nearField: {
    id: 'nearField',
    collection: 'classic',
    labelKey: 'dsp.room.preset.nearField',
    group: 'character',
    shape: shape(2.4, 0.9, 0.9, 0, 0, [-30, 30, 0, -90, 90, -135, 135]),
  },
  openAir: {
    id: 'openAir',
    collection: 'classic',
    labelKey: 'dsp.room.preset.openAir',
    group: 'character',
    shape: shape(12, 1, 3, 0, -1),
  },
} satisfies Record<TRoomClassicId, IRoomPreset>;

/**
 * The featured rooms, by what each is for. Tuned by measurement through the
 * shipped head (`room_profiles_test.cpp`, which runs this exact table at four
 * rates on stereo, 5.1 and 7.1, buffered and in game mode) and waiting on
 * ears: the walls and the tail below are relative to a speaker's own direct
 * sound, on a 7.1 stream.
 *
 * - Reference: a close, treated room. Walls 36 dB under the speaker, no tail,
 *   stereo on the front stage: the record, in front of you, and nothing else.
 * - Music Space: a wider pair in a living-sized room, a stereo record gently
 *   spread round the ring, the walls at -28 dB and a third of a second of
 *   tail at -38 dB.
 * - Cinema: a screen-wide front, the centre and the sub up a little (the
 *   sub by no more than 1 dB), a stereo soundtrack filling the room, walls at
 *   -25 dB and a damped 0.7 s tail at -33 dB.
 * - Game World: the surrounds where a game mixes them, a quarter-second tail
 *   so the world has air and a footstep still ends when it ends; a stereo
 *   game stays on the front stage, because spreading it would invent
 *   positions the game never sent.
 * - Competitive: the speakers and the head, nothing else. No walls, no tail,
 *   everything arrives once.
 * - Live Venue: a hall. The walls at -21 dB, a 1.2 s tail at -26 dB darkened
 *   above 4.5 kHz, the surrounds held back as the room's and not the band's.
 */
const ROOM_FEATURED_BY_ID = {
  referenceV2: {
    id: 'referenceV2',
    collection: 'featured',
    labelKey: 'dsp.room.profile.referenceV2',
    purposeKey: 'dsp.room.profilePurpose.referenceV2',
    shape: featured(shape(3.6, 0.65, 1.2, 0, 0), {
      fill: false,
      space: -16,
      tail: [0, 0.2, 8000],
    }),
  },
  musicSpaceV2: {
    id: 'musicSpaceV2',
    collection: 'featured',
    labelKey: 'dsp.room.profile.musicSpaceV2',
    purposeKey: 'dsp.room.profilePurpose.musicSpaceV2',
    shape: featured(
      shape(
        5,
        0.5,
        1.8,
        0,
        0,
        [-32, 32, 0, -100, 100, -140, 140],
        [0, 0, 0, -2, -2, -3, -3],
      ),
      { fill: 0.35, space: -12, tail: [0.3, 0.35, 7000] },
    ),
  },
  cinemaV2: {
    id: 'cinemaV2',
    collection: 'featured',
    labelKey: 'dsp.room.profile.cinemaV2',
    purposeKey: 'dsp.room.profilePurpose.cinemaV2',
    shape: featured(
      shape(8, 0.4, 2.2, 1.5, 1, [-30, 30, 0, -105, 105, -145, 145]),
      { fill: 0.5, space: -8, tail: [0.4, 0.7, 5000] },
    ),
  },
  gameWorldV2: {
    id: 'gameWorldV2',
    collection: 'featured',
    labelKey: 'dsp.room.profile.gameWorldV2',
    purposeKey: 'dsp.room.profilePurpose.gameWorldV2',
    shape: featured(
      shape(5, 0.55, 1.6, 0, 0.5, [-30, 30, 0, -95, 95, -140, 140]),
      { fill: false, space: -14, tail: [0.3, 0.25, 8000] },
    ),
  },
  competitiveV2: {
    id: 'competitiveV2',
    collection: 'featured',
    labelKey: 'dsp.room.profile.competitiveV2',
    purposeKey: 'dsp.room.profilePurpose.competitiveV2',
    shape: featured(shape(3, 0.85, 1, 0, 0, [-30, 30, 0, -90, 90, -135, 135]), {
      fill: false,
      space: -60,
      tail: [0, 0.1, 10000],
    }),
  },
  liveVenueV2: {
    id: 'liveVenueV2',
    collection: 'featured',
    labelKey: 'dsp.room.profile.liveVenueV2',
    purposeKey: 'dsp.room.profilePurpose.liveVenueV2',
    shape: featured(
      shape(
        11,
        0.3,
        2.4,
        0,
        -1,
        [-28, 28, 0, -100, 100, -140, 140],
        [0, 0, 0, -2, -2, -3, -3],
      ),
      { fill: 0.55, space: -4, tail: [0.6, 1.2, 4500] },
    ),
  },
} satisfies Record<TRoomFeaturedId, IRoomPreset>;

/** The featured rooms, in the order the browser shows them. */
export const ROOM_FEATURED_LIST: readonly IRoomPreset[] =
  Object.values(ROOM_FEATURED_BY_ID);

/** The classic rooms in their menu's order: by group, then as written. */
export const ROOM_CLASSIC_LIST: readonly IRoomPreset[] =
  ROOM_PRESET_GROUPS.flatMap((group) =>
    Object.values(ROOM_CLASSIC_BY_ID).filter(
      (preset) => preset.group === group,
    ),
  );

/** Every built-in room, featured first: what previous and next walk. */
export const ROOM_PRESET_LIST: readonly IRoomPreset[] = [
  ...ROOM_FEATURED_LIST,
  ...ROOM_CLASSIC_LIST,
];

const ROOM_PRESET_BY_ID: Record<TRoomPresetId, IRoomPreset> = {
  ...ROOM_CLASSIC_BY_ID,
  ...ROOM_FEATURED_BY_ID,
};

/** The shape of each room, by id, for whoever needs numbers and not names. */
export const ROOM_PRESET_SHAPES: Record<TRoomPresetId, TRoomShape> =
  Object.fromEntries(
    ROOM_PRESET_LIST.map((preset) => [preset.id, preset.shape]),
  ) as Record<TRoomPresetId, TRoomShape>;

export const isRoomPresetId = (id: string): id is TRoomPresetId =>
  Object.prototype.hasOwnProperty.call(ROOM_PRESET_BY_ID, id);

/** The built-in room of that name, or nothing for `custom` and saved rooms. */
export const roomPresetOf = (id: string): IRoomPreset | undefined =>
  isRoomPresetId(id) ? ROOM_PRESET_BY_ID[id] : undefined;

/** The shape a room stands in, out of all it holds; copies, not references. */
export const roomShapeOf = (room: IRoomSettings): TRoomShape => ({
  sizeM: room.sizeM,
  walls: room.walls,
  distanceM: room.distanceM,
  centreDb: room.centreDb,
  subDb: room.subDb,
  angles: [...room.angles],
  levels: [...room.levels],
  distances: [...room.distances],
  mutes: [...room.mutes],
  bassManagement: room.bassManagement,
  crossoverHz: room.crossoverHz,
  musicUpmix: room.musicUpmix,
  upmixAmount: room.upmixAmount,
  rendererVersion: room.rendererVersion,
  earlyReflectionDb: room.earlyReflectionDb,
  ambienceMix: room.ambienceMix,
  ambienceDecayS: room.ambienceDecayS,
  ambienceDampingHz: room.ambienceDampingHz,
  preservePosition: room.preservePosition,
});

/**
 * The Room card's Reset: every option back to how the card first opens — the
 * living room, every speaker on its ring at its level and playing, and the
 * listener's own choices too: the head, the headphone switch, bass
 * management and its crossover, the front stage and its amount. Only the
 * power switch stays as it is: Reset is asked of a room that is on, and
 * switching it off would be the one thing on the card nobody asked for.
 */
export const resetRoom = (current: IRoomSettings): IRoomSettings => ({
  ...DSP_DEFAULTS.room,
  angles: [...DSP_DEFAULTS.room.angles],
  levels: [...DSP_DEFAULTS.room.levels],
  distances: [...DSP_DEFAULTS.room.distances],
  mutes: [...DSP_DEFAULTS.room.mutes],
  enabled: current.enabled,
});

/**
 * `current` standing in `shape`: a preset's room or a saved one — all of
 * it, so a mute, a solo or "fill the room" goes with the room it was made
 * in. Only the head, the headphone switch, the power switch and the two
 * choices about the source are `current`'s still.
 */
export const roomInShape = (
  current: IRoomSettings,
  shape: TRoomShape,
  presetId: TRoomPreset,
): IRoomSettings => ({
  ...current,
  ...shape,
  angles: [...shape.angles],
  levels: [...shape.levels],
  distances: [...shape.distances],
  mutes: [...shape.mutes],
  presetId,
});

/** `current` with the preset's room, and its name on it. */
export const roomPresetSettings = (
  current: IRoomSettings,
  id: TRoomPresetId,
): IRoomSettings => roomInShape(current, ROOM_PRESET_SHAPES[id], id);

/**
 * A classic room moved to the second renderer, asked for and never assumed:
 * the same room and speakers, the walls as loud as the first renderer plays
 * them (0 dB), no tail, the speakers' positions kept. It is no longer the
 * preset it came from — the speakers now stand between the head's measured
 * directions instead of on the nearest one, which is a different sound.
 */
export const roomOnNewRenderer = (current: IRoomSettings): IRoomSettings => ({
  ...current,
  rendererVersion: 2,
  earlyReflectionDb: 0,
  ambienceMix: 0,
  preservePosition: true,
  presetId: 'custom',
});
