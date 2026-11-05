/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A game's own sound, kept as a profile of its own on each output, and the
 * output's own profile put back when the game is over (Ivan, 2026-11-02).
 *
 * The copy is a profile file in the output's folder under a hidden name, so
 * it is played, flushed and saved by every path that already plays, flushes
 * and saves a profile. An edit made while the game's sound is on lands in the
 * game's copy because that copy is the profile attached, and nothing that
 * keeps a sound had to learn a second kind of sound. What has to be kept
 * beside it is the profile the output had before (`IGameLoan`), so the music
 * sound comes back exactly when the game ends.
 */

import { createHash, randomUUID } from 'crypto';
import fs from 'fs';
import path from 'path';
import log from 'electron-log';
import { AUTOMATIC_PRESET_PREFIX } from '../common/constants';
import type { IDeviceProfileSettings } from '../common/constants';
import type { IPresetV2 } from '../common/profileTypes';
import {
  gamingProfileName,
  IYoursGamingProfile,
  IYoursSoundSummary,
  TGameSeed,
} from '../common/gaming';
import { clampDspSettings } from '../common/dsp/chain';
import { gameCurveVoicing } from '../common/dsp/gameCurves';
import {
  dspPresetVoicing,
  dspVoicingPresetId,
} from '../common/dsp/presetVoicing';
import { scheduleWrite } from './asyncWriter';
import neutralProfileSound from './neutralProfileSound';

/**
 * Hidden like the automatic profiles, by the same prefix, so no profile list
 * ever shows a game's copy as one of the listener's profiles.
 */
const GAME_COPY_PREFIX = `${AUTOMATIC_PRESET_PREFIX}game-`;

export const gameCopyName = (gameId: string): string =>
  `${GAME_COPY_PREFIX}${createHash('sha1')
    .update(gameId)
    .digest('hex')
    .slice(0, 12)}`;

export const isGameCopyName = (presetName: string): boolean =>
  presetName.startsWith(GAME_COPY_PREFIX);

/**
 * The copy as it was made, beside it: what "tuned" is measured from
 * (`gameSoundParts.ts`). Hidden by the same prefix, never attached.
 */
export const gameOriginName = (gameId: string): string =>
  `${gameCopyName(gameId)}-origin`;

/** Which game an output is lending its sound to, and what to give back. */
export interface IGameLoan {
  gameId: string;
  /** The profile the output had before the game: the music sound. */
  musicPresetName: string;
}

const LOANS_FILE = 'game-sound.json';
const PROFILES_DIR = 'gaming-profiles';

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLoan = (value: unknown): value is IGameLoan =>
  isObject(value) &&
  typeof value.gameId === 'string' &&
  value.gameId !== '' &&
  typeof value.musicPresetName === 'string' &&
  value.musicPresetName !== '';

/**
 * The loans, kept on disk.
 *
 * On disk because a game's sound outlives nothing but the window: quitting,
 * a crash or a power cut mid-game leaves the output attached to the game's
 * copy, and the next launch must know which profile was the listener's own
 * to give it back (`returnGameLoans`).
 */
export const createGameLoans = (userDataDir: string) => {
  const filePath = path.join(userDataDir, LOANS_FILE);
  const loans = new Map<string, IGameLoan>();
  try {
    const parsed: unknown = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const stored = isObject(parsed) ? parsed.loans : undefined;
    if (isObject(stored)) {
      Object.entries(stored).forEach(([deviceId, loan]) => {
        if (isLoan(loan)) {
          loans.set(deviceId, {
            gameId: loan.gameId,
            musicPresetName: loan.musicPresetName,
          });
        }
      });
    }
  } catch (error) {
    // Nothing kept yet is the normal first run; anything else is a file
    // somebody can still read, so say what went wrong with it.
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      log.warn('Could not read the games’ sound loans', error);
    }
  }
  const persist = (): Promise<void> =>
    scheduleWrite(
      filePath,
      JSON.stringify({ loans: Object.fromEntries(loans) }, null, 2),
    );
  return {
    get: (deviceId: string): IGameLoan | undefined => loans.get(deviceId),
    entries: (): [string, IGameLoan][] => [...loans.entries()],
    set: (deviceId: string, loan: IGameLoan): Promise<void> => {
      loans.set(deviceId, loan);
      return persist();
    },
    remove: (deviceId: string): Promise<void> => {
      if (!loans.delete(deviceId)) {
        return Promise.resolve();
      }
      return persist();
    },
  };
};

