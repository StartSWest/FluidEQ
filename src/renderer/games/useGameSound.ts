/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The sound a game puts on, and keeps until the game is over.
 *
 * Main says which program Windows put in front; this decides what that means
 * and selects the chain, through the same path the picker uses, so a switch
 * made by a game is a switch made by the app — Equalizer APO's layer
 * included. The rules themselves are `common/games.ts`, as values in and a
 * step out, so they are tested without a window or a game.
 *
 * A game's sound goes on when it comes forward and stays on until that
 * program ends. It used to go away the moment the game lost the front, and
 * alt-tabbing to a browser, to Discord or to FluidEQ itself — which happens
 * constantly while somebody plays — took the game's sound away mid-match.
 * What the app waits on is the game's own process: it asks main to hold it
 * (`holdGameProcess`) and is told when it ends, by Windows rather than by
 * anything timed.
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
  IGameSoundStep,
  gameProfileFor,
  gameSoundEndStep,
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
export const GAME_ENDED_CHANNEL = 'game-ended';

interface IGameHoldBridge {
  holdGameProcess?: (pid: number) => void;
}

/**
 * Which game's sound is on, and which chain it put on — shared by every
 * caller of this hook, the way the profiles themselves are.
 *
 * Only the window's own caller switches anything, so only it can say; the
 * Games page has to be able to read it, because under this rule a game's
 * sound is on for most of the time the page is being looked at — the page is
 * what somebody alt-tabbed to. The chain is kept beside the game so any
 * caller can see whether that sound is still the one playing.
 */
const GAME_SOUNDING_CHANGED = 'fluideq-game-sounding-changed';

let sounding: { gameId: string; presetId: string } | undefined;

const saySounding = (now: typeof sounding): void => {
  if (
    sounding?.gameId === now?.gameId &&
    sounding?.presetId === now?.presetId
  ) {
    return;
  }
  sounding = now;
  window.dispatchEvent(new Event(GAME_SOUNDING_CHANGED));
};

/** For a test that starts from nothing, as a fresh window would. */
export const resetGameSounding = (): void => {
  sounding = undefined;
};

