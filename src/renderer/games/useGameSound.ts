/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the window shows of the game profiles: the list, the program in
 * front, and the game whose sound is on.
 *
 * The sound a game puts on is the app's core's to switch (`main/gameSound.ts`):
 * a game comes to the front while FluidEQ is behind it, minimised or closed,
 * and the core is what is there. The window is told what the core did, and
 * keeps the list it hands the core (`CoreCopies`).
 */

import { useEffect, useState } from 'react';
import { IGameProfile, IGameProgram, gameProfileFor } from '../../common/games';
import { useDspSettings } from '../dsp/store';
import { activeDspPresetId } from '../dsp/dspPresetCatalog';
import { useFluidEqLayers } from '../utils/FluidEqContext';
import {
  GAME_PROFILES_CHANGED,
  readGameProfiles,
  readGamesEnabled,
} from './gameProfiles';
import { requestGameWatch } from './gameWatchRequest';

export const GAME_FOREGROUND_CHANNEL = 'game-foreground';
export const GAME_SOUNDING_CHANNEL = 'game-sounding';

interface IGameSoundingBridge {
  askGameSounding?: () => void;
}

/** The game whose sound the core has on, and the chain it put on. */
interface ISounding {
  gameId: string;
  presetId: string;
}

/**
 * What the core last said, shared by every caller: the Games page and the
 * bar at the foot of the window both show it. Heard once for the window,
 * from the first caller on.
 */
const GAME_SOUNDING_CHANGED = 'fluideq-game-sounding-changed';
let sounding: ISounding | undefined;
let isFollowing = false;

const isSounding = (value: unknown): value is ISounding =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ISounding).gameId === 'string' &&
  typeof (value as ISounding).presetId === 'string';

const followSounding = (): void => {
  const bridge = window.electron?.ipcRenderer;
  if (isFollowing || !bridge?.on) {
    return;
  }
  isFollowing = true;
  bridge.on(GAME_SOUNDING_CHANNEL, (payload) => {
    sounding = isSounding(payload) ? payload : undefined;
    window.dispatchEvent(new Event(GAME_SOUNDING_CHANGED));
  });
  (bridge as IGameSoundingBridge).askGameSounding?.();
};

/** For a test that starts from nothing, as a fresh window would. */
export const resetGameSounding = (): void => {
  sounding = undefined;
  isFollowing = false;
};

const useSounding = (): ISounding | undefined => {
  const [now, setNow] = useState(sounding);
  useEffect(() => {
    const changed = () => setNow(sounding);
    window.addEventListener(GAME_SOUNDING_CHANGED, changed);
    followSounding();
    changed();
    return () => window.removeEventListener(GAME_SOUNDING_CHANGED, changed);
  }, []);
  return now;
};

const isProgram = (value: unknown): value is IGameProgram =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IGameProgram).path === 'string' &&
  (value as IGameProgram).path !== '';

/** The page's switch for the whole feature, kept in step the same way. */
export const useGamesEnabled = (): boolean => {
  const [enabled, setEnabled] = useState(readGamesEnabled);
  useEffect(() => {
    const changed = () => setEnabled(readGamesEnabled());
    window.addEventListener(GAME_PROFILES_CHANGED, changed);
    changed();
    return () => window.removeEventListener(GAME_PROFILES_CHANGED, changed);
  }, []);
  return enabled;
};

/** The list, kept in step with every page that edits it. */
export const useGameProfiles = (): IGameProfile[] => {
  const [profiles, setProfiles] = useState<IGameProfile[]>(() =>
    readGameProfiles(),
  );
  useEffect(() => {
    const changed = () => setProfiles(readGameProfiles());
    window.addEventListener(GAME_PROFILES_CHANGED, changed);
    window.addEventListener('storage', changed);
    return () => {
      window.removeEventListener(GAME_PROFILES_CHANGED, changed);
      window.removeEventListener('storage', changed);
    };
  }, []);
  return profiles;
};

/**
 * The game whose sound is on, for anything outside the Games page that has
 * to say so — the bar at the foot of the window, which speaks for the
 * machine's own sound and had nothing to say about a game, because a game
 * registers no player with Windows the way Spotify and a browser do.
 *
 * Only while the chain playing is still the one that game put on: a chain
 * the listener picked afterwards is theirs.
 */
export const useSoundingGame = (): IGameProfile | undefined => {
  const profiles = useGameProfiles();
  const now = useSounding();
  const settings = useDspSettings();
  const { voicing } = useFluidEqLayers();
  const ours =
    now !== undefined &&
    now.presetId === (activeDspPresetId(settings, voicing) ?? '');
  return ours
    ? profiles.find((profile) => profile.id === now.gameId)
    : undefined;
};

export interface IGameSound {
  profiles: IGameProfile[];
  /** The profile whose game is in front, while one is. */
  playing?: IGameProfile;
  /** The profile whose sound is on, which outlasts its game being in front. */
  sounding?: IGameProfile;
  /** Whether the page's switch has game presets running at all. */
  enabled: boolean;
  /** The program in front, whether or not it has a profile. */
  front?: IGameProgram;
}

/**
 * The Games page's view: what is in front, watched while the page is open
 * so the line at its top can say so while a profile is being made for it.
 * The core watches for its own profiles whether or not the page is open.
 */
export const useGameSound = (): IGameSound => {
  const profiles = useGameProfiles();
  const enabled = useGamesEnabled();
  const sounding = useSoundingGame();
  const [front, setFront] = useState<IGameProgram | undefined>(undefined);

  // Switched off, nothing is watched for the page either.
  useEffect(() => (enabled ? requestGameWatch() : undefined), [enabled]);
  useEffect(() => {
    if (!enabled) {
      setFront(undefined);
    }
  }, [enabled]);

  useEffect(() => {
    const listen = window.electron?.ipcRenderer?.on;
    if (!listen) {
      return undefined;
    }
    const off = listen(GAME_FOREGROUND_CHANNEL, (...args: unknown[]) => {
      const [program] = args;
      // A front reported just before the watcher stopped is still news
      // from a feature that is now off.
      if (isProgram(program) && readGamesEnabled()) {
        setFront(program);
      }
    });
    return () => {
      off();
    };
  }, []);

  return {
    profiles,
    enabled,
    front,
    playing: front ? gameProfileFor(profiles, front.path) : undefined,
    sounding,
  };
};
