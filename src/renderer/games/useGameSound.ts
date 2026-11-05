/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A game's own sound, put on when the game comes forward and kept until the
 * game is over.
 *
 * Main says which program Windows put in front; this decides what that
 * means. A game in the list gets its own copy of a whole sound — EQ, Tone,
 * curve and rack (Ivan, 2026-11-02) — which main puts on the playing output
 * in place of the music sound and gives back afterwards
 * (`main/ipc/gameSound.ts`).
 *
 * A game's sound goes on when it comes forward and stays on until that
 * program ends. Alt-tabbing to a browser, to Discord or to FluidEQ itself
 * happens constantly while somebody plays, and taking the game's sound away
 * then was the app taking it away mid-match. What the app waits on is the
 * game's own process: it asks main to hold it (`holdGameProcess`) and is told
 * when it ends, by Windows rather than by anything timed.
 *
 * It runs for the life of the window rather than the page: a game is in
 * front while somebody is playing, which is exactly when the Gaming Lab is
 * not the page on screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  gameProfileFor,
  gamingProfileOf,
  IGameProfile,
  IGameProgram,
} from '../../common/games';
import { useDspSettings } from '../dsp/store';
import { yieldSongSound } from '../audio/songSoundSession';
import { loadGameSound, unloadGameSound } from '../utils/gamingApi';
import { reportError } from '../utils/logger';
import useMainOutputEditor from '../utils/useMainOutputEditor';
import { useIsMainEdited } from '../utils/useMainEditorWhile';
import {
  GAME_PROFILES_CHANGED,
  readGameProfiles,
  readGamesEnabled,
} from './gameProfiles';
import gameSeedFor from './gameSeed';
import {
  readLoadedGame,
  refreshGameSoundState,
  useLoadedGame,
} from './gameSoundStore';
import { requestGameWatch } from './gameWatchRequest';

export const GAME_FOREGROUND_CHANNEL = 'game-foreground';
export const GAME_ENDED_CHANNEL = 'game-ended';

interface IGameHoldBridge {
  holdGameProcess?: (pid: number) => void;
}

const isProgram = (value: unknown): value is IGameProgram =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as IGameProgram).path === 'string' &&
  (value as IGameProgram).path !== '';

/** The Gaming Lab's switch for the whole feature, kept in step. */
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
 * The game whose own sound is on, for anything outside this hook that has to
 * say so — the bar at the foot of the window, which speaks for the machine's
 * own sound and had nothing to say about a game, because a game registers no
 * player with Windows the way Spotify and a browser do.
 */
export const useSoundingGame = (): IGameProfile | undefined => {
  const profiles = useGameProfiles();
  const { gameId } = useLoadedGame();
  return gameId ? profiles.find((profile) => profile.id === gameId) : undefined;
};

/** A game's sound just put on — or the music sound back — for the card. */
export interface IGameSwitch {
  /** New each time, so the same game twice is announced twice. */
  id: number;
  game: string;
  icon?: string;
  kind: 'loaded' | 'restored';
}

export interface IGameSound {
  profiles: IGameProfile[];
  /** The last switch, until whoever shows it says it is done. */
  switched?: IGameSwitch;
  forgetSwitch: () => void;
  /** The game in front, while one of the listener's is. */
  playing?: IGameProfile;
  /** The game whose own sound is on, which outlasts it being in front. */
  sounding?: IGameProfile;
  /** Whether the Gaming Lab's switch has games switching the sound at all. */
  enabled: boolean;
  /** The program in front, whether or not it is one of the games. */
  front?: IGameProgram;
}

/**
 * A game's own sound on the playing output: the copy main keeps, made from
 * the game's Gaming profile the first time this output plays it. A song's
 * own sound comes off first (`songSoundSession.ts`), so the game's lands on
 * the listener's and nothing hands the song's back over it.
 */
export const putGameSoundOn = async (
  game: IGameProfile,
  rack: Parameters<typeof gameSeedFor>[1],
): Promise<void> => {
  const seed = gameSeedFor(gamingProfileOf(game), rack);
  if (!seed) {
    throw new Error(`No Gaming profile to start ${game.name} from.`);
  }
  await yieldSongSound();
  await loadGameSound(game.id, seed);
  await refreshGameSoundState();
};

/** The music sound back on every output a game borrowed. */
export const putMusicSoundBack = async (): Promise<void> => {
  await unloadGameSound();
  await refreshGameSoundState();
};

/**
 * The sound, and what is in front.
 *
 * `applies` belongs to exactly one caller — the window's own, which lives as
 * long as the window does, so a game switches the sound whatever page is open
 * and whether or not one is. The Gaming Lab asks for the same news without
 * it: two callers putting the same game on would each answer it twice.
 */
