/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import log from 'electron-log/renderer';
import type { ISongIdentity } from 'common/songIdentity';
import type { IOutputEditor } from 'common/outputSettings';
import type { ISongSound } from 'common/songSound';
import {
  ISongSoundParts,
  ISongSoundState,
  TSongSoundEffect,
  TSongSoundEvent,
  TSongSoundOwner,
  getInitialSongSoundState,
  reduceSongSound,
} from 'common/songSoundRecorder';
import { endDspLoan } from '../dsp/store';
import {
  forgetSongSound,
  keepSongSound as keepSongSoundApi,
  lookupSongSound,
  returnSongSound,
  saveSongSound,
} from '../utils/songSoundApi';
import { matchedEvent, putSongSoundOn } from './songSoundPutOn';
import { readOutputEditor } from '../utils/outputEditor';
import { readAutoEqParts, writeAutoEqParts } from './autoEqParts';
import { dismissSongSoundNotice, showSongSoundNotice } from './songSoundNotice';

/**
 * Runs songSoundRecorder effects in order, bound to their original editor.
 * Module state preserves loans across tab unmounts. One queue prevents old
 * hand-backs overtaking a new song; yieldSongSound waits for that queue.
 */

/** What Auto EQ's panel says about the song that plays. */
export interface ISongSoundNow {
  identity?: ISongIdentity;
  isPlaying: boolean;
  /** Whose saved sound plays, or nothing for the listener's own. */
  owner?: TSongSoundOwner;
  /** The preset playing, as the picker names it (`songSoundOf`). */
  presetId?: string;
  /** The album whose sound plays, when it is its album's. */
  albumTitle?: string;
  /** "Save for this song" would file what plays now. */
  canSave: boolean;
}

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** The listener's switches, and whether something is holding them off. */
let chosenParts: ISongSoundParts = readAutoEqParts();
let isHeld = false;
let state: ISongSoundState = getInitialSongSoundState(chosenParts);
let now: ISongSoundNow = { isPlaying: false, canSave: false };
/** The album named by the last lookup, for the song it was about. */
let lastAlbum: { key: string; title: string } | undefined;
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

