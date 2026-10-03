/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import log from 'electron-log/renderer';
import type { ISongIdentity } from 'common/songIdentity';
import type { IOutputEditor } from 'common/outputSettings';
import type { ISongSound, ISongSoundEntry } from 'common/songSound';
import {
  ISongSoundState,
  TSongSoundEffect,
  TSongSoundEvent,
  getInitialSongSoundState,
  reduceSongSound,
} from 'common/songSoundRecorder';
import {
  applyDspSettings,
  endDspLoan,
  isDspLent,
  lendDspSettings,
  persistDspSettings,
  readDspSettings,
} from '../dsp/store';
import {
  resolveDspPreset,
  resolveDspPresetCurve,
} from '../dsp/dspPresetCatalog';
import {
  applySongSound,
  forgetSongSound,
  keepSongSound as keepSongSoundApi,
  lookupSongSound,
  returnSongSound,
  saveSongSound,
} from '../utils/songSoundApi';
import songSoundOf from './songSoundOf';
import { readOutputEditor } from '../utils/outputEditor';

/**
 * Runs songSoundRecorder effects in order, bound to their original editor.
 * Module state preserves loans across tab unmounts. One queue prevents old
 * hand-backs overtaking a new song; yieldSongSound waits for that queue.
 */

/** The latest notice belongs to the current song and editor. */
type TNoticeContent =
  | { kind: 'lent'; identity: ISongIdentity; entry: ISongSoundEntry }
  | { kind: 'willSave'; identity: ISongIdentity; presetId: string };

export type TSongSoundNotice = TNoticeContent & { id: number };

/** The switch, remembered on this machine. Off until the listener opts in. */
const STORAGE_KEY = 'fluideq.songSound';

const readIsOn = (): boolean => {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
};

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The listener's switch, and whether a game's sound is holding it off. */
let isChosenOn = readIsOn();
let isHeld = false;
let state: ISongSoundState = getInitialSongSoundState(isChosenOn);
let notice: TSongSoundNotice | undefined;
let lastNoticeId = 0;
let queue: Promise<void> = Promise.resolve();
let stateEditor: IOutputEditor | undefined;

/** The host supplies engine choice and readback after an acknowledged edit. */
let isApo = (): boolean => false;
let refresh = (): Promise<void> => Promise.resolve();

const isCurrentEditor = (
  target: IOutputEditor | undefined,
): target is IOutputEditor => {
  const current = readOutputEditor().editor;
  return (
    !!target &&
    current?.device.id === target.device.id &&
    current.generation === target.generation &&
    state.deviceId === target.device.id &&
    stateEditor?.device.id === target.device.id &&
    stateEditor.generation === target.generation
  );
};

export const registerSongSoundHost = (host: {
  isApo: () => boolean;
  refresh: () => Promise<void>;
}): void => {
  isApo = host.isApo;
  refresh = host.refresh;
};

const enqueue = (task: () => Promise<void> | void): Promise<void> => {
  queue = queue.then(task).catch((error: unknown) => {
    // Background work with no banner to raise it to; the reducer has been
    // told how it ended, and the next song tries again.
    log.error('A song’s sound could not be put on or given back', error);
  });
  return queue;
};

/** A missing remembered preset lends only its Tone/bands, keeping this rack. */
const playable = (
  entry: ISongSoundEntry | undefined,
): ISongSoundEntry | undefined => {
  if (
    !entry ||
    !state.live ||
    resolveDspPreset(entry.sound.presetId, readDspSettings())
  ) {
    return entry;
  }
  return {
    ...entry,
    sound: { ...entry.sound, presetId: state.live.presetId },
  };
};

/**
 * A hand-back restores the exact borrowed rack, including manual changes,
 * rather than preset defaults. Main restores the matching curve. Other sounds
 * follow the picker, with the rack held off under Equalizer APO.
 */
