/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { TranslationKey } from '../../common/i18n/en';

/** A speaker of the ring by its index, or the sub, which stands on none. */
export type TRoomPick = number | 'sub';

/** FL FR C SL SR RL RR, the order of every per-speaker array. */
export const ROOM_SPEAKER_CODES = ['FL', 'FR', 'C', 'SL', 'SR', 'RL', 'RR'];

const NAME_KEYS: TranslationKey[] = [
  'dsp.room.speakerName.FL',
  'dsp.room.speakerName.FR',
  'dsp.room.speakerName.C',
  'dsp.room.speakerName.SL',
  'dsp.room.speakerName.SR',
  'dsp.room.speakerName.RL',
  'dsp.room.speakerName.RR',
];

export const roomSpeakerCode = (which: TRoomPick): string =>
  which === 'sub' ? 'SUB' : ROOM_SPEAKER_CODES[which];

export const roomSpeakerNameKey = (which: TRoomPick): TranslationKey =>
  which === 'sub' ? 'dsp.room.speakerName.sub' : NAME_KEYS[which];

/** The order the arrow keys walk: round the ring, then the sub. */
export const ROOM_PICKS: readonly TRoomPick[] = [0, 1, 2, 3, 4, 5, 6, 'sub'];
