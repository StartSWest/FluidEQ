/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What a Room copy of a chain adds to that chain's EQ, so the copy keeps the
 * chain's tone and only gains the room. Ivan, 2026-09-19: "I want them to
 * have same highs as normal, just with the room like behavior".
 *
 * They did not. Two speakers in front reach each ear together in the bass,
 * where the head is no obstacle, and hardly at all in the treble, where it
 * is; and a record is mostly its middle, which both speakers carry. Measured
 * through the shipped head (`room_profiles_test.cpp`, a record two thirds
 * shared), a record leaves Music Space 3 dB louder than it came, with +2 to
 * +5 dB under 250 Hz, -6 dB at 1.6 kHz and -3 to -6 dB from 5 to 12 kHz: the
 * top 3.6 dB under the bottom. That is what real speakers do in a dead room
 * as well, and what nobody wants from a preset called "Music · Room" chosen
 * straight after "Music".
 *
 * The EQ stands in front of the Room and both are linear and the same on both
 * channels, so correcting before the Room is correcting after it. Five bands,
 * deliberately fewer decibels than the fault: the dip at 1.6 kHz and the one
 * at 8 kHz are the head telling front from back, and filling them flat would
 * take the place out of the sound to fix its tone. After them the same record
 * leaves within 0.7 dB of the level it came at, the top within 1.2 dB of
 * the bottom, and no third octave from 100 Hz to 10 kHz more than 3.9 dB
 * out, where 6.4 to 6.5 were (`a_room_copy_keeps_its_chains_tone`).
 *
 * Two sets, because a room that spreads a record round the ring adds
 * low-passed rears and thickens the bottom more than one that keeps it on the
 * front stage.
 *
 * This is the chains' answer. The Room switched on by hand in any other chain
 * is as dark as it ever was: the whole answer is a tone hold inside the
 * engine's second renderer, worked out from the speakers' own angles, and it
 * wants Ivan's ears on it before it ships.
 */

import { FilterTypeEnum } from '../constants';
import { IEqBandSettings, IEqSettings } from './chain';
import { ROOM_PRESET_SHAPES, TRoomPresetId } from './roomPresets';

const band = (
  type: FilterTypeEnum,
  frequency: number,
  gainDb: number,
  quality: number,
): IEqBandSettings => ({
  enabled: true,
  type,
  frequency,
  gainDb,
  quality,
  dynamic: false,
  thresholdDb: -24,
});

/** A room that fills the ring from a stereo record: Music Space, Cinema. */
const FILLED: readonly IEqBandSettings[] = [
  band(FilterTypeEnum.LSC, 250, -2.5, 0.7),
  band(FilterTypeEnum.LSC, 50, -2, 0.7),
  band(FilterTypeEnum.PK, 1500, 3.5, 1.2),
  band(FilterTypeEnum.PK, 3800, -1.5, 2),
  band(FilterTypeEnum.HSC, 5000, 3, 0.7),
];

/** A room that keeps it on the front stage: Game World, Competitive. */
const FRONT_STAGE: readonly IEqBandSettings[] = [
  band(FilterTypeEnum.LSC, 250, -1.5, 0.7),
  band(FilterTypeEnum.LSC, 50, -2.5, 0.7),
  band(FilterTypeEnum.PK, 1500, 4.5, 1.2),
  band(FilterTypeEnum.PK, 3900, -2, 2),
  band(FilterTypeEnum.HSC, 5000, 3, 0.7),
];

export const ROOM_TONE_SETS = { filled: FILLED, frontStage: FRONT_STAGE };

export type TRoomToneSet = keyof typeof ROOM_TONE_SETS;

/** Which of the two a room needs. */
export const roomToneSetOf = (room: TRoomPresetId): TRoomToneSet =>
  ROOM_PRESET_SHAPES[room].musicUpmix ? 'filled' : 'frontStage';

/**
 * `eq` with the room's correction after its own bands. The stage no longer
 * matches the catalogue profile it started from, so it stops claiming to.
 */
export const withRoomTone = (
  eq: IEqSettings,
  room: TRoomPresetId,
): IEqSettings => {
  const bands = [
    ...eq.bands,
    ...ROOM_TONE_SETS[roomToneSetOf(room)].map((one) => ({ ...one })),
  ];
  return {
    ...eq,
    enabled: true,
    presetId: '',
    bands,
    sourceBands: bands.map((one) => ({ ...one })),
  };
};
