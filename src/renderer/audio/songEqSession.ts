/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import { useEffect, useSyncExternalStore } from 'react';
import {
  type ISongEqNotice,
  type ISongEqStatus,
  NO_SONG_EQ_STATUS,
  SONG_EQ_CHANNEL,
  type TSongEqAction,
} from 'common/songEqStatus';
import { useTransportSources } from './transportSource';

/**
 * The window's view of the Smart EQ song memory, which runs in the app's
 * core (`main/songEqMemory.ts`): the badge's count, the switch and the "we
 * remembered this" card as the core says them, and the buttons that answer
 * them. What plays the core hears from the window's players
 * (`SongSoundHost`), and the layer and the running mode it reads for itself.
 */

let status: ISongEqStatus = NO_SONG_EQ_STATUS;

const listeners = new Set<() => void>();
const subscribe = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Optional, like every bridge call: a test's partial bridge has none. */
const send = (channel: string, args: unknown[]): void =>
  window.electron?.ipcRenderer?.sendMessage?.(channel, args);

const act = (action: TSongEqAction): void =>
  send(SONG_EQ_CHANNEL.action, [action]);

const isStatus = (value: unknown): value is ISongEqStatus =>
  typeof value === 'object' &&
  value !== null &&
  typeof (value as ISongEqStatus).isSaveOn === 'boolean' &&
  typeof (value as ISongEqStatus).listenedMs === 'number' &&
  typeof (value as ISongEqStatus).willSave === 'boolean' &&
  typeof (value as ISongEqStatus).needsClock === 'boolean';

/** Follow what the core says from now on: asked once, then told. */
const followSongEq = (): (() => void) => {
  const off = window.electron?.ipcRenderer?.on?.(
    SONG_EQ_CHANNEL.status,
    (payload) => {
      if (isStatus(payload)) {
        status = payload;
        listeners.forEach((listener) => listener());
      }
    },
  );
  send(SONG_EQ_CHANNEL.ask, []);
  return () => off?.();
};

const read = () => status;

export const useSongEqRecording = (): ISongEqStatus =>
  useSyncExternalStore(subscribe, read, () => NO_SONG_EQ_STATUS);

export const useSongEqNotice = (): ISongEqNotice | undefined =>
  useSyncExternalStore(
    subscribe,
    () => status.notice,
    () => undefined,
  );

export const useSongEqSaveOn = (): boolean =>
  useSyncExternalStore(
    subscribe,
    () => status.isSaveOn,
    () => false,
  );

/**
 * The switch, and nothing more than the switch: whether it is honoured is
 * the core's — saving is refused without a running mode to file.
 */
export const setSongEqSaveOn = (isSaveOn: boolean): void =>
  act({ kind: 'setSaveOn', isSaveOn });

export const undoSongEqLoan = (): void => act({ kind: 'undo' });

/** Forgets the song the card names, on this output. */
export const forgetCurrentSongEq = (): void => act({ kind: 'forget' });

/**
 * The card named by `id` has been on screen for its whole moment, reported
 * by the card itself at the end of its own linger. Fading is not undoing:
 * the loaned layer keeps playing.
 */
export const endSongEqNotice = (id: number): void =>
  act({ kind: 'endNotice', id });

/**
 * The window's half of the song memory, for the component that lives as long
 * as the window: it follows what the core says, and — only while the core
 * asks, because it cannot hear the output — says when time passes for the
 * players: every position a player reports while it plays is time passing.
 *
 * `useTransportSources` changes with every position, so the component that
 * calls this draws nothing (`SongEqNotice`'s clock).
 */
export const useSongEqClock = (): void => {
  const sources = useTransportSources();
  const needsClock = useSyncExternalStore(
    subscribe,
    () => status.needsClock,
    () => false,
  );
  useEffect(() => followSongEq(), []);
  useEffect(() => {
    if (needsClock) {
      send(SONG_EQ_CHANNEL.tick, []);
    }
  }, [sources, needsClock]);
};
