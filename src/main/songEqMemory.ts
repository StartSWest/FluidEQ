/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import log from 'electron-log';
import type { ISmartEqSettings } from '../common/constants';
import type { ISongEqEntry } from '../common/songEq';
import type { ISongIdentity } from '../common/songIdentity';
import {
  type ISongEqRecorderState,
  type TSongEqEffect,
  type TSongEqEvent,
  getInitialRecorderState,
  reduceSongEq,
} from '../common/songEqRecorder';
import { listenedAt, willSongEqSave } from '../common/songEqTiming';
import type {
  ISongEqNotice,
  ISongEqStatus,
  TSongEqAction,
} from '../common/songEqStatus';
import createHeardClock from '../core/systemSound/heardClock';
import type { ISystemSound } from '../core/systemSound/systemSound';
import type { ISongEqEntries } from './songEqEntries';

/**
 * The Smart EQ song memory, run by the core: each song's Smart EQ layer,
 * filed while a running mode refines it and lent back the next time the song
 * plays (`common/songEqRecorder.ts` decides all of it; this performs what it
 * decides).
 *
 * It ran in the window, on the window's players' clock, so it stopped with
 * the window — a song played with the window closed was neither remembered
 * nor given its curve back, and a loan outlived its song. The core keeps the
 * same reducer and hears what it needs for itself: the output being edited,
 * its Smart EQ layer and whether a running mode refines it, after every
 * update (`follow`); what plays, from the window's players (`nowPlaying`);
 * and its own clock, the output's sound, counted only while a song is open.
 */

/** How much heard sound is one step of the recorder's clock. */
const SECONDS_PER_TICK = 0.25;

export interface ISongEqMemoryDeps {
  entries: Pick<ISongEqEntries, 'lookup' | 'checkpoint' | 'commit' | 'forget'>;
  /** Write the edited output's Smart EQ layer; true when it landed. */
  writeLayer: (layer: ISmartEqSettings | undefined) => Promise<boolean>;
  /** The output being edited now. */
  editedDevice: () => string;
  /** A remembered layer, or the one it was lent over, is on: draw it. */
  tellWindowLayer: (layer: ISmartEqSettings | undefined) => void;
  tellWindowStatus: (status: ISongEqStatus) => void;
  systemSound: ISystemSound;
}

/** What the core reads after every update. */
export interface ISongEqFollowed {
  deviceId: string;
  layer: ISmartEqSettings | undefined;
  /** A running mode refines the layer — what saving files. */
  isAutoEqRunning: boolean;
}

