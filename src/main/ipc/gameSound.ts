/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import ChannelEnum from '../../common/channels';
import type {
  IDeviceProfileSettings,
  IPresetV2,
  IState,
} from '../../common/constants';
import { ErrorCode } from '../../common/errors';
import { clampDspSettings } from '../../common/dsp/chain';
import type {
  IGameSoundState,
  IYoursGamingProfile,
  TGameSeed,
} from '../../common/gaming';
import type { TSuccess } from '../../renderer/utils/equalizerApi';
import { saveDeviceProfileSettings } from '../deviceProfileSettings';
import type { TPresetDirForDevice } from '../deviceProfiles';
import {
  deletePreset,
  doesPresetExist,
  fetchPreset,
  savePreset,
} from '../flush';
import {
  gameCopyFromSeed,
  gameCopyName,
  gameOriginName,
  hasGameMode,
  TGameLoans,
  TYoursGamingProfiles,
  withGameMode,
} from '../gameSound';
import { TGameSoundPart, tunedGameParts } from '../../common/gameSoundParts';
import type { IMainSession } from '../mainSession';
import putPresetInState from '../presetIntoState';
import { getAutomaticPresetName } from '../profileStore';
import { userMessageOf } from '../refusal';
import { ownPreset } from '../songSoundLoan';
import type { IReplySink } from './profiles';
import onWindowMessage from './windowMessages';
import { asGameId, asSeed } from './gameSoundValues';

export interface IGameSoundIpcDeps {
  state: IState;
  session: IMainSession;
  deviceProfileSettings: IDeviceProfileSettings;
  userDataDir: string;
  presetDirForDevice: TPresetDirForDevice;
  loans: TGameLoans;
  yours: TYoursGamingProfiles;
  runProfileMutation: (work: () => Promise<void>) => Promise<void>;
  attachPresetToActiveDevice: (presetName: string) => void;
  createEmptyProfileForActiveDevice: () => void;
  getCurrentPreset: () => IPresetV2;
  hydrateActiveConvolution: () => void;
  notifyOutputStateChanged: () => void;
  handleUpdate: (
    event: IReplySink,
    channel: ChannelEnum | string,
    syncActiveProfile?: boolean,
  ) => Promise<void>;
  handleError: (
    event: IReplySink,
    channel: ChannelEnum | string,
    errorCode: ErrorCode,
    message?: string,
  ) => void;
}

/**
 * A game's own sound on the output that plays, and the music sound back
 * when the game is over (`gameSound.ts`).
 *
 * Every handler here changes which profile an output plays, so each runs in
 * the same queue as the profile picker's (`runProfileMutation`): a game coming
 * to the front while the listener loads a profile must not interleave with it
 * and leave one output's sound attached as another's.
 */
