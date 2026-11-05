/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Gaming Lab's requests to main: a game's own sound on and off the
 * playing output (`main/ipc/gameSound.ts`), and the listener's own Gaming
 * profiles.
 */

import ChannelEnum from '../../common/channels';
import { clampDspSettings } from '../../common/dsp/chain';
import type {
  IGameSoundState,
  IYoursGamingProfile,
  IYoursSoundSummary,
  TGameSeed,
} from '../../common/gaming';
import {
  sendRequest,
  setterResponseHandler,
  simpleResponseHandler,
} from './ipcRequest';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/*
 * Every answer is read for its shape here, where it arrives, whatever type
 * the reply is declared as, and anything else is the state nothing has
 * answered yet: an empty reply (an older main, a harness that does not know
 * the channel) was taken whole, and the hooks that read "which game is on"
 * took the window down to its error screen (10. DSP, 2026-11-03).
 */

const asGameSoundState = (value: unknown): IGameSoundState =>
  isObject(value)
    ? {
        gameId: typeof value.gameId === 'string' ? value.gameId : undefined,
        musicDsp: isObject(value.musicDsp)
          ? clampDspSettings(value.musicDsp)
          : undefined,
      }
    : {};

const asStrings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

const isYoursProfile = (value: unknown): value is IYoursGamingProfile =>
  isObject(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.from === 'string' &&
  typeof value.savedAt === 'number';

const isDial = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

/** What a saved profile plays, kept only as far as it is well formed. */
const asSummary = (value: unknown): IYoursSoundSummary | undefined => {
  if (!isObject(value)) {
    return undefined;
  }
  const { footsteps } = value;
  return {
    ...(typeof value.curveId === 'string' ? { curveId: value.curveId } : {}),
    ...(typeof value.chainId === 'string' ? { chainId: value.chainId } : {}),
    ...(isObject(footsteps) &&
    isDial(footsteps.lift) &&
    isDial(footsteps.voices) &&
    isDial(footsteps.environment)
      ? {
          footsteps: {
            lift: footsteps.lift,
            voices: footsteps.voices,
            environment: footsteps.environment,
          },
        }
      : {}),
  };
};

const asYoursProfile = (value: IYoursGamingProfile): IYoursGamingProfile => {
  const summary = asSummary(value.summary);
  return {
    id: value.id,
    name: value.name,
    from: value.from,
    savedAt: value.savedAt,
    ...(summary ? { summary } : {}),
  };
};

/** Which game's copy the playing output has on; none for any other answer. */
export const readGameSoundState = (): Promise<IGameSoundState> =>
  sendRequest(
    ChannelEnum.GAME_SOUND_STATE,
    [],
    simpleResponseHandler<IGameSoundState>(),
  ).then(asGameSoundState);

/** The parts of a game's copy on this output tuned away from its profile. */
export const readGameTuned = (gameId: string): Promise<string[]> =>
  sendRequest(
    ChannelEnum.GAME_SOUND_TUNED,
    [gameId],
    simpleResponseHandler<string[]>(),
  ).then(asStrings);

/**
 * The game's copy on the playing output, made from `seed` the first time
 * this output plays it. The window reads every layer again when main says
 * the output's sound changed, as for an output switch.
 */
export const loadGameSound = (gameId: string, seed: TGameSeed): Promise<void> =>
  sendRequest(
    ChannelEnum.GAME_SOUND_LOAD,
    [gameId, seed],
    setterResponseHandler,
  );

/** The music sound back on every output a game borrowed. */
export const unloadGameSound = (): Promise<void> =>
  sendRequest(ChannelEnum.GAME_SOUND_UNLOAD, [], setterResponseHandler);

/** The game's copy on this output made again from its profile. */
export const resetGameSound = (
  gameId: string,
  seed: TGameSeed,
): Promise<void> =>
  sendRequest(
    ChannelEnum.GAME_SOUND_RESET,
    [gameId, seed],
    setterResponseHandler,
  );

/** Every output's copy of a game, gone with the game. */
export const deleteGameSound = (gameId: string): Promise<void> =>
  sendRequest(ChannelEnum.GAME_SOUND_DELETE, [gameId], setterResponseHandler);

export const readGamingProfiles = (): Promise<IYoursGamingProfile[]> =>
  sendRequest(
    ChannelEnum.GAMING_PROFILES,
    [],
    simpleResponseHandler<IYoursGamingProfile[]>(),
  ).then((value: unknown) =>
    Array.isArray(value)
      ? value.filter(isYoursProfile).map(asYoursProfile)
      : [],
  );

/** A game's copy kept as one of the listener's own Gaming profiles. */
export const saveGamingProfile = (
  gameId: string,
  name: string,
  from: string,
): Promise<IYoursGamingProfile> =>
  sendRequest(
    ChannelEnum.GAMING_PROFILE_SAVE,
    [gameId, name, from],
    simpleResponseHandler<IYoursGamingProfile>(),
  );

/** One of the listener's own profiles takes a game's copy as it sounds now. */
export const updateGamingProfile = (
  profileId: string,
  gameId: string,
): Promise<boolean> =>
  sendRequest(
    ChannelEnum.GAMING_PROFILE_UPDATE,
    [profileId, gameId],
    simpleResponseHandler<boolean>(),
  );

export const renameGamingProfile = (
  profileId: string,
  name: string,
): Promise<boolean> =>
  sendRequest(
    ChannelEnum.GAMING_PROFILE_RENAME,
    [profileId, name],
    simpleResponseHandler<boolean>(),
  );

export const deleteGamingProfile = (profileId: string): Promise<boolean> =>
  sendRequest(
    ChannelEnum.GAMING_PROFILE_DELETE,
    [profileId],
    simpleResponseHandler<boolean>(),
  );
