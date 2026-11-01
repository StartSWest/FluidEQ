/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import type { IState } from '../common/constants';
import type { IUserDspPreset } from '../common/dsp/userPresets';
import type { IOutputEditor } from '../common/outputSettings';
import type { ISongIdentity } from '../common/songIdentity';
import { ISongSound, sameSongSound } from '../common/songSound';
import {
  ISongSoundState,
  TSongSoundEffect,
  TSongSoundEvent,
  getInitialSongSoundState,
  reduceSongSound,
} from '../common/songSoundRecorder';
import type {
  ISongMemoryStatus,
  TSongMemoryNotice,
  TSongMemoryNoticeContent,
} from '../common/songMemoryStatus';
import type { IKeptFile } from '../core/files/keptFile';
import createHeardClock from '../core/systemSound/heardClock';
import type { ISystemSound } from '../core/systemSound/systemSound';
import { IMainSession, outputEditorOf } from './mainSession';
import { createSongSoundLending } from './songSoundLending';
import type { ISongSoundMemory } from './songSoundMemory';

export interface ISongMemoryDeps {
  state: IState;
  session: IMainSession;
  memory: ISongSoundMemory;
  /** The saved chains, as the core's copy holds them. */
  savedChains: () => readonly IUserDspPreset[];
  /** The listener's switch, kept by the core. */
  isOn: IKeptFile<boolean | undefined>;
  /** The update path for the edited output: whether the change landed. */
  update: (label: string) => Promise<boolean>;
  /** The window reads the edited output's sound again. */
  tellWindowSound: () => void;
  tellWindowStatus: (status: ISongMemoryStatus) => void;
  /** The output's sound, heard only to count time while a song waits. */
  systemSound: ISystemSound;
}

/** How much heard time is one step of the memory's clock. */
const SECONDS_PER_TICK = 0.25;

const sameEditor = (
  a: IOutputEditor | undefined,
  b: IOutputEditor | undefined,
): boolean => a?.device.id === b?.device.id && a?.generation === b?.generation;

/**
 * Which sound each song is played with, in the app's core: when a song's
 * sound is filed, when it is put back on, and what is handed back at its end
 * — the rules are `common/songSoundRecorder.ts`, a pure reducer; this runs
 * its effects on the edited output's own state (`songSoundLending.ts`), so a
 * song's sound is remembered and put back whether or not a window is open.
 * Every change is written by the update path and the window told, which
 * reads it back.
 *
 * Effects run one after another on a queue of their own, never under a
 * profile mutation: a profile loaded waits here for the song's sound to come
 * off (`yieldSound`), from inside its own mutation.
 *
 * Its clock is the output itself (`heardClock.ts`): a song settles for two
 * seconds before it is looked up, and a pause shorter than a minute is the
 * same play (`songEqTiming.ts`). While one of those waits, the core listens
 * and counts the time it hears; nothing else ticks, and no timer runs. Where
 * nothing can hear the output, the window's players say when time passes.
 */