export const registerGameSoundIpc = ({
  state,
  session,
  deviceProfileSettings,
  userDataDir,
  presetDirForDevice,
  loans,
  yours,
  runProfileMutation,
  attachPresetToActiveDevice,
  createEmptyProfileForActiveDevice,
  getCurrentPreset,
  hydrateActiveConvolution,
  notifyOutputStateChanged,
  handleUpdate,
  handleError,
}: IGameSoundIpcDeps) => {
  /** A profile file put on as the live sound and attached to the output. */
  const playProfile = async (
    event: IReplySink,
    channel: ChannelEnum,
    presetName: string,
    dir: string,
  ) => {
    putPresetInState(state, session, fetchPreset(presetName, dir));
    hydrateActiveConvolution();
    attachPresetToActiveDevice(presetName);
    await handleUpdate(event, channel, true);
    // The window holds its own copy of every layer and of the rack; it reads
    // them again exactly as it does when the output itself changes.
    notifyOutputStateChanged();
  };

  /**
   * The output's own sound as it stands, for a new copy to start from: the
   * profile the game borrowed from if a game's sound is on, or the live one.
   */
  const musicSound = (deviceId: string, dir: string): IPresetV2 => {
    const loan = loans.get(deviceId);
    return loan
      ? fetchPreset(loan.musicPresetName, dir)
      : ownPreset(getCurrentPreset(), state);
  };

  /** The game's copy on this output, as it sounds now. */
  const copySound = (gameId: string, dir: string): IPresetV2 | undefined => {
    const copy = gameCopyName(gameId);
    const deviceId = session.activeAudioDeviceId;
    if (deviceProfileSettings.assignments[deviceId]?.presetName === copy) {
      return ownPreset(getCurrentPreset(), state);
    }
    return doesPresetExist(copy, dir) ? fetchPreset(copy, dir) : undefined;
  };

  /**
   * Every output that lent its sound to a game has its own back, and the
   * answer goes to the window. The output being edited takes it live; another
   * one (Windows moved the default mid-game) only has its profile attached
   * again, and is written by the flush the answer runs.
   *
   * A music profile deleted while the game played cannot come back. The
   * output being edited then starts an empty profile, as it does when its
   * attached profile is deleted; another output is left without one, which
   * plays it neutral until somebody lands on it (`followOutputs.ts`).
   */
  const returnAllAndAnswer = async (
    event: IReplySink,
    channel: ChannelEnum,
  ): Promise<void> => {
    const active = session.activeAudioDeviceId;
    let activeName: string | undefined;
    let activeLost = false;
    let changed = false;
    await Promise.all(
      loans.entries().map(async ([deviceId, loan]) => {
        const kept = doesPresetExist(
          loan.musicPresetName,
          presetDirForDevice(deviceId),
        );
        if (deviceId === active) {
          activeName = kept ? loan.musicPresetName : undefined;
          activeLost = !kept;
        } else if (deviceProfileSettings.assignments[deviceId]) {
          if (kept) {
            deviceProfileSettings.assignments[deviceId].presetName =
              loan.musicPresetName;
          } else {
            delete deviceProfileSettings.assignments[deviceId];
          }
          changed = true;
        }
        await loans.remove(deviceId);
      }),
    );
    if (changed) {
      await saveDeviceProfileSettings(deviceProfileSettings, userDataDir);
    }
    if (activeName !== undefined) {
      await playProfile(event, channel, activeName, presetDirForDevice(active));
      return;
    }
    if (activeLost) {
      createEmptyProfileForActiveDevice();
      session.outputEditGeneration = (session.outputEditGeneration ?? 0) + 1;
      await handleUpdate(event, channel, true);
      notifyOutputStateChanged();
      return;
    }
    await handleUpdate(event, channel, false);
  };

  const onGameMessage = (
    channel: ChannelEnum,
    work: (event: Electron.IpcMainEvent, args: unknown[]) => Promise<void>,
  ) => {
    onWindowMessage(channel, (event, arg) => {
      const args: unknown[] = Array.isArray(arg) ? arg : [];
      runProfileMutation(async () => {
        try {
          await work(event, args);
        } catch (error) {
          log.error(`Game sound: ${channel} failed`, error);
          handleError(event, channel, ErrorCode.FAILURE, userMessageOf(error));
        }
      }).catch(() => undefined);
    });
  };

  /**
   * A copy made, or made again, from its seed, with the copy-as-made beside
   * it for "tuned" to be measured from. False when the seed names one of the
   * listener's profiles that is gone.
   */
  const makeCopy = async (
    gameId: string,
    seed: TGameSeed,
    deviceId: string,
    dir: string,
    source: string,
  ): Promise<boolean> => {
    const made = gameCopyFromSeed(
      musicSound(deviceId, dir),
      seed,
      seed.kind === 'yours' ? yours.sound(seed.id) : undefined,
    );
    if (!made) {
      return false;
    }
    await Promise.all([
      savePreset(gameCopyName(gameId), made, dir, source),
      savePreset(gameOriginName(gameId), made, dir, source),
    ]);
    return true;
  };

  /**
   * The rack the music profile will bring back, for the DSP page to show as
   * paused. A profile that cannot be read shows none; the page still says
   * the game's sound is on.
   */
  const musicRackOf = (presetName: string) => {
    try {
      const { dsp } = fetchPreset(
        presetName,
        presetDirForDevice(session.activeAudioDeviceId),
      );
      return dsp ? clampDspSettings(dsp) : undefined;
    } catch (error) {
      log.warn(
        'Game sound: the waiting music profile could not be read',
        error,
      );
      return undefined;
    }
  };

  onWindowMessage(ChannelEnum.GAME_SOUND_STATE, (event) => {
    const loan = loans.get(session.activeAudioDeviceId);
    const reply: TSuccess<IGameSoundState> = {
      result: {
        gameId: loan?.gameId,
        musicDsp: loan ? musicRackOf(loan.musicPresetName) : undefined,
      },
    };
    event.reply(ChannelEnum.GAME_SOUND_STATE, reply);
  });

  onWindowMessage(ChannelEnum.GAME_SOUND_TUNED, (event, arg) => {
    const channel = ChannelEnum.GAME_SOUND_TUNED;
    const gameId = asGameId(Array.isArray(arg) ? arg[0] : undefined);
    const deviceId = session.activeAudioDeviceId;
    if (!gameId || !deviceId) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    const dir = presetDirForDevice(deviceId);
    const origin = gameOriginName(gameId);
    let tuned: TGameSoundPart[] = [];
    try {
      // The live sound while the copy plays: an edit changes the state the
      // moment it arrives and reaches the copy's file only when its write
      // lands, and the question is asked right behind the edit.
      const copy = copySound(gameId, dir);
      if (copy && doesPresetExist(origin, dir)) {
        tuned = tunedGameParts(copy, fetchPreset(origin, dir));
      }
    } catch (error) {
      log.warn('Game sound: could not compare a copy with its origin', error);
    }
    const reply: TSuccess<string[]> = { result: tuned };
    event.reply(channel, reply);
  });

  onGameMessage(
    ChannelEnum.GAME_SOUND_LOAD,
    async (event, [rawId, rawSeed]) => {
      const channel = ChannelEnum.GAME_SOUND_LOAD;
      const gameId = asGameId(rawId);
      const seed = asSeed(rawSeed);
      const deviceId = session.activeAudioDeviceId;
      if (!gameId || !seed || !deviceId) {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      const dir = presetDirForDevice(deviceId);
      const copy = gameCopyName(gameId);
      if (
        !doesPresetExist(copy, dir) &&
        !(await makeCopy(gameId, seed, deviceId, dir, 'game-copy'))
      ) {
        handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
        return;
      }
      // Every game plays with Game mode on: a copy made before that rule, or
      // switched off by hand last time, gets it back as it loads.
      const kept = fetchPreset(copy, dir);
      if (!hasGameMode(kept)) {
        await savePreset(copy, withGameMode(kept), dir, 'game-mode');
      }
      const loan = loans.get(deviceId);
      const attached = deviceProfileSettings.assignments[deviceId]?.presetName;
      if (loan?.gameId === gameId && attached === copy) {
        await handleUpdate(event, channel, false);
        return;
      }
      // The music profile is the one from before any game: a second game in a
      // row borrows from the same one the first did.
      let musicPresetName = loan?.musicPresetName ?? attached;
      if (!musicPresetName) {
        musicPresetName = getAutomaticPresetName(deviceId);
        await savePreset(
          musicPresetName,
          ownPreset(getCurrentPreset(), state),
          dir,
          'game-music',
        );
      }
      await loans.set(deviceId, { gameId, musicPresetName });
      await playProfile(event, channel, copy, dir);
    },
  );

  onGameMessage(ChannelEnum.GAME_SOUND_UNLOAD, async (event) => {
    await returnAllAndAnswer(event, ChannelEnum.GAME_SOUND_UNLOAD);
  });

  onGameMessage(
    ChannelEnum.GAME_SOUND_RESET,
    async (event, [rawId, rawSeed]) => {
      const channel = ChannelEnum.GAME_SOUND_RESET;
      const gameId = asGameId(rawId);
      const seed = asSeed(rawSeed);
      const deviceId = session.activeAudioDeviceId;
      if (!gameId || !seed || !deviceId) {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      const dir = presetDirForDevice(deviceId);
      const copy = gameCopyName(gameId);
      if (!(await makeCopy(gameId, seed, deviceId, dir, 'game-reset'))) {
        handleError(event, channel, ErrorCode.PRESET_FILE_ERROR);
        return;
      }
      if (deviceProfileSettings.assignments[deviceId]?.presetName === copy) {
        await playProfile(event, channel, copy, dir);
        return;
      }
      await handleUpdate(event, channel, false);
    },
  );

  onGameMessage(ChannelEnum.GAME_SOUND_DELETE, async (event, [rawId]) => {
    const channel = ChannelEnum.GAME_SOUND_DELETE;
    const gameId = asGameId(rawId);
    if (!gameId) {
      handleError(event, channel, ErrorCode.INVALID_PARAMETER);
      return;
    }
    // The copy's own sound is taken off first, while its file still exists to
    // be played from: a copy deleted under a playing output would leave the
    // output attached to nothing.
    if (loans.entries().some(([, loan]) => loan.gameId === gameId)) {
      await returnAllAndAnswer(event, channel);
    } else {
      await handleUpdate(event, channel, false);
    }
    // Every output keeps its own copy of a game; a game removed takes all of
    // them, from every output that has a folder.
    const names = [gameCopyName(gameId), gameOriginName(gameId)];
    const devices = new Set([
      session.activeAudioDeviceId,
      ...Object.keys(deviceProfileSettings.assignments),
    ]);
    const deletions = [...devices]
      .filter((deviceId) => deviceId !== '')
      .map((deviceId) => presetDirForDevice(deviceId))
      .flatMap((dir) =>
        names
          .filter((name) => doesPresetExist(name, dir))
          .map((name) =>
            deletePreset(name, dir).catch((error) => {
              log.error('Game sound: a copy could not be deleted', dir, error);
            }),
          ),
      );
    await Promise.all(deletions);
  });

  onWindowMessage(ChannelEnum.GAMING_PROFILES, (event) => {
    const reply: TSuccess<IYoursGamingProfile[]> = { result: yours.list() };
    event.reply(ChannelEnum.GAMING_PROFILES, reply);
  });

  onGameMessage(
    ChannelEnum.GAMING_PROFILE_SAVE,
    async (event, [rawId, name, from]) => {
      const channel = ChannelEnum.GAMING_PROFILE_SAVE;
      const gameId = asGameId(rawId);
      const dir = presetDirForDevice(session.activeAudioDeviceId);
      const sound = gameId ? copySound(gameId, dir) : undefined;
      if (
        !gameId ||
        !sound ||
        typeof name !== 'string' ||
        typeof from !== 'string'
      ) {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      const saved = await yours.save(name, from, sound);
      // The game now starts from the profile it was just saved as, so nothing
      // about its copy is "tuned" away from it any more.
      await savePreset(gameOriginName(gameId), sound, dir, 'game-saved');
      const reply: TSuccess<IYoursGamingProfile> = { result: saved };
      event.reply(channel, reply);
    },
  );

  onGameMessage(
    ChannelEnum.GAMING_PROFILE_UPDATE,
    async (event, [profileId, rawId]) => {
      const channel = ChannelEnum.GAMING_PROFILE_UPDATE;
      const gameId = asGameId(rawId);
      const dir = presetDirForDevice(session.activeAudioDeviceId);
      const sound = gameId ? copySound(gameId, dir) : undefined;
      if (!gameId || !sound || typeof profileId !== 'string') {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      await yours.update(profileId, sound);
      await savePreset(gameOriginName(gameId), sound, dir, 'game-saved');
      const reply: TSuccess<boolean> = { result: true };
      event.reply(channel, reply);
    },
  );

  onGameMessage(
    ChannelEnum.GAMING_PROFILE_RENAME,
    async (event, [profileId, name]) => {
      const channel = ChannelEnum.GAMING_PROFILE_RENAME;
      if (typeof profileId !== 'string' || typeof name !== 'string') {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      await yours.rename(profileId, name);
      const reply: TSuccess<boolean> = { result: true };
      event.reply(channel, reply);
    },
  );

  onGameMessage(
    ChannelEnum.GAMING_PROFILE_DELETE,
    async (event, [profileId]) => {
      const channel = ChannelEnum.GAMING_PROFILE_DELETE;
      if (typeof profileId !== 'string') {
        handleError(event, channel, ErrorCode.INVALID_PARAMETER);
        return;
      }
      yours.remove(profileId);
      const reply: TSuccess<boolean> = { result: true };
      event.reply(channel, reply);
    },
  );
};
