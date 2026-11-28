/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useSyncExternalStore } from 'react';
import { playsSavedEq } from 'common/savedEq';
import type { ISongSound } from 'common/songSound';
import type { ISavedEqSummary } from 'common/songSoundMemory';
import { saveEq, saveSongSound, updateEq } from '../utils/songSoundApi';
import {
  type ISongSoundNow,
  feedSongSound,
  readLiveSongSound,
  readSongSoundNow,
  songSoundPicked,
  useLiveSongSound,
  useSongSoundNow,
} from './songSoundSession';

/**
 * What the listener does with Auto EQ's saved EQs (`savedEq.ts`) while
 * something plays: save what plays under a name, put one on, give one to the
 * playing song, update one with what plays — and which one is playing.
 *
 * Main keeps them (`ipc/savedEqs.ts`); putting one on goes through the song
 * sound session like any of the listener's edits, so a saved song's sound
 * playing at the time is changed, never forgotten.
 */

const listeners = new Set<() => void>();
/** The saved EQ the listener last put on or saved, for the row that says
 * Changed once what plays has moved off it. */
let wornId: string | undefined;

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const wear = (id: string | undefined) => {
  if (id !== wornId) {
    wornId = id;
    listeners.forEach((listener) => listener());
  }
};

/** What plays, as a saved EQ keeps it: its preset left out when asked. */
const soundToKeep = (live: ISongSound, keepPreset: boolean): ISongSound =>
  keepPreset ? live : { ...live, presetId: '' };

/**
 * Save what plays under a name. Answers with the name main used — numbered
 * when another saved EQ has it — or nothing before the window has heard what
 * plays.
 */
export const saveCurrentEq = async (
  name: string,
  keepPreset: boolean,
): Promise<string | undefined> => {
  const live = readLiveSongSound();
  if (!live) {
    return undefined;
  }
  const saved = await saveEq(name, soundToKeep(live, keepPreset));
  wear(saved.id);
  return saved.name;
};

/**
 * Put one on, as the listener's own choice. One kept without its preset plays
 * over the preset on now; with nothing heard yet there is none to keep, and
 * nothing is put on.
 */
export const putOnSavedEq = (eq: ISavedEqSummary): boolean => {
  const live = readLiveSongSound();
  if (eq.sound.presetId === '' && !live) {
    return false;
  }
  feedSongSound({
    kind: 'putOn',
    sound:
      eq.sound.presetId === '' && live
        ? { ...eq.sound, presetId: live.presetId }
        : eq.sound,
  });
  wear(eq.id);
  return true;
};

/**
 * The last save over a saved EQ, so it can be undone (Ivan, 2026-11-27,
 * option A: a save over somebody's EQ is destructive, and the Save menu
 * offers Undo in the saved row). What it held before and what was written.
 */
export interface ISaveOver {
  eqId: string;
  before: ISongSound;
  after: ISongSound;
}

let lastSaveOver: ISaveOver | undefined;

const keepSaveOver = (record: ISaveOver | undefined) => {
  if (record !== lastSaveOver) {
    lastSaveOver = record;
    listeners.forEach((listener) => listener());
  }
};

/** Update one with what plays, keeping or leaving out the preset as it was
 * saved: every song and album on it follows. Kept to be undone. */
export const updateSavedEqWithLive = async (
  eq: ISavedEqSummary,
): Promise<void> => {
  const live = readLiveSongSound();
  if (!live) {
    return;
  }
  const after = soundToKeep(live, eq.sound.presetId !== '');
  await updateEq(eq.id, after);
  // Worn first: a record for an EQ that is not yet the one on reads as
  // stale, and `useSaveOverUndo` would forget it.
  wear(eq.id);
  keepSaveOver({ eqId: eq.id, before: eq.sound, after });
};

/**
 * Put back what the saved EQ held before the last save over it. What plays is
 * left as it is: the edits are still there, now unsaved again, so the EQ reads
 * Changed and can be saved once more.
 */
