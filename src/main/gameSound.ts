/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import type { IKeptGames } from '../common/coreCopies';
import type { IState } from '../common/constants';
import { namedDspPreset } from '../common/dsp/presetName';
import { activeDspPresetId } from '../common/dsp/presetPick';
import type { IUserDspPreset } from '../common/dsp/userPresets';
import {
  IGameProgram,
  IGameSoundMemory,
  IGameSoundStep,
  gameProfileFor,
  gameSoundEndStep,
  gameSoundStep,
} from '../common/games';
import type { Translate } from '../common/i18n';
import type { IKeptFile } from '../core/files/keptFile';
import type { IMainSession } from './mainSession';
import { playingRack } from './outputRack';

/** The game whose sound is on, and the chain it put on. */
export interface IGameSounding {
  gameId: string;
  presetId: string;
}

/** What the card on the desktop says: the words, and the game's icon. */
export interface IGameCard {
  what: string;
  game: string;
  icon?: string;
}

export interface IGameSoundDeps {
  state: IState;
  session: IMainSession;
  /** The Games page's switch and profiles, as the core keeps them. */
  games: IKeptFile<IKeptGames>;
  savedChains: () => readonly IUserDspPreset[];
  /** The output Windows plays put in the editor, under a profile mutation. */
  openPlayingOutput: () => Promise<boolean>;
  /** A quick pick on the output being edited; whether it landed. */
  pick: (presetId: string) => Promise<void>;
  /** The song memory, whose loan comes off before a game's sound goes on. */
  songMemory: {
    yieldSound: () => Promise<void>;
    hold: (held: boolean) => void;
    ownPresetId: (current: string) => string;
  };
  /** The watcher waits on this process's end; 0 for none. */
  holdProcess: (pid: number) => void;
  showCard: (card: IGameCard) => void;
  /** The window shows which game's sound is on. */
  tellWindow: (sounding: IGameSounding | undefined) => void;
  /** One of this listener's games is in front, or has left it. */
  onPlaying: (playing: boolean) => void;
  /** The listener's language, the card's. */
  t: Translate;
}

/**
 * The sound a game puts on, and keeps until the game is over, decided by the
 * core where the program watcher already runs (`ipc/games.ts`), so a game
 * switches the sound with the window minimised, behind the game, or closed.
 *
 * The rules are `common/games.ts`, values in and a step out. A game's sound
 * goes on when it comes forward and stays until that program ends: losing
 * the front is somebody alt-tabbing, not somebody finishing, and the watcher
 * waits on the game's own process rather than on anything timed. It goes on
 * the output Windows plays, the editor brought back there first, and a
 * song's lent sound comes off before it, so the game's lands on the
 * listener's own and nothing hands the song's back over it.
 *
 * One step at a time, in the order Windows reported them.
 */