const putOn = async (
  sound: ISongSound,
  isLent: boolean,
  target: IOutputEditor,
): Promise<ISongSound | undefined> => {
  const isRestoring = !isLent && isDspLent();
  const rack = isRestoring
    ? undefined
    : resolveDspPreset(sound.presetId, readDspSettings());
  // None, or a preset with no curve, takes a preset's curve away (`null`); a
  // hand-back main puts back from its loan, or a preset nobody can name,
  // leaves the voicing alone (`undefined`).
  const curve = rack
    ? (resolveDspPresetCurve(sound.presetId) ?? null)
    : undefined;
  const landed = await applySongSound(sound, isLent, curve, target);
  if (!isCurrentEditor(target)) {
    return undefined;
  }
  if (isRestoring) {
    endDspLoan(true);
  } else if (rack) {
    const next =
      isApo() && sound.presetId !== 'none'
        ? { ...rack, enabled: false, gameMode: false }
        : rack;
    if (isLent) {
      lendDspSettings(next);
    } else {
      applyDspSettings(next);
      persistDspSettings();
    }
  }
  await refresh();
  return isCurrentEditor(target)
    ? songSoundOf(landed, readDspSettings())
    : undefined;
};

const showNotice = (next: TNoticeContent): void => {
  // The same preset again for the same song — the picker's curve and its rack
  // landing a render apart — is the same news, and keeps the card it has.
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
  emit();
};