export const useGameSound = ({
  applies = false,
  always = false,
}: { applies?: boolean; always?: boolean } = {}): IGameSound => {
  const profiles = useGameProfiles();
  const rack = useDspSettings();
  const loaded = useLoadedGame();
  // A game's sound is the machine's, so it goes on the output that plays.
  // With a second output left in "Edit sound" the editor goes back to the
  // main output first, and what the game did is done once the window has it.
  // Through a ref: the handlers below are made once.
  const isMainEdited = useIsMainEdited();
  const isMainEditedRef = useRef(isMainEdited);
  isMainEditedRef.current = isMainEdited;
  const enterMainEditor = useMainOutputEditor();
  const owed = useRef<Array<() => void>>([]);
  const owe = useCallback(
    (step: () => void) => {
      owed.current.push(step);
      enterMainEditor().catch((error: unknown) => {
        owed.current = [];
        reportError('Could not put a game’s sound on the main output', error);
      });
    },
    [enterMainEditor],
  );
  const [front, setFront] = useState<IGameProgram | undefined>(undefined);
  const [switched, setSwitched] = useState<IGameSwitch | undefined>(undefined);
  const switches = useRef(0);
  /** The game being waited on the end of, so a stale end changes nothing. */
  const held = useRef<{ pid: number; gameId: string } | undefined>(undefined);
  const enabled = useGamesEnabled();
  // Read at the moment a handler fires: the list and the rack change while a
  // game runs, and a handler holding a copy from when it subscribed would
  // start a copy from an hour-old rack.
  const latest = useRef({ profiles, rack, enabled });
  latest.current = { profiles, rack, enabled };

  // Switched off, nothing watches: main stops asking Windows what is in
  // front, so no game can reach the sound whatever the list says.
  const wanted = enabled && (always || profiles.length > 0);
  useEffect(() => (wanted ? requestGameWatch() : undefined), [wanted]);

  const announce = useCallback(
    (game: IGameProfile, kind: IGameSwitch['kind']) => {
      switches.current += 1;
      setSwitched({
        kind,
        id: switches.current,
        game: game.name,
        ...(game.icon ? { icon: game.icon } : {}),
      });
    },
    [],
  );

  const heard = useCallback(
    (program: IGameProgram) => {
      // A front reported just before the watcher stopped is still news from
      // a feature that is now off.
      if (!latest.current.enabled) {
        return;
      }
      setFront(program);
      if (!applies) {
        return;
      }
      const game = gameProfileFor(latest.current.profiles, program.path);
      if (!game || !program.pid) {
        return;
      }
      if (!isMainEditedRef.current) {
        owe(() => heard(program));
        return;
      }
      // Ask to be told when this game ends, because that — and not losing the
      // front — is what gives the music sound back. Asked every time it comes
      // forward: after a reload the watcher is new and holds nothing, and the
      // game may already be running.
      //
      // One process is held, the one whose window came forward. A launcher
      // that lives inside the game's own folder, shows a window, and quits
      // before the game's window appears therefore ends the hold early: the
      // music sound for a moment and a second card, then the game's sound
      // again when its window comes forward. Waiting on every process under
      // the folder would need Windows to announce process starts, which it
      // does not do without a service; this is the honest edge of the rule.
      held.current = { pid: program.pid, gameId: game.id };
      const bridge = window.electron?.ipcRenderer as
        IGameHoldBridge | undefined;
      bridge?.holdGameProcess?.(program.pid);
      // Its sound already on — this game came back to the front — changes
      // nothing and says nothing.
      if (readLoadedGame().gameId === game.id) {
        return;
      }
      putGameSoundOn(game, latest.current.rack)
        .then(() => announce(game, 'loaded'))
        .catch((error: unknown) => {
          reportError(`Could not put ${game.name}’s sound on`, error);
        });
    },
    [applies, owe, announce],
  );

  /** The game whose sound is on has ended, so the music sound comes back. */
  const ended = useCallback(
    (pid: number) => {
      if (!applies || pid !== held.current?.pid) {
        return;
      }
      if (!isMainEditedRef.current) {
        owe(() => ended(pid));
        return;
      }
      const { gameId } = held.current;
      held.current = undefined;
      // Only the game's own sound goes; one the listener tried on in the
      // Gaming Lab since, or the music sound they put back by hand, stays.
      if (readLoadedGame().gameId !== gameId) {
        return;
      }
      const game = latest.current.profiles.find((one) => one.id === gameId);
      putMusicSoundBack()
        .then(() => {
          if (game) {
            announce(game, 'restored');
          }
          return undefined;
        })
        .catch((error: unknown) => {
          reportError('Could not give the music sound back', error);
        });
    },
    [applies, owe, announce],
  );

  /**
   * The switch went off while a game's sound was on: the music sound goes
   * back now, as it would have when the game closed. No card: the listener
   * is in this window, pressing the switch that did it.
   */
  const letGo = useCallback(() => {
    if (!applies || latest.current.enabled) {
      return;
    }
    if (held.current) {
      held.current = undefined;
      const bridge = window.electron?.ipcRenderer as
        IGameHoldBridge | undefined;
      bridge?.holdGameProcess?.(0);
    }
    if (readLoadedGame().gameId === undefined) {
      return;
    }
    if (!isMainEditedRef.current) {
      owe(() => letGo());
      return;
    }
    putMusicSoundBack().catch((error: unknown) => {
      reportError('Could not give the music sound back', error);
    });
  }, [applies, owe]);

  useEffect(() => {
    if (!enabled) {
      setFront(undefined);
      letGo();
    }
  }, [enabled, letGo]);

  // What a game did while the editor was on another output, done now that
  // the main output is the one being edited.
  useEffect(() => {
    if (!isMainEdited || owed.current.length === 0) {
      return;
    }
    const steps = owed.current;
    owed.current = [];
    steps.forEach((step) => step());
  }, [isMainEdited]);

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

  return {
    profiles,
    enabled,
    front,
    switched,
    forgetSwitch,
    playing: front ? gameProfileFor(profiles, front.path) : undefined,
    sounding: loaded.gameId
      ? profiles.find((profile) => profile.id === loaded.gameId)
      : undefined,
  };
};