export const createGameSound = ({
  state,
  session,
  games,
  savedChains,
  openPlayingOutput,
  pick,
  songMemory,
  holdProcess,
  showCard,
  tellWindow,
  onPlaying,
  t,
}: IGameSoundDeps) => {
  let memory: IGameSoundMemory = {};
  /** The game being waited on the end of, so a stale end changes nothing. */
  let held = 0;
  let sounding: IGameSounding | undefined;
  let steps: Promise<void> = Promise.resolve();

  /** The preset playing on the edited output, rack or curve. */
  const presetNow = () =>
    activeDspPresetId(playingRack(state, session), state.voicing) ?? '';

  /** Only while the chain playing is still the one the game put on. */
  const holdSongs = () =>
    songMemory.hold(
      sounding !== undefined && sounding.presetId === presetNow(),
    );

  const say = (next: IGameSounding | undefined) => {
    if (
      sounding?.gameId === next?.gameId &&
      sounding?.presetId === next?.presetId
    ) {
      return;
    }
    sounding = next;
    tellWindow(next);
    holdSongs();
  };

  const enqueue = (step: () => Promise<void>): Promise<void> => {
    steps = steps.then(step).catch((error: unknown) => {
      log.error('A game’s sound could not be switched', error);
    });
    return steps;
  };

  const card = (
    kind: 'loaded' | 'restored',
    presetId: string,
    game: { name: string; icon?: string },
  ) => {
    // A restore to nothing is the rack going off, which has no name: "Custom"
    // there would be the card inventing a chain.
    const preset =
      namedDspPreset(presetId, savedChains(), t) ?? t('dsp.eqPreset.custom');
    let what = t('games.toast.loaded', { preset });
    if (kind === 'restored') {
      what =
        presetId === ''
          ? t('games.toast.restoredNone')
          : t('games.toast.restored', { preset });
    }
    showCard({
      what,
      game:
        kind === 'restored'
          ? t('games.toast.afterGame', { game: game.name })
          : t('games.toast.forGame', { game: game.name }),
      ...(game.icon ? { icon: game.icon } : {}),
    });
  };

  /** Remember the step, and put on what it chose. An empty chain is none. */
  const take = async (step: IGameSoundStep) => {
    memory = step.memory;
    if (step.select === undefined) {
      return;
    }
    await songMemory.yieldSound();
    await pick(step.select === '' ? 'none' : step.select);
  };

  /** The game whose sound is on has ended, or the switch went off. */
  const letGo = async (over: { name: string; icon?: string } | undefined) => {
    held = 0;
    say(undefined);
    if (!(await openPlayingOutput())) {
      return;
    }
    const step = gameSoundEndStep(memory, presetNow());
    if (step.select !== undefined && over) {
      card('restored', step.select, over);
    }
    await take(step);
  };

  return {
    /** Windows put `program` in front. */
    heard: (program: IGameProgram): Promise<void> => {
      const { enabled, profiles } = games.read();
      const profile = enabled
        ? gameProfileFor(profiles, program.path)
        : undefined;
      onPlaying(profile !== undefined);
      // A program with no sound of its own changes nothing — its step keeps
      // the memory as it is — so the editor is not pulled back to the
      // playing output for every alt-tab.
      const wanted = profile?.presetId;
      if (!enabled || !profile || wanted === undefined || wanted === '') {
        return Promise.resolve();
      }
      return enqueue(async () => {
        if (!(await openPlayingOutput())) {
          return;
        }
        // The listener's own preset is what goes back at the game's end,
        // never a song's that is only lent to it.
        const step = gameSoundStep(
          memory,
          wanted,
          songMemory.ownPresetId(presetNow()),
        );
        // Asked to be told when this game ends every time it comes forward,
        // not only when the chain changes: the game may already be running.
        // One process is held, the one whose window came forward.
        if (program.pid) {
          held = program.pid;
          holdProcess(program.pid);
          say({ gameId: profile.id, presetId: wanted });
        }
        // A card for the switch itself, never for a game whose sound was
        // already the one playing.
        if (step.select !== undefined) {
          card('loaded', step.select, profile);
        }
        await take(step);
        holdSongs();
      });
    },
    /** The process the watcher held has ended. */
    ended: (pid: number): Promise<void> => {
      if (pid === 0 || pid !== held) {
        return Promise.resolve();
      }
      const over = sounding
        ? games.read().profiles.find((one) => one.id === sounding?.gameId)
        : undefined;
      return enqueue(() => letGo(over));
    },
    /**
     * The profiles or the switch changed. Switched off while a game's sound
     * was on: the sound from before goes back now, as it would have when the
     * game closed — no card, the listener is pressing the switch that did it.
     */
    gamesChanged: (): Promise<void> => {
      if (games.read().enabled || held === 0) {
        return Promise.resolve();
      }
      holdProcess(0);
      onPlaying(false);
      return enqueue(() => letGo(undefined));
    },
    /** What plays may have changed: the song memory's hold follows it. */
    soundMayHaveChanged: holdSongs,
    sounding: () => sounding,
  };
};

export type TGameSound = ReturnType<typeof createGameSound>;