const performEffects = (effects: TSongSoundEffect[]): Promise<void> => {
  // Capture when requested, before the queue waits for another sound. Reading
  // the editor inside a queued task would address an old request to a new output.
  const target = readOutputEditor().editor;
  let last: Promise<void> = queue;
  effects.forEach((effect) => {
    switch (effect.kind) {
      case 'lookup': {
        const { identity } = effect;
        if (!isCurrentEditor(target)) {
          break;
        }
        lookupSongSound(identity)
          // The identity the lookup was asked about, never whatever plays
          // when the answer lands: the reducer turns a stale answer away by
          // it.
          .then((match) => {
            if (!isCurrentEditor(target)) {
              return undefined;
            }
            lastAlbum = match.album
              ? { key: identity.key, title: match.album.title }
              : undefined;
            return dispatchSongSound(matchedEvent(identity, match, state.live));
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
            const landed = await putSongSoundOn(sound, isLent, target, {
              isCurrent: isCurrentEditor,
              isApo,
              refresh,
            });
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
        saveSongSound(effect.identity, effect.sound, effect.isPlay).catch(
          (error: unknown) => {
            log.error('A song’s sound could not be saved', error);
          },
        );
        break;
      case 'notice':
        showSongSoundNotice({
          kind: 'lent',
          identity: effect.identity,
          owner: effect.owner,
          presetId: effect.sound.presetId,
          ...(effect.albumTitle === undefined
            ? {}
            : { albumTitle: effect.albumTitle }),
        });
        break;
      case 'willSave':
        showSongSoundNotice({
          kind: 'willSave',
          identity: effect.identity,
          presetId: effect.presetId,
          owner: effect.owner,
        });
        break;
      case 'forget':
        // Main tells the window once it is forgotten (`SONG_SOUNDS_CHANGED`),
        // and the song is looked up again then: one with an album's sound
        // takes it.
        forgetSongSound(effect.identity).catch((error: unknown) => {
          // Left standing, which is the safe way to fail: claiming a song
          // forgotten while its sound still comes back would not be.
          log.error('A song’s sound could not be forgotten', error);
        });
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

/** What the panel shows, kept as one object while nothing it says changes. */
const readNow = (): ISongSoundNow => {
  const { session, playing, live, pending } = state;
  const identity = session?.identity ?? playing?.identity;
  const owner = session?.owner;
  const canSave =
    !!session &&
    !session.isLoaded &&
    state.parts.songs &&
    !isHeld &&
    !pending &&
    live !== undefined;
  const isPlaying = playing?.isPlaying ?? false;
  const presetId = live?.presetId;
  const albumTitle =
    owner === 'album' && lastAlbum?.key === identity?.key
      ? lastAlbum?.title
      : undefined;
  return now.identity?.key === identity?.key &&
    now.owner === owner &&
    now.canSave === canSave &&
    now.isPlaying === isPlaying &&
    now.presetId === presetId &&
    now.albumTitle === albumTitle
    ? now
    : {
        ...(identity ? { identity } : {}),
        ...(owner ? { owner } : {}),
        ...(presetId === undefined ? {} : { presetId }),
        ...(albumTitle === undefined ? {} : { albumTitle }),
        canSave,
        isPlaying,
      };
};

const dispatchSongSound = (event: TSongSoundEvent): Promise<void> => {
  const [next, effects] = reduceSongSound(state, event, Date.now());
  const isNews = next !== state || effects.length > 0;
  state = next;
  now = readNow();
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
    dismissSongSoundNotice();
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

/* --- the switches --- */

const feedSwitch = (): void =>
  feedSongSound({
    kind: 'switched',
    parts: isHeld ? { songs: false, albums: false } : chosenParts,
  });

/** The listener's switches, whatever is holding them off. */
export const readSongSoundParts = (): ISongSoundParts => chosenParts;

export const setSongSoundParts = (parts: ISongSoundParts): void => {
  if (
    parts.songs === chosenParts.songs &&
    parts.albums === chosenParts.albums
  ) {
    return;
  }
  chosenParts = parts;
  writeAutoEqParts(parts);
  feedSwitch();
  emit();
};

/**
 * Held off while a game's sound plays, DSP is off or a Gaming chain is on
 * (Auto EQ steps aside; the switches come back as they were).
 */
export const holdSongSound = (held: boolean): void => {
  if (held === isHeld) {
    return;
  }
  isHeld = held;
  feedSwitch();
  emit();
};

export const useSongSoundParts = (): ISongSoundParts =>
  useSyncExternalStore(subscribe, readSongSoundParts, readSongSoundParts);

export const useSongSoundHeld = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => isHeld,
    () => false,
  );

export const useSongSoundNow = (): ISongSoundNow =>
  useSyncExternalStore(
    subscribe,
    () => now,
    () => now,
  );

/** "Save for this song": what plays is the song's own from now. */
export const saveSongSoundNow = (): void => feedSongSound({ kind: 'saveNow' });

/** What is kept changed elsewhere: the playing song is looked up again. */
export const reconsiderSongSound = (): void =>
  feedSongSound({ kind: 'reconsider' });

/** The playing song's own sound forgotten, and taken off it. */
export const forgetPlayingSongSound = (): void =>
  feedSongSound({ kind: 'forget' });

/** This play only: the listener's own sound back, the memory kept. */
export const undoSongSound = (): void => {
  feedSongSound({ kind: 'undo' });
  dismissSongSoundNotice();
};

/** This song not filed this play, whatever it ends with. */
export const dontSaveSongSound = (): void => {
  feedSongSound({ kind: 'dontSave' });
  dismissSongSoundNotice();
};

/** Reset module ownership between isolated sessions. */
export const resetSongSoundSession = (): void => {
  chosenParts = readAutoEqParts();
  isHeld = false;
  state = getInitialSongSoundState(chosenParts);
  dismissSongSoundNotice();
  lastAlbum = undefined;
  now = { isPlaying: false, canSave: false };
  queue = Promise.resolve();
  stateEditor = undefined;
  hasReturned = false;
  isApo = () => false;
  refresh = () => Promise.resolve();
  emit();
};

/** The sound playing now, as the window holds it: the Library's "Use what's
 * playing now" keeps it. Nothing while the window has not heard one yet. */
export const readLiveSongSound = (): ISongSound | undefined => state.live;

export const useLiveSongSound = (): ISongSound | undefined =>
  useSyncExternalStore(subscribe, readLiveSongSound, readLiveSongSound);