export const undoSaveOver = async (): Promise<void> => {
  const record = lastSaveOver;
  if (!record) {
    return;
  }
  keepSaveOver(undefined);
  await updateEq(record.eqId, record.before);
};

/**
 * The save over the saved EQ that is on, while it can still be undone: only
 * until what plays moves off what was written. Compared with what was
 * written, never with the index, which hears of the update a moment later
 * and would read the EQ as changed in between.
 */
export const saveOverToUndo = (
  onId: string | undefined,
  live: ISongSound | undefined,
  record: ISaveOver | undefined,
): ISaveOver | undefined =>
  record &&
  live &&
  record.eqId === onId &&
  playsSavedEq(live, {
    id: record.eqId,
    name: '',
    sound: record.after,
    updatedAt: 0,
  })
    ? record
    : undefined;

const readSaveOver = () => lastSaveOver;

/** The undoable save over the EQ that is on; forgotten at the next change. */
export const useSaveOverUndo = (
  onId: string | undefined,
): ISaveOver | undefined => {
  const live = useLiveSongSound();
  const record = useSyncExternalStore(subscribe, readSaveOver, readSaveOver);
  const offered = saveOverToUndo(onId, live, record);
  // An edit, or another EQ put on, ends it for good: the Undo does not come
  // back if the edits happen to return to what was saved.
  const isStale = record !== undefined && live !== undefined && !offered;
  useEffect(() => {
    if (isStale) {
      keepSaveOver(undefined);
    }
  }, [isStale]);
  return offered;
};

/**
 * "Use a saved EQ" for the playing song: the song follows it from here. Main
 * then says the store changed, the song is looked up again, and the EQ goes
 * on as the song's own sound.
 */
export const giveSavedEqToSong = async (eqId: string): Promise<void> => {
  const { identity, canSave } = readSongSoundNow();
  if (!identity || !canSave) {
    return;
  }
  await saveSongSound(identity, { eqId });
  // It plays at once, over a change made since the song began.
  songSoundPicked((playing) => playing.key === identity.key);
};

/**
 * Which saved EQ is the one on: the one a saved song or album plays, or, over
 * the listener's own sound, the one they last put on or saved. A saved song
 * or album that follows none has none on.
 */
const wornFor = (
  now: ISongSoundNow,
  worn: string | undefined,
): string | undefined => (now.owner ? now.eqId : worn);

export interface ISavedEqStates {
  /** The saved EQ that plays exactly. */
  playingId?: string;
  /** The one on, changed since it went on: its row offers Update. */
  changedId?: string;
}

/** Which row says Playing and which says Changed (`wornFor`). */
export const savedEqStates = (
  eqs: readonly ISavedEqSummary[],
  live: ISongSound | undefined,
  now: ISongSoundNow,
  lastWorn: string | undefined,
): ISavedEqStates => {
  if (!live) {
    return {};
  }
  const worn = wornFor(now, lastWorn);
  const playsNow = (eq: ISavedEqSummary) => playsSavedEq(live, eq);
  const wornEq = eqs.find((eq) => eq.id === worn);
  const playing =
    wornEq && playsNow(wornEq) ? wornEq : eqs.find((eq) => playsNow(eq));
  return {
    ...(playing ? { playingId: playing.id } : {}),
    ...(wornEq && !playing ? { changedId: wornEq.id } : {}),
  };
};

const readWorn = () => wornId;

/** Which saved EQ says Playing and which Changed, as what plays moves. */
export const useSavedEqStates = (
  eqs: readonly ISavedEqSummary[],
): ISavedEqStates => {
  const live = useLiveSongSound();
  const now = useSongSoundNow();
  const worn = useSyncExternalStore(subscribe, readWorn, readWorn);
  return savedEqStates(eqs, live, now, worn);
};

/** Forget which one was worn and the save to undo, between isolated
 * sessions. */
export const resetSavedEqActions = (): void => {
  keepSaveOver(undefined);
  wear(undefined);
};