const performEffects = (effects: TSongSoundEffect[]): Promise<void> => {
  // Capture when requested, before the queue waits for another sound. Reading
  // the editor inside a queued task would address an old request to a new output.
  const target = readOutputEditor().editor;
  let last: Promise<void> = queue;
  effects.forEach((effect) => {
    switch (effect.kind) {
      case 'lookup': {
        const { deviceId, identity } = effect;
        if (!isCurrentEditor(target) || deviceId !== target.device.id) {
          break;
        }
        lookupSongSound(deviceId, identity)
          // The identity the lookup was asked about, never whatever plays
          // when the answer lands: the reducer turns a stale answer away by
          // it.
          .then((entry) => {
            if (!isCurrentEditor(target)) {
              return undefined;
            }
            return dispatchSongSound({
              kind: 'matched',
              identity,
              entry: playable(entry),
            });
          })
          .catch(() => {
            // No answer is no memory of this song, and a hand-back held over
            // for it is settled the same way.
            if (!isCurrentEditor(target)) {
              return undefined;
            }
            return dispatchSongSound({ kind: 'matched', identity });
          });
        break;
      }
      case 'apply': {
        const { sound, isLent } = effect;
        last = enqueue(async () => {
          if (!isCurrentEditor(target)) {
            return;
          }
          try {
            const landed = await putOn(sound, isLent, target);
            if (isCurrentEditor(target)) {
              dispatchSongSound({ kind: 'applied', asked: sound, landed });
            }
          } catch (error) {
            if (!isCurrentEditor(target)) {
              return;
            }
            dispatchSongSound({ kind: 'applied', asked: sound });
            throw error;
          }
        });
        break;
      }
      case 'keep':
        last = enqueue(async () => {
          if (!isCurrentEditor(target)) {
            return;
          }
          await keepSongSoundApi(target);
          if (isCurrentEditor(target)) {
            endDspLoan(false);
          }
        });
        break;
      case 'release':
        // Output adoption owns the new editor's rack and loan. Restoring here
        // would put the outgoing output's loan onto it, or end its own loan.
        break;
      case 'save':
        saveSongSound(effect.deviceId, effect.identity, effect.sound).catch(
          (error: unknown) => {
            log.error('A song’s sound could not be saved', error);
          },
        );
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
        forgetSongSound(effect.deviceId, effect.identity).catch(
          (error: unknown) => {
            // Left standing, which is the safe way to fail: claiming a song
            // forgotten while its sound still comes back would not be.
            log.error('A song’s sound could not be forgotten', error);
          },
        );
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

const dispatchSongSound = (event: TSongSoundEvent): Promise<void> => {
  const [next, effects] = reduceSongSound(state, event, Date.now());
  const isNews = next !== state || effects.length > 0;
  state = next;
  // The reducer advances old timers before a switch; their hand-back cannot
  // be addressed to the editor that the switch has just opened.
  const done = performEffects(
    event.kind === 'deviceChanged'
      ? effects.filter(({ kind }) => kind !== 'apply' && kind !== 'keep')
      : effects,
  );
  if (isNews) {
    emit();
  }
  return done;
};

/** Feed the reducer from the host: what plays, what is heard, the clock. */
export const feedSongSound = (event: TSongSoundEvent): void => {
  if (event.kind === 'deviceChanged') {
    const current = readOutputEditor().editor;
    if (
      stateEditor &&
      current?.device.id === stateEditor.device.id &&
      current.generation !== stateEditor.generation
    ) {
      // A profile reload can replace this editor without changing its device.
      // Its old pending apply/hand-back belongs to the previous generation.
      state = {
        ...state,
        pending: undefined,
        owed: undefined,
        session: state.session && {
          ...state.session,
          handBack: undefined,
          isLoaded: true,
        },
      };
      emit();
    }
    stateEditor = current;
    dismissNotice();
  }
  dispatchSongSound(event).catch(() => {
    // Reported where the effect failed (`enqueue`).
  });
};

/** Another picker waits for the loan to finish before applying its sound. */
export const yieldSongSound = (): Promise<void> =>
  dispatchSongSound({ kind: 'yield' });

/** The sound playing is about to be saved as a profile: it stays. */
export const keepSongSound = (): Promise<void> =>
  dispatchSongSound({ kind: 'keep' });

/**
 * Called once as the window starts: whatever main still holds lent from
 * before a reload is put back, because nothing in this window will ever hand
 * it back. Restore only this editor's rack after main acknowledges the same
 * generation; a new editor owns a different loan.
 */
let hasReturned = false;
export const returnLeftoverSongSound = (): void => {
  if (hasReturned) {
    return;
  }
  const target = readOutputEditor().editor;
  if (!target) {
    return;
  }
  hasReturned = true;
  enqueue(async () => {
    if (!isCurrentEditor(target)) {
      return;
    }
    await returnSongSound(target);
    if (!isCurrentEditor(target)) {
      return;
    }
    endDspLoan(true);
    await refresh();
  }).catch(() => {
    // Reported by `enqueue`.
  });
};

/* --- the switch --- */

const feedSwitch = (): void =>
  feedSongSound({ kind: 'switched', isOn: isChosenOn && !isHeld });

/** The listener's switch, whatever a game is doing. */
export const isSongSoundOn = (): boolean => isChosenOn;

export const setSongSoundOn = (isOn: boolean): void => {
  if (isOn === isChosenOn) {
    return;
  }
  isChosenOn = isOn;
  try {
    window.localStorage.setItem(STORAGE_KEY, String(isOn));
  } catch {
    // Keep the choice for this window when storage is unavailable.
  }
  feedSwitch();
  emit();
};

/** Games yield the song loan first, then hold background song recalls off. */
export const holdSongSound = (held: boolean): void => {
  if (held === isHeld) {
    return;
  }
  isHeld = held;
  feedSwitch();
};

/** A game remembers the owned preset, excluding a song loan. */
export const ownPresetId = (current: string): string => {
  const own = state.session?.handBack ?? state.owed?.sound;
  if (!own) {
    return current;
  }
  return own.presetId === 'none' ? '' : own.presetId;
};

export const useSongSoundOn = (): boolean =>
  useSyncExternalStore(subscribe, isSongSoundOn, () => false);

/* --- the notice --- */

export const useSongSoundNotice = (): TSongSoundNotice | undefined =>
  useSyncExternalStore(
    subscribe,
    () => notice,
    () => undefined,
  );

/** The notice named by `id` has been up for its whole moment. */
export const endSongSoundNotice = (id: number): void => {
  if (notice?.id !== id) {
    return;
  }
  notice = undefined;
  emit();
};

const dismissNotice = (): void => {
  if (notice === undefined) {
    return;
  }
  notice = undefined;
  emit();
};

/** This play only: the listener's own sound back, the memory kept. */
export const undoSongSound = (): void => {
  feedSongSound({ kind: 'undo' });
  dismissNotice();
};

/** This song not filed this play, whatever it ends with. */
export const dontSaveSongSound = (): void => {
  feedSongSound({ kind: 'dontSave' });
  dismissNotice();
};

/** The song the notice names forgotten, and its sound taken off it. */
export const forgetNoticedSongSound = (): void => {
  feedSongSound({ kind: 'forget', identity: notice?.identity });
  dismissNotice();
};

/** Reset module ownership between isolated sessions. */
export const resetSongSoundSession = (): void => {
  isChosenOn = readIsOn();
  isHeld = false;
  state = getInitialSongSoundState(isChosenOn);
  notice = undefined;
  queue = Promise.resolve();
  stateEditor = undefined;
  hasReturned = false;
  isApo = () => false;
  refresh = () => Promise.resolve();
  emit();
};