export type TGameLoans = ReturnType<typeof createGameLoans>;

/**
 * Every output lent to a game gets its own profile back, before anything is
 * played. Run once at launch: whatever game was being played is no longer
 * known to be, and one that still is comes back to the front and is lent
 * again. Returns whether any assignment changed, so the caller saves them.
 */
export const returnGameLoans = (
  loans: TGameLoans,
  settings: IDeviceProfileSettings,
): boolean => {
  let changed = false;
  loans.entries().forEach(([deviceId, loan]) => {
    const assignment = settings.assignments[deviceId];
    if (assignment && isGameCopyName(assignment.presetName)) {
      assignment.presetName = loan.musicPresetName;
      changed = true;
    }
    loans.remove(deviceId).catch((error) => {
      log.error('Could not forget a game’s sound loan', error);
    });
  });
  return changed;
};

/**
 * A game's sound with Game mode on, as every one plays (Ivan, 2026-11-03:
 * "any game lab preset need to turn gaming on for low lag"). A copy is made
 * with it and gets it back each time it is loaded (`ipc/gameSound.ts`), so
 * a game switched to Game mode off by hand plays with low lag again the
 * next time it comes to the front.
 */
export const withGameMode = (sound: IPresetV2): IPresetV2 => ({
  ...sound,
  dsp: clampDspSettings({ ...(sound.dsp ?? {}), gameMode: true }),
});

/** Whether a game's sound already plays with Game mode on. */
export const hasGameMode = (sound: IPresetV2): boolean =>
  sound.dsp?.gameMode === true;

/**
 * A game's copy as its Gaming profile makes it: the first one, and again on
 * Reset to the profile.
 *
 * One of the listener's own is its whole saved sound. A ready-made one is a
 * new profile's sound (`neutralProfileSound`) with the profile's rack and
 * its own game curve on the Preset layer, named after it ("Competitive",
 * `gameCurves.ts`) — an old row's chain, the chain's own curve, as picking
 * the chain puts it there. Nothing comes from the music: the copy used to
 * take the output's
 * EQ, Tone and curves, so resetting a game put the music's tuning into it
 * (Ivan, 2026-11-03). Only Auto normalize is carried over, a switch the
 * listener keeps rather than a part of any sound. Either way Game mode is
 * on (`withGameMode`).
 */
export const gameCopyFromSeed = (
  music: IPresetV2,
  seed: TGameSeed,
  yours: IPresetV2 | undefined,
): IPresetV2 | undefined => {
  if (seed.kind === 'yours') {
    return yours ? withGameMode(yours) : undefined;
  }
  const dsp = clampDspSettings(seed.dsp);
  const chainCurve = seed.curve
    ? dspPresetVoicing(dsp.presetId, seed.curve)
    : undefined;
  return withGameMode({
    ...neutralProfileSound(),
    isAutoPreAmpOn: music.isAutoPreAmpOn,
    dsp,
    voicing: seed.gameCurve ? gameCurveVoicing(seed.gameCurve) : chainCurve,
  });
};

/** One of the listener's own Gaming profiles, with its whole sound. */
interface IYoursFile extends IYoursGamingProfile {
  sound: IPresetV2;
}

const SAFE_ID = /^[a-f0-9-]{8,64}$/;

