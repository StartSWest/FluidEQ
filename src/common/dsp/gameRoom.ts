/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IRoomSettings } from './chainSettings';
import type { IFootstepsSettings } from './footsteps';
import {
  footstepsSettingsOf,
  IFootstepsPreset,
  keepsRoomOff,
} from './footstepsPresets';
import { roomPresetSettings } from './roomPresets';

export interface IGameRack {
  footsteps: IFootstepsSettings;
  room: IRoomSettings;
}

/**
 * A game picked on the Game filter, and what it does to the Room.
 *
 * A game with its own 3D sound switches the Room off: a second head around
 * the one the game already put there brings a step from two places (and
 * Alien: Isolation is more frightening without it — Ivan, 2026-11-01). A kind
 * of game leaves the Room as the chain set it. A game without one stands in
 * the room it is best in, switched on only for a listener who wears
 * headphones: the Room is wrong on speakers, and the app cannot tell the two
 * apart. The listener says so by having the Room on — switched on on its own
 * page, or by a Gaming chain's Room copy — and while a game holds it off
 * the word is kept on the filter (`useRoom`), so the next game without 3D
 * sound puts it back. For anybody else the Room is left as it is.
 * The head and everything else that is the listener's stay as they were
 * (`roomPresetSettings`).
 */
export const pickGame = (
  current: IGameRack,
  preset: IFootstepsPreset,
  enable: boolean,
): IGameRack => {
  const onHeadphones = current.footsteps.useRoom || current.room.enabled;
  const on = enable || current.footsteps.enabled;
  if (preset.room === 'keep') {
    return {
      footsteps: footstepsSettingsOf(preset, on, current.footsteps),
      room: current.room,
    };
  }
  if (keepsRoomOff(preset.room)) {
    // Held off by the game, so the word is kept for the next one.
    return {
      footsteps: footstepsSettingsOf(preset, on, { useRoom: onHeadphones }),
      room: { ...current.room, enabled: false },
    };
  }
  // From here the Room's own switch carries the word: somebody who switches
  // it off after this has said they no longer want it, and the next game
  // must not bring it back.
  const footsteps = footstepsSettingsOf(preset, on, { useRoom: false });
  // Somebody who has not said they wear headphones keeps the room they
  // have, shaped as they left it, as a chain without the Room leaves it
  // (`chainRoom`).
  if (!onHeadphones) {
    return { footsteps, room: current.room };
  }
  return {
    footsteps,
    room: { ...roomPresetSettings(current.room, preset.room), enabled: true },
  };
};
