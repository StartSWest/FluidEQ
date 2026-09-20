/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The sound following the game in front.
 *
 * Main says which program Windows put in front; this decides what that means
 * and selects the chain, through the same path the picker uses, so a switch
 * made by a game is a switch made by the app — Equalizer APO's layer
 * included. The rules themselves are `common/games.ts`, as values in and a
 * step out, so they are tested without a window or a game.
 *
 * It runs for the life of the window rather than the page: a profile matches
 * while somebody is playing, which is exactly when the Games page is not the
 * one on screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  IGameProfile,
  IGameProgram,
  IGameSoundMemory,
  gameProfileFor,
  gameSoundStep,
} from '../../common/games';
import {
  applyDspSettings,
  persistDspSettings,
  useDspSettings,
} from '../dsp/store';
import { useDspPresetSelection } from '../dsp/useDspPresetSelection';
import { GAME_PROFILES_CHANGED, readGameProfiles } from './gameProfiles';
import { requestGameWatch } from './gameWatchRequest';

export const GAME_FOREGROUND_CHANNEL = 'game-foreground';

const isProgram = (value: unknown): value is IGameProgram =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IGameProgram).path === 'string' &&
  (value as IGameProgram).path !== '';

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

/** A sound a game just put on, for the toast that says so. */
export interface IGameSwitch {
  /** New each time, so the same game twice is announced twice. */
  id: number;
  game: string;
  presetId: string;
  icon?: string;
}

export interface IGameSound {
  profiles: IGameProfile[];
  /** The last sound a game loaded, until whoever shows it says it is done. */
  switched?: IGameSwitch;
  forgetSwitch: () => void;
  /** The profile whose game is in front, while one is. */
  playing?: IGameProfile;
  /** The program in front, whether or not it has a profile. */
  front?: IGameProgram;
}

/**
 * The sound, and what is in front.
 *
 * `applies` belongs to exactly one caller — the window's own, which lives as
 * long as the window does, so a game switches the sound whatever page is
 * open and whether or not one is. The Games page asks for the same news
 * without it: two callers applying the same step would each remember half of
 * what the other did and put back the wrong chain.
 */
export const useGameSound = ({
  applies = false,
  always = false,
}: { applies?: boolean; always?: boolean } = {}): IGameSound => {
  const profiles = useGameProfiles();
  const settings = useDspSettings();
  const { apply } = useDspPresetSelection(
    settings,
    applyDspSettings,
    persistDspSettings,
    true,
  );
  const [front, setFront] = useState<IGameProgram | undefined>(undefined);
  const [switched, setSwitched] = useState<IGameSwitch | undefined>(undefined);
  const switches = useRef(0);
  const memory = useRef<IGameSoundMemory>({});
  // The pieces the foreground handler needs, read at the moment it fires: a
  // listener changes chains and profiles while a game runs, and a handler
  // holding a copy from when it subscribed would put back a chain from an
  // hour ago.
  const latest = useRef({ profiles, presetId: '', apply });
  latest.current = {
    profiles,
    presetId: settings.enabled ? settings.presetId : '',
    apply,
  };

  const wanted = always || profiles.length > 0;
  useEffect(() => (wanted ? requestGameWatch() : undefined), [wanted]);

  const heard = useCallback(
    (program: IGameProgram) => {
      setFront(program);
      if (!applies) {
        return;
      }
      const { profiles: known, presetId, apply: select } = latest.current;
      const profile = gameProfileFor(known, program.path);
      const step = gameSoundStep(memory.current, profile?.presetId, presetId);
      memory.current = step.memory;
      // Announced only on the way in. Coming back out is the sound the
      // listener already had, and a card for it is the app talking about
      // itself while somebody is trying to do something else.
      if (step.select !== undefined && profile && step.select !== '') {
        switches.current += 1;
        setSwitched({
          id: switches.current,
          game: profile.name,
          presetId: step.select,
          ...(profile.icon ? { icon: profile.icon } : {}),
        });
      }
      if (step.select !== undefined) {
        // Nothing here waits on the switch: the chain it selects is the app's
        // own, and a failure has already told the window in its own words.
        select(step.select === '' ? 'none' : step.select).catch(
          () => undefined,
        );
      }
    },
    [applies],
  );

  useEffect(() => {
    const listen = window.electron?.ipcRenderer?.on;
    if (!listen) {
      return undefined;
    }
    const off = listen(GAME_FOREGROUND_CHANNEL, (...args: unknown[]) => {
      const [program] = args;
      if (isProgram(program)) {
        heard(program);
      }
    });
    return () => {
      off();
    };
  }, [heard]);

  const forgetSwitch = useCallback(() => setSwitched(undefined), []);

  return {
    profiles,
    front,
    switched,
    forgetSwitch,
    playing: front ? gameProfileFor(profiles, front.path) : undefined,
  };
};
