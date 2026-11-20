/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useSyncExternalStore } from 'react';
import log from 'electron-log/renderer';
import ChannelEnum from 'common/channels';
import type {
  ILibrarySongSound,
  ISavedEqSummary,
  ISongSoundIndex,
} from 'common/songSoundMemory';
import {
  getSongSoundIndex,
  nameLibrarySongSounds,
} from '../utils/songSoundApi';

/**
 * Which Library songs and albums have a sound of their own, for everything
 * that shows it — the Library's rows, menus and Details, Auto EQ's Manage —
 * asked of main once while anything shows it, and again whenever main says
 * what is kept changed (`SONG_SOUNDS_CHANGED`).
 *
 * Songs kept before Auto EQ are filed without a track id, which the store
 * cannot read back from the fingerprint they are filed under; the first time
 * an index says so, the Library's track ids are handed to main once to name
 * them (`nameLibrarySongSounds`).
 */
export interface ISongSoundIndexView {
  index?: ISongSoundIndex;
  songs: ReadonlyMap<string, ILibrarySongSound>;
  albums: ReadonlyMap<string, ISongSoundIndex['albums'][number]>;
  /** The saved EQs, newest saved last, and each by its id. */
  eqs: readonly ISavedEqSummary[];
  eqById: ReadonlyMap<string, ISavedEqSummary>;
}

/** One request names at most this many; main bounds what it takes. */
const NAMING_BATCH = 20000;

/** Every song the Library can list, which is what main is asked about. */
const NAMING_QUERY_LIMIT = 100000;

const EMPTY: ISongSoundIndexView = {
  songs: new Map(),
  albums: new Map(),
  eqs: [],
  eqById: new Map(),
};

const listeners = new Set<() => void>();
let view: ISongSoundIndexView = EMPTY;
let unsubscribeMain: (() => void) | undefined;
let hasNamed = false;
let asking = 0;

const emit = () => listeners.forEach((listener) => listener());

const toView = (index: ISongSoundIndex): ISongSoundIndexView => ({
  index,
  songs: new Map(index.songs.map((song) => [song.trackId, song])),
  albums: new Map(index.albums.map((album) => [album.key, album])),
  eqs: index.eqs,
  eqById: new Map(index.eqs.map((eq) => [eq.id, eq])),
});

/** The Library's track ids, handed to main in batches it accepts. */
const nameSongs = async (): Promise<void> => {
  const ids = await window.electron.ipcRenderer.queryLibrary({
    type: 'ids',
    query: { shelf: 'tracks', scope: { kind: 'audio' }, direction: 'asc' },
    offset: 0,
    limit: NAMING_QUERY_LIMIT,
  });
  for (let start = 0; start < ids.length; start += NAMING_BATCH) {
    // One after another: each batch writes the store.
    // eslint-disable-next-line no-await-in-loop -- see above
    await nameLibrarySongSounds(ids.slice(start, start + NAMING_BATCH));
  }
};

const ask = (): void => {
  asking += 1;
  const mine = asking;
  getSongSoundIndex()
    .then((index) => {
      // An answer overtaken by a newer question is about an older store.
      if (mine !== asking) {
        return undefined;
      }
      view = toView(index);
      emit();
      if (index.hasUnnamed && !hasNamed) {
        hasNamed = true;
        return nameSongs();
      }
      return undefined;
    })
    .catch((error: unknown) => {
      // The labels stay as they were; the next change asks again.
      log.error('The Library’s song sounds could not be read', error);
    });
};

const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  if (!unsubscribeMain) {
    unsubscribeMain = window.electron.ipcRenderer.on(
      ChannelEnum.SONG_SOUNDS_CHANGED,
      ask,
    );
    ask();
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && unsubscribeMain) {
      unsubscribeMain();
      unsubscribeMain = undefined;
    }
  };
};

export const useSongSoundIndex = (): ISongSoundIndexView =>
  useSyncExternalStore(
    subscribe,
    () => view,
    () => EMPTY,
  );