const useSounding = (): typeof sounding => {
  const [now, setNow] = useState(sounding);
  useEffect(() => {
    const changed = () => setNow(sounding);
    window.addEventListener(GAME_SOUNDING_CHANGED, changed);
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
 * The game whose sound is on, for anything outside this hook that has to say
 * so — the bar at the foot of the window, which speaks for the machine's own
 * sound and had nothing to say about a game, because a game registers no
 * player with Windows the way Spotify and a browser do.
 */
export const useSoundingGame = (): IGameProfile | undefined => {
  const profiles = useGameProfiles();
  const now = useSounding();
  const settings = useDspSettings();
  const ours =
    now !== undefined &&
    now.presetId === (settings.enabled ? settings.presetId : '');
  return ours
    ? profiles.find((profile) => profile.id === now.gameId)
    : undefined;
};

/** A sound a game just put on — or took back off — for the card that says so. */
export interface IGameSwitch {
  /** New each time, so the same game twice is announced twice. */
  id: number;
  game: string;
  presetId: string;
  icon?: string;
  /**
   * Which of the two happened: the game's sound going on, or the sound from
   * before it coming back because the game has ended.
   *
   * Both are worth a card now. Only the way in used to be, because the way
   * out was every alt-tab — a card each time somebody looked at their
   * browser. The way out is the game closing, once.
   */
  kind: 'loaded' | 'restored';
}

export interface IGameSound {
  profiles: IGameProfile[];
  /** The last sound a game loaded, until whoever shows it says it is done. */
  switched?: IGameSwitch;
  forgetSwitch: () => void;
  /** The profile whose game is in front, while one is. */
  playing?: IGameProfile;
  /**
   * The profile whose sound is on, which outlasts its game being in front.
   *
   * It is the game being waited on, and only while the chain playing is still
   * the one that game put on: a chain the listener picked afterwards is
   * theirs, and a page saying the game's sound is on would be wrong about it.
   */
  sounding?: IGameProfile;
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
  const soundNow = useSounding();
  const switches = useRef(0);
  const memory = useRef<IGameSoundMemory>({});
  /** The game being waited on the end of, so a stale end changes nothing. */
  const held = useRef(0);
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

  /** Remember the step, and put on what it chose. An empty chain is none. */
  const take = useCallback((step: IGameSoundStep) => {
    memory.current = step.memory;
    if (step.select === undefined) {
      return;
    }
    // Nothing here waits on the switch: the chain it selects is the app's
    // own, and a failure has already told the window in its own words.
    latest.current
      .apply(step.select === '' ? 'none' : step.select)
      .catch(() => undefined);
  }, []);

  const heard = useCallback(
    (program: IGameProgram) => {
      setFront(program);
      if (!applies) {
        return;
      }
      const { profiles: known, presetId } = latest.current;
      const profile = gameProfileFor(known, program.path);
      const step = gameSoundStep(memory.current, profile?.presetId, presetId);
      // Ask to be told when this game ends, because that — and not losing
      // the front — is what puts the sound back. Asked every time it comes
      // forward, not only when the chain changes: after a reload the watcher
      // is new and holds nothing, and the game may already be running.
      //
      // One process is held, the one whose window came forward. A launcher
      // that lives inside the game's own folder, shows a window, and quits
      // before the game's window appears therefore ends the hold early: the
      // old sound for a moment and a second card, then the game's sound
      // again when its window comes forward. Waiting on every process under
      // the folder would need Windows to announce process starts, which it
      // does not do without a service; this is the honest edge of the rule.
      if (profile?.presetId && program.pid) {
        held.current = program.pid;
        saySounding({ gameId: profile.id, presetId: profile.presetId });
        const bridge = window.electron?.ipcRenderer as
          IGameHoldBridge | undefined;
        bridge?.holdGameProcess?.(program.pid);
      }
      // A card for the switch itself, never for a game whose sound was
      // already the one playing: nothing changed, so there is nothing to say.
      if (step.select !== undefined && profile) {
        switches.current += 1;
        setSwitched({
          kind: 'loaded',
          id: switches.current,
          game: profile.name,
          presetId: step.select,
          ...(profile.icon ? { icon: profile.icon } : {}),
        });
      }
      take(step);
    },
    [applies, take],
  );

  /** The game whose sound is on has ended, so the sound before it goes back. */
  const ended = useCallback(
    (pid: number) => {
      if (!applies || pid !== held.current) {
        return;
      }
      held.current = 0;
      const over = sounding
        ? latest.current.profiles.find((one) => one.id === sounding?.gameId)
        : undefined;
      saySounding(undefined);
      const step = gameSoundEndStep(memory.current, latest.current.presetId);
      // The same card the way out as the way in, and only where something
      // actually went back: a listener who chose their own chain mid-game
      // keeps it, and there is nothing to announce.
      if (step.select !== undefined && over) {
        switches.current += 1;
        setSwitched({
          kind: 'restored',
          id: switches.current,
          game: over.name,
          presetId: step.select,
          ...(over.icon ? { icon: over.icon } : {}),
        });
      }
      take(step);
    },
    [applies, take],
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
    const offEnded = listen(GAME_ENDED_CHANNEL, (...args: unknown[]) => {
      const [pid] = args;
      if (typeof pid === 'number') {
        ended(pid);
      }
    });
    return () => {
      off();
      offEnded();
    };
  }, [heard, ended]);

  const forgetSwitch = useCallback(() => setSwitched(undefined), []);

  // Judged rather than remembered: the chain playing is what says whether the
  // sound is still the game's, and it changes the moment the listener picks
  // another one — which is a render, so this is answered again with it.
  const ourSound =
    soundNow !== undefined &&
    soundNow.presetId === (settings.enabled ? settings.presetId : '');

  return {
    profiles,
    front,
    switched,
    forgetSwitch,
    playing: front ? gameProfileFor(profiles, front.path) : undefined,
    sounding: ourSound
      ? profiles.find((profile) => profile.id === soundNow.gameId)
      : undefined,
  };
};
