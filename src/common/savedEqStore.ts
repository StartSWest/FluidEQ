/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ISongSound } from './songSound';
import {
  ISavedEq,
  SAVED_EQ_MAX,
  cleanSavedEqName,
  isEqLink,
  uniqueSavedEqName,
} from './savedEq';
import type {
  IAlbumSoundEntry,
  ISongSoundEntry,
  ISongSoundSettings,
  TStoredSound,
} from './songSoundMemory';

/**
 * Saving, updating, renaming and deleting saved EQs in Auto EQ's store
 * (`savedEq.ts` for what one is). Pure, like `songSoundMemory.ts`.
 */

/** A name already taken by another saved EQ gets a number. */
const takenNames = (settings: ISongSoundSettings, except?: string) =>
  settings.eqs.filter((eq) => eq.id !== except).map((eq) => eq.name);

/**
 * A new saved EQ, newest last, or nothing when the name is empty, the id is
 * taken or the list is full.
 */
export const addSavedEq = (
  settings: ISongSoundSettings,
  id: string,
  name: string,
  sound: ISongSound,
  now: number,
): { settings: ISongSoundSettings; eq: ISavedEq } | undefined => {
  if (
    cleanSavedEqName(name) === '' ||
    settings.eqs.length >= SAVED_EQ_MAX ||
    settings.eqs.some((eq) => eq.id === id)
  ) {
    return undefined;
  }
  const eq: ISavedEq = {
    id,
    name: uniqueSavedEqName(name, takenNames(settings)),
    sound,
    updatedAt: now,
  };
  return { settings: { ...settings, eqs: [...settings.eqs, eq] }, eq };
};

const replaceEq = (
  settings: ISongSoundSettings,
  id: string,
  change: (eq: ISavedEq) => ISavedEq,
): ISongSoundSettings | undefined => {
  const index = settings.eqs.findIndex((eq) => eq.id === id);
  if (index < 0) {
    return undefined;
  }
  const eqs = [...settings.eqs];
  eqs[index] = change(eqs[index]);
  return { ...settings, eqs };
};

/** Update with what plays: every song and album on it follows. */
export const updateSavedEq = (
  settings: ISongSoundSettings,
  id: string,
  sound: ISongSound,
  now: number,
): ISongSoundSettings | undefined =>
  replaceEq(settings, id, (eq) => ({ ...eq, sound, updatedAt: now }));

/** Renamed, numbered where another saved EQ has the name; nothing for an empty
 * name or an id that is gone. */
export const renameSavedEq = (
  settings: ISongSoundSettings,
  id: string,
  name: string,
): ISongSoundSettings | undefined =>
  cleanSavedEqName(name) === ''
    ? undefined
    : replaceEq(settings, id, (eq) => ({
        ...eq,
        name: uniqueSavedEqName(name, takenNames(settings, id)),
      }));

/**
 * Deleted, and every song and album that followed it keeps the sound it had
 * as its own (Ivan approved, 2026-11-20: nothing lost by a delete). Their save
 * time stays: what they play has not changed.
 */
export const deleteSavedEq = (
  settings: ISongSoundSettings,
  id: string,
): ISongSoundSettings => {
  const eq = settings.eqs.find((one) => one.id === id);
  if (!eq) {
    return settings;
  }
  const copied = (sound: TStoredSound): TStoredSound =>
    isEqLink(sound) && sound.eqId === id ? eq.sound : sound;
  const entries: Record<string, ISongSoundEntry> = {};
  Object.entries(settings.songs.entries).forEach(([key, entry]) => {
    entries[key] = { ...entry, sound: copied(entry.sound) };
  });
  const albums: Record<string, IAlbumSoundEntry> = {};
  Object.entries(settings.albums).forEach(([key, album]) => {
    albums[key] = { ...album, sound: copied(album.sound) };
  });
  return {
    ...settings,
    songs: { ...settings.songs, entries },
    albums,
    eqs: settings.eqs.filter((one) => one.id !== id),
  };
};
