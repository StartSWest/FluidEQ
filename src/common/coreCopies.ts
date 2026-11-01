/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { parseUserDspPresets, type IUserDspPreset } from './dsp/userPresets';
import { parseGameProfiles, type IGameProfile } from './games';

/*
 * What the window keeps and the app's core needs to read: the game profiles
 * and the saved chains. The window is where they are made and changed; it
 * hands each list over whole, at launch and on every change
 * (`coreCopyChannels.ts`), and the core keeps its own copy, so a game's sound
 * can be put on with the window minimised or not open at all.
 */

/** More than anybody makes; bounds what one message can make the core keep. */
export const MAX_COPIED_ENTRIES = 500;

export interface IKeptGames {
  /** The Games page's switch: off, no game reaches the sound. */
  enabled: boolean;
  profiles: IGameProfile[];
}

export const NO_KEPT_GAMES: IKeptGames = { enabled: true, profiles: [] };

export const parseKeptGames = (raw: unknown): IKeptGames => {
  if (typeof raw !== 'object' || raw === null) {
    return NO_KEPT_GAMES;
  }
  const { enabled, profiles } = raw as Record<string, unknown>;
  return {
    enabled: enabled !== false,
    profiles: parseGameProfiles(profiles).slice(0, MAX_COPIED_ENTRIES),
  };
};

export const parseKeptDspPresets = (raw: unknown): IUserDspPreset[] =>
  parseUserDspPresets(raw).slice(0, MAX_COPIED_ENTRIES);