export const createSongMemory = ({
  state,
  session,
  memory,
  savedChains,
  isOn,
  update,
  tellWindowSound,
  tellWindowStatus,
  systemSound,
}: ISongMemoryDeps) => {
  let isChosenOn = isOn.read() ?? false;
  let isHeld = false;
  let recorder: ISongSoundState = getInitialSongSoundState(isChosenOn);
  let notice: TSongMemoryNotice | undefined;
  let lastNoticeId = 0;
  let queue: Promise<void> = Promise.resolve();
  let stateEditor: IOutputEditor | undefined;
  let hasReturned = false;
  let heard: { sound: ISongSound | undefined } | undefined;
  let playing: { key?: string; isPlaying: boolean } | undefined;
  let lastStatus = '';

  const lending = createSongSoundLending({
    state,
    session,
    savedChains,
    land: async (label) => {
      const landed = await update(label);
      tellWindowSound();
      return landed;
    },
  });

  const isWaiting = () =>
    recorder.session?.phase === 'settling' ||
    recorder.session?.phase === 'suspended';

  // Declared before the clock and the effects, which answer through it.
  let dispatch: (event: TSongSoundEvent) => Promise<void>;

  const status = (): ISongMemoryStatus => ({
    isOn: isChosenOn,
    ...(notice ? { notice } : {}),
    needsClock: isWaiting() && clock.isLost(),
  });

  const sayStatus = () => {
    const now = status();
    const text = JSON.stringify(now);
    if (text !== lastStatus) {
      lastStatus = text;
      tellWindowStatus(now);
    }
  };

  const clock = createHeardClock({
    systemSound,
    secondsPerStep: SECONDS_PER_TICK,
    onStep: () => {
      dispatch({ kind: 'tick' }).catch(() => undefined);
    },
    onLost: sayStatus,
  });

  const isCurrent = (target: IOutputEditor | undefined) =>
    target !== undefined &&
    sameEditor(outputEditorOf(session), target) &&
    recorder.deviceId === target.device.id &&
    sameEditor(stateEditor, target);

  const enqueue = (task: () => Promise<void> | void): Promise<void> => {
    queue = queue.then(task).catch((error: unknown) => {
      // Background work with no banner to raise it to; the reducer has been
      // told how it ended, and the next song tries again.
      log.error('A song’s sound could not be put on or given back', error);
    });
    return queue;
  };

  const showNotice = (next: TSongMemoryNoticeContent) => {
    // The same preset again for the same song is the same news, and keeps
    // the card it has.
    if (
      next.kind === 'willSave' &&
      notice?.kind === 'willSave' &&
      notice.identity.key === next.identity.key &&
      notice.presetId === next.presetId
    ) {
      return;
    }
    lastNoticeId += 1;
    notice = { ...next, id: lastNoticeId };
  };

  const perform = (effects: TSongSoundEffect[]): Promise<void> => {
    // Bound to the editor they were asked for: a queued task never carries
    // an old request to a new output.
    const target = outputEditorOf(session);
    let last: Promise<void> = queue;
    effects.forEach((effect) => {
      switch (effect.kind) {
        case 'lookup': {
          const { deviceId, identity } = effect;
          if (!isCurrent(target) || deviceId !== target?.device.id) {
            break;
          }
          // Answered after this step, as an answer from elsewhere would be,
          // with the identity it was asked about: the reducer turns a stale
          // answer away by it.
          Promise.resolve()
            .then(() => memory.lookup(deviceId, identity))
            .then(
              (entry) =>
                isCurrent(target)
                  ? lending.playable(entry, recorder.live)
                  : undefined,
              (error: unknown) => {
                log.error('A song’s sound could not be read', error);
                return undefined;
              },
            )
            .then((entry) =>
              isCurrent(target)
                ? dispatch({ kind: 'matched', identity, entry })
                : undefined,
            )
            .catch(() => undefined);
          break;
        }
        case 'apply': {
          const { sound, isLent } = effect;
          last = enqueue(async () => {
            if (!isCurrent(target)) {
              return;
            }
            // Told, never waited on: what it sets in motion queues behind
            // this task, which would then wait on itself.
            try {
              const landed =
                (await lending.putOn(sound, isLent)) && isCurrent(target)
                  ? lending.soundNow()
                  : undefined;
              if (isCurrent(target)) {
                dispatch({ kind: 'applied', asked: sound, landed }).catch(
                  () => undefined,
                );
              }
            } catch (error) {
              // Settled as not landed: a sound asked for and never answered
              // would keep every later edit unread.
              if (isCurrent(target)) {
                dispatch({ kind: 'applied', asked: sound }).catch(
                  () => undefined,
                );
              }
              throw error;
            }
          });
          break;
        }
        case 'keep':
          last = enqueue(async () => {
            if (isCurrent(target)) {
              await lending.keep();
            }
          });
          break;
        case 'release':
          // An output switch: the new editor's own sound came with it.
          break;
        case 'save':
          try {
            memory.save(effect.deviceId, effect.identity, effect.sound);
          } catch (error) {
            log.error('A song’s sound could not be saved', error);
          }
          break;
        case 'notice':
          showNotice({
            kind: 'lent',
            identity: effect.identity,
            entry: effect.entry,
          });
          break;
        case 'willSave':
          showNotice({
            kind: 'willSave',
            identity: effect.identity,
            presetId: effect.presetId,
          });
          break;
        case 'forget':
          try {
            memory.forget(effect.deviceId, effect.identity);
          } catch (error) {
            // Left standing, the safe way to fail: claiming a song forgotten
            // while its sound still comes back would not be.
            log.error('A song’s sound could not be forgotten', error);
          }
          break;
        default: {
          const exhaustive: never = effect;
          throw new Error(
            `Unhandled songSound effect: ${JSON.stringify(exhaustive)}`,
          );
        }
      }
    });
    return last;
  };

  dispatch = (event) => {
    const [next, effects] = reduceSongSound(recorder, event, Date.now());
    recorder = next;
    // Old timers advanced before a switch cannot address their hand-back to
    // the editor the switch has just opened.
    const done = perform(
      event.kind === 'deviceChanged'
        ? effects.filter(({ kind }) => kind !== 'apply' && kind !== 'keep')
        : effects,
    );
    clock.follow(isWaiting());
    sayStatus();
    return done;
  };

  /**
   * A song's sound left lent from before this run of the core is put back
   * once the first editor is known.
   */
  const returnLeftover = () => {
    const target = outputEditorOf(session);
    if (hasReturned || !target) {
      return;
    }
    hasReturned = true;
    enqueue(async () => {
      if (isCurrent(target)) {
        await lending.giveBackLeftover();
      }
    }).catch(() => undefined);
  };

  /** The output edited is told before the sound it brings. */
  const followEditor = () => {
    const current = outputEditorOf(session);
    if (sameEditor(current, stateEditor)) {
      return;
    }
    if (stateEditor && current && current.device.id === stateEditor.device.id) {
      // A profile reload replaced this editor without changing its device:
      // its pending apply and hand-back belong to the previous generation.
      recorder = {
        ...recorder,
        pending: undefined,
        owed: undefined,
        session: recorder.session && {
          ...recorder.session,
          handBack: undefined,
          isLoaded: true,
        },
      };
    }
    stateEditor = current;
    notice = undefined;
    heard = undefined;
    dispatch({
      kind: 'deviceChanged',
      deviceId: current?.device.id ?? '',
    }).catch(() => undefined);
    returnLeftover();
  };

  const feedSwitch = () =>
    dispatch({ kind: 'switched', isOn: isChosenOn && !isHeld });

  return {
    status,
    /** The edited output, or its sound, may have changed. */
    soundMayHaveChanged: () => {
      followEditor();
      const sound = lending.soundNow();
      const same =
        heard !== undefined &&
        (heard.sound === undefined || sound === undefined
          ? heard.sound === sound
          : sameSongSound(heard.sound, sound));
      if (same) {
        return;
      }
      heard = { sound };
      dispatch({ kind: 'soundChanged', sound }).catch(() => undefined);
    },
    /** What plays, as the window's players and Windows' sessions say. */
    nowPlaying: (identity: ISongIdentity | undefined, isPlaying: boolean) => {
      if (playing?.key === identity?.key && playing?.isPlaying === isPlaying) {
        return;
      }
      playing = { key: identity?.key, isPlaying };
      followEditor();
      dispatch({ kind: 'nowPlaying', identity, isPlaying }).catch(
        () => undefined,
      );
    },
    /** Time passed, from the window's players, while nothing else can say. */
    tick: () => {
      dispatch({ kind: 'tick' }).catch(() => undefined);
    },
    /** The output Windows plays changed: the clock can listen again. */
    outputChanged: () => {
      clock.reset();
      clock.follow(isWaiting());
      sayStatus();
    },
    setOn: (next: boolean) => {
      isOn.keep(next);
      if (next === isChosenOn) {
        return;
      }
      isChosenOn = next;
      feedSwitch().catch(() => undefined);
    },
    /** A window from before the core kept the switch, handing it over. */
    handOver: (wasOn: boolean) => {
      if (isOn.read() === undefined) {
        isOn.keep(wasOn);
        isChosenOn = wasOn;
        feedSwitch().catch(() => undefined);
      }
    },
    /** A game's own sound holds the memory off for as long as it plays. */
    hold: (held: boolean) => {
      if (held === isHeld) {
        return;
      }
      isHeld = held;
      feedSwitch().catch(() => undefined);
    },
    /** Something else is about to put a sound on: the song's comes off. */
    yieldSound: (): Promise<void> => dispatch({ kind: 'yield' }),
    /** What plays is being saved as a profile: it stays as it is. */
    keepSound: (): Promise<void> => dispatch({ kind: 'keep' }),
    /** This play only: the listener's own sound back, the memory kept. */
    undo: () => {
      notice = undefined;
      dispatch({ kind: 'undo' }).catch(() => undefined);
    },
    /** This song not filed this play, whatever it ends with. */
    dontSave: () => {
      notice = undefined;
      dispatch({ kind: 'dontSave' }).catch(() => undefined);
    },
    /** The song the card names forgotten, and its sound taken off it. */
    forgetNoticed: () => {
      const identity = notice?.identity;
      notice = undefined;
      dispatch({ kind: 'forget', identity }).catch(() => undefined);
    },
    /** The card named by `id` has been up for its whole moment. */
    endNotice: (id: number) => {
      if (notice?.id === id) {
        notice = undefined;
        sayStatus();
      }
    },
    /** The app is closing: what an edited song files is filed now. */
    close: () => dispatch({ kind: 'closing' }),
    /** The preset the listener owns, a song's lent one aside. */
    ownPresetId: (current: string): string => {
      const own = recorder.session?.handBack ?? recorder.owed?.sound;
      if (!own) {
        return current;
      }
      return own.presetId === 'none' ? '' : own.presetId;
    },
  };
};

export type TSongMemory = ReturnType<typeof createSongMemory>;