/**
 * What a saved sound plays, for its card: its curve, its chain and the Game
 * filter's dials while the filter is on (`IYoursSoundSummary`).
 */
export const yoursSummary = (sound: IPresetV2): IYoursSoundSummary => {
  const dsp = clampDspSettings(sound.dsp);
  const curveId = dspVoicingPresetId(sound.voicing);
  const { enabled, lift, voices, environment } = dsp.footsteps;
  return {
    ...(curveId ? { curveId } : {}),
    ...(dsp.presetId ? { chainId: dsp.presetId } : {}),
    ...(enabled ? { footsteps: { lift, voices, environment } } : {}),
  };
};

const isYoursFile = (value: unknown): value is IYoursFile =>
  isObject(value) &&
  typeof value.id === 'string' &&
  SAFE_ID.test(value.id) &&
  typeof value.name === 'string' &&
  typeof value.from === 'string' &&
  typeof value.savedAt === 'number' &&
  isObject(value.sound);

/**
 * The listener's own Gaming profiles: one file each, sound and name, in a
 * folder of their own under the app's data — apart from every output's
 * profiles, because a Gaming profile is a starting point for any output.
 */
export const createYoursGamingProfiles = (userDataDir: string) => {
  const dir = path.join(userDataDir, PROFILES_DIR);
  const fileOf = (id: string): string => {
    if (!SAFE_ID.test(id)) {
      throw new Error(`Not a Gaming profile id: ${id}`);
    }
    return path.join(dir, `${id}.json`);
  };
  const readFile = (id: string): IYoursFile | undefined => {
    try {
      const parsed: unknown = JSON.parse(fs.readFileSync(fileOf(id), 'utf8'));
      return isYoursFile(parsed) && parsed.id === id ? parsed : undefined;
    } catch (error) {
      log.warn('Could not read a Gaming profile', id, error);
      return undefined;
    }
  };
  const write = (file: IYoursFile): Promise<void> => {
    fs.mkdirSync(dir, { recursive: true });
    return scheduleWrite(fileOf(file.id), JSON.stringify(file, null, 2));
  };
  const list = (): IYoursGamingProfile[] => {
    let names: string[];
    try {
      names = fs.readdirSync(dir);
    } catch {
      return [];
    }
    return names
      .filter((name) => name.endsWith('.json'))
      .map((name) => readFile(name.slice(0, -'.json'.length)))
      .filter((file): file is IYoursFile => file !== undefined)
      .map(({ id, name, from, savedAt, sound }) => ({
        id,
        name,
        from,
        savedAt,
        summary: yoursSummary(sound),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  };
  return {
    list,
    sound: (id: string): IPresetV2 | undefined => readFile(id)?.sound,
    save: async (
      name: string,
      from: string,
      sound: IPresetV2,
    ): Promise<IYoursGamingProfile> => {
      const kept = gamingProfileName(name);
      if (!kept) {
        throw new Error('A Gaming profile needs a name.');
      }
      const file: IYoursFile = {
        id: randomUUID(),
        name: kept,
        from: from.slice(0, 200),
        savedAt: Date.now(),
        sound,
      };
      await write(file);
      return {
        id: file.id,
        name: file.name,
        from: file.from,
        savedAt: file.savedAt,
      };
    },
    update: async (id: string, sound: IPresetV2): Promise<void> => {
      const file = readFile(id);
      if (!file) {
        throw new Error('That Gaming profile is gone.');
      }
      await write({ ...file, sound, savedAt: Date.now() });
    },
    rename: async (id: string, name: string): Promise<void> => {
      const file = readFile(id);
      const kept = gamingProfileName(name);
      if (!file || !kept) {
        throw new Error('That Gaming profile cannot take that name.');
      }
      await write({ ...file, name: kept });
    },
    remove: (id: string): void => {
      fs.rmSync(fileOf(id), { force: true });
    },
  };
};

export type TYoursGamingProfiles = ReturnType<typeof createYoursGamingProfiles>;
