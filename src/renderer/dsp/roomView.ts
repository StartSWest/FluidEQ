/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the Room card shows that is not a setting: which speakers the stream
 * playing right now reaches, and the two percentages its quick dials wear.
 *
 * Kept out of the components so each rule is said once and held by a test
 * that needs no window.
 */

import { TranslationKey } from '../../common/i18n/en';
import type { TRoomLive } from './useRoomLive';

const ALL = [true, true, true, true, true, true, true] as const;
const NONE = [false, false, false, false, false, false, false] as const;
const FRONT = [true, true, false, false, false, false, false] as const;
const FIVE = [true, true, true, true, true, false, false] as const;
const BUT_FRONT = [false, false, true, true, true, true, true] as const;

export interface IRoomFeed {
  /** FL FR C SL SR RL RR: whether what is playing reaches the speaker. */
  fed: readonly boolean[];
  /**
   * Fed by the stereo expansion, not by a channel of its own: the sound there
   * was worked out from the front pair, which the card says rather than
   * letting a filled ring read as a surround source.
   */
  derived: readonly boolean[];
  /**
   * Whether the stream has a subwoofer channel. Stereo has none, expanded or
   * not: bass management still sends the speakers' low end down the sub's
   * path, but the Sub's own level and mute act on a channel that is not there.
   */
  subFed: boolean;
  /** What is coming in and what the room makes of it, beside the tabs. */
  sourceKey: TranslationKey;
  /** A sentence about the speakers left out or worked out, where there is one. */
  noteKey?: TranslationKey;
}

/**
 * Only the states that leave speakers out, or make them up, say anything;
 * every other state lights all seven, because "nothing playing" is not "these
 * get nothing", and the engine not answering is not silence measured.
 */
export const roomFeedOf = (state: TRoomLive): IRoomFeed => {
  switch (state) {
    case 'front-stage':
      return {
        fed: FRONT,
        derived: NONE,
        subFed: false,
        sourceKey: 'dsp.room.live.frontStage',
        noteKey: 'dsp.room.fedFrontStage',
      };
    case 'music':
      return {
        fed: ALL,
        derived: BUT_FRONT,
        subFed: false,
        sourceKey: 'dsp.room.live.music',
        noteKey: 'dsp.room.fedExpanded',
      };
    case '5.1':
      return {
        fed: FIVE,
        derived: NONE,
        subFed: true,
        sourceKey: 'dsp.room.live.fiveOne',
        noteKey: 'dsp.room.fedFiveOne',
      };
    case '7.1':
      return {
        fed: ALL,
        derived: NONE,
        subFed: true,
        sourceKey: 'dsp.room.live.sevenOne',
      };
    case 'on':
      return {
        fed: ALL,
        derived: NONE,
        subFed: true,
        sourceKey: 'dsp.room.live.on',
      };
    case 'no-head':
      return {
        fed: ALL,
        derived: NONE,
        subFed: true,
        sourceKey: 'dsp.room.live.noHead',
      };
    case 'off':
      return {
        fed: ALL,
        derived: NONE,
        subFed: true,
        sourceKey: 'dsp.room.live.off',
      };
    case 'idle':
      return {
        fed: ALL,
        derived: NONE,
        subFed: true,
        sourceKey: 'dsp.room.live.idle',
      };
    default:
      return {
        fed: ALL,
        derived: NONE,
        subFed: true,
        sourceKey: 'dsp.room.live.unknown',
      };
  }
};

/** Whether the engine is rendering a stream through the room this second. */
export const isRoomPlaying = (state: TRoomLive): boolean =>
  state === 'front-stage' ||
  state === 'music' ||
  state === '5.1' ||
  state === '7.1' ||
  state === 'on';

/** The walls' level where Space leaves 0%: none at all, exactly. */
export const SPACE_OFF_DB = -60;
/** The walls' level at 1%: as quiet as Space goes while still on. */
const SPACE_FLOOR_DB = -36;

/**
 * Space, 0 to 100, for a stored level in dB. 0% is the exact off the engine
 * knows (-60 dB: no walls, and no tail, which is fed by them); 1% to 100%
 * runs -36 dB to 0 dB a third of a decibel a step. Anything stored between
 * off and the floor reads as 1%: on, and as quiet as the dial goes.
 */
export const spaceOfDb = (db: number): number => {
  if (db <= SPACE_OFF_DB) {
    return 0;
  }
  const percent = Math.round(
    ((db - SPACE_FLOOR_DB) / (0 - SPACE_FLOOR_DB)) * 100,
  );
  return Math.min(100, Math.max(1, percent));
};

/** The stored level for a Space percentage; the inverse of `spaceOfDb`. */
export const dbOfSpace = (percent: number): number => {
  const whole = Math.min(100, Math.max(0, Math.round(percent)));
  if (whole === 0) {
    return SPACE_OFF_DB;
  }
  const db = SPACE_FLOOR_DB + (whole / 100) * (0 - SPACE_FLOOR_DB);
  return Math.round(db * 100) / 100;
};