export const createSongEqMemory = ({
  entries,
  writeLayer,
  editedDevice,
  tellWindowLayer,
  tellWindowStatus,
  systemSound,
}: ISongEqMemoryDeps) => {
  let recorder: ISongEqRecorderState = getInitialRecorderState();
  let followed: ISongEqFollowed | undefined;
  let notice: ISongEqNotice | undefined;
  let lastNoticeId = 0;
  let lastStatus = '';
  /** Every layer written, one after another, in the order decided. */
  let writes: Promise<void> = Promise.resolve();
  /** Events decided while effects run, taken in turn after them. */
  const pending: TSongEqEvent[] = [];
  let isDispatching = false;

  const isOpen = () => recorder.session !== undefined;

  // Declared before the clock, which answers through it.
  let dispatch: (event: TSongEqEvent) => void;

  const clock = createHeardClock({
    systemSound,
    secondsPerStep: SECONDS_PER_TICK,
    onStep: () => dispatch({ kind: 'tick' }),
    onLost: () => sayStatus(),
  });

  function status(): ISongEqStatus {
    const now = Date.now();
    const { session } = recorder;
    return {
      isSaveOn: recorder.isSaveOn,
      listenedMs: session ? listenedAt(session, now) : 0,
      ...(session ? { title: session.identity.title } : {}),
      willSave: session ? willSongEqSave(recorder, session, now) : false,
      ...(notice ? { notice } : {}),
      needsClock: isOpen() && clock.isLost(),
    };
  }

  /**
   * Told only when it would draw differently: the badge, the chip and the
   * player draw the listened time to the second, so a status that moved by
   * less is not news, and telling them at every step of the clock would
   * redraw all three four times a second to say nothing new.
   */
  function sayStatus() {
    const now = status();
    const drawn = JSON.stringify({
      ...now,
      listenedMs: Math.floor(now.listenedMs / 1000),
    });
    if (drawn !== lastStatus) {
      lastStatus = drawn;
      tellWindowStatus(now);
    }
  }

  /** A layer the memory decided on, written after any still on its way. */
  const write = (layer: ISmartEqSettings | undefined) => {
    // Decided for the output the memory was following; one opened since
    // has a layer of its own, which is not this decision's to replace.
    const { deviceId } = recorder;
    writes = writes
      .then(async () => {
        // The layer as written is the one `follow` was handed on the
        // update's way through, rounded as the state keeps it.
        if (editedDevice() === deviceId && (await writeLayer(layer))) {
          tellWindowLayer(followed?.layer);
        }
        return undefined;
      })
      .catch((error: unknown) => {
        // Background work with no banner to raise it to; the next song, or
        // the next checkpoint, tries again.
        log.error('A song’s Smart EQ could not be put on or given back', error);
      });
  };

  /** Writes to disk are best-effort: the next checkpoint or close retries. */
  const store = (what: string, task: () => void) => {
    try {
      task();
    } catch (error) {
      log.error(`A song’s Smart EQ could not be ${what}`, error);
    }
  };

  const perform = (effects: TSongEqEffect[], isSwitch: boolean) => {
    effects.forEach((effect) => {
      switch (effect.kind) {
        case 'lookup': {
          const { deviceId, identity } = effect;
          let entry: ISongEqEntry | undefined;
          try {
            entry = entries.lookup(deviceId, identity);
          } catch (error) {
            log.error('A song’s Smart EQ could not be read', error);
          }
          // With the identity it was asked about: the reducer turns away an
          // answer about a song no longer playing by it.
          pending.push({ kind: 'matched', identity, entry });
          break;
        }
        case 'applyLayer':
          // A switch of output closes the song on the output it left, whose
          // layer is not the one being edited any more.
          if (!isSwitch) {
            write(effect.settings);
          }
          break;
        case 'checkpoint':
          store('saved', () =>
            entries.checkpoint(effect.deviceId, effect.identity, effect.layer),
          );
          break;
        case 'commit':
          store('saved', () =>
            entries.commit(effect.deviceId, effect.identity, effect.layer),
          );
          break;
        case 'notice':
          lastNoticeId += 1;
          notice = {
            id: lastNoticeId,
            identity: effect.identity,
            entry: effect.entry,
          };
          break;
        case 'forget':
          // Left standing, the safe way to fail: claiming a song forgotten
          // while its curve still comes back would not be.
          store('forgotten', () =>
            entries.forget(effect.deviceId, effect.identity),
          );
          break;
        default: {
          const exhaustive: never = effect;
          throw new Error(
            `Unhandled songEq effect: ${JSON.stringify(exhaustive)}`,
          );
        }
      }
    });
  };

  dispatch = (event) => {
    pending.push(event);
    if (isDispatching) {
      return;
    }
    isDispatching = true;
    try {
      while (pending.length > 0) {
        const next = pending.shift() as TSongEqEvent;
        const [state, effects] = reduceSongEq(recorder, next, Date.now());
        recorder = state;
        perform(effects, next.kind === 'deviceChanged');
      }
    } finally {
      isDispatching = false;
    }
    clock.follow(isOpen());
    sayStatus();
  };

  const act = (action: TSongEqAction) => {
    switch (action.kind) {
      case 'setSaveOn':
        dispatch({ kind: 'saveToggled', isSaveOn: action.isSaveOn });
        break;
      case 'undo':
        dispatch({ kind: 'undo' });
        notice = undefined;
        sayStatus();
        break;
      case 'forget':
        // The song the card names, which the reducer weighs against the one
        // open now.
        dispatch({ kind: 'forget', identity: notice?.identity });
        notice = undefined;
        sayStatus();
        break;
      case 'endNotice':
        // The card's own linger has run: it stops saying it, and the loaned
        // layer keeps playing as if neither button had been pressed.
        if (notice?.id === action.id) {
          notice = undefined;
          sayStatus();
        }
        break;
      default: {
        const exhaustive: never = action;
        throw new Error(
          `Unhandled songEq action: ${JSON.stringify(exhaustive)}`,
        );
      }
    }
  };

  return {
    status,
    /**
     * After every update: the output, its layer and the running mode, each
     * told only when it changed, in the order the reducer expects them — a
     * new output first, then the layer that came with it.
     */
    follow: (next: ISongEqFollowed) => {
      const before = followed;
      followed = next;
      if (before?.deviceId !== next.deviceId) {
        clock.reset();
        dispatch({ kind: 'deviceChanged', deviceId: next.deviceId });
      }
      if (before === undefined || before.layer !== next.layer) {
        dispatch({ kind: 'layerChanged', layer: next.layer });
      }
      if (before?.isAutoEqRunning !== next.isAutoEqRunning) {
        dispatch({ kind: 'autoEqChanged', isRunning: next.isAutoEqRunning });
      }
    },
    nowPlaying: (identity: ISongIdentity | undefined, isPlaying: boolean) =>
      dispatch({ kind: 'nowPlaying', identity, isPlaying }),
    /** A running mode is writing this layer: ours, so the loan holds. */
    ownWrite: (layer: ISmartEqSettings | undefined) =>
      dispatch({ kind: 'ownWrite', layer }),
    /** Time passed for the window's players, while the core cannot hear it. */
    tick: () => dispatch({ kind: 'tick' }),
    act,
    /**
     * The app is closing: a song edited while it played is filed, and a
     * loan given back, before the writes drain.
     */
    close: (): Promise<void> => {
      dispatch({ kind: 'closing' });
      clock.follow(false);
      return writes;
    },
  };
};

export type TSongEqMemory = ReturnType<typeof createSongEqMemory>;
