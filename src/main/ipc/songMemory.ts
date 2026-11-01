/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow, IpcMainEvent } from 'electron';
import type { ISongIdentity, TSongSource } from '../../common/songIdentity';
import { SONG_MEMORY_CHANNEL } from '../../common/songMemoryStatus';
import type { TSongMemory } from '../songMemory';
import onWindowMessage from './windowMessages';

const MAX_TEXT = 2048;
const SOURCES: readonly string[] = [
  'library',
  'karaoke',
  'media',
  'system',
  'remote',
] satisfies readonly TSongSource[];

const isText = (value: unknown, isOptional = false): boolean =>
  (isOptional && value === undefined) ||
  (typeof value === 'string' && value.length <= MAX_TEXT);

/** A song's identity as the window names it, or nothing that is not one. */
export const toSongIdentity = (value: unknown): ISongIdentity | undefined => {
  if (typeof value !== 'object' || value === null) {
    return undefined;
  }
  const { key, alias, title, artist, source } = value as Record<
    string,
    unknown
  >;
  if (
    !isText(key) ||
    key === '' ||
    !isText(title) ||
    !isText(alias, true) ||
    !isText(artist, true) ||
    typeof source !== 'string' ||
    !SOURCES.includes(source)
  ) {
    return undefined;
  }
  return {
    key: key as string,
    title: title as string,
    source: source as TSongSource,
    ...(alias === undefined ? {} : { alias: alias as string }),
    ...(artist === undefined ? {} : { artist: artist as string }),
  };
};

/**
 * The window's side of the song memory, which runs in the core
 * (`songMemory.ts`): what the window's players play and when time passes for
 * them, the cards' buttons and the switch — taken from the window's own top
 * frame only, and checked as anything from a page is.
 */
const registerSongMemoryIpc = ({
  getMainWindow,
  memory,
}: {
  getMainWindow: () => BrowserWindow | null;
  memory: Pick<
    TSongMemory,
    | 'status'
    | 'nowPlaying'
    | 'tick'
    | 'undo'
    | 'dontSave'
    | 'forgetNoticed'
    | 'endNotice'
    | 'setOn'
    | 'handOver'
  >;
}): (() => void) => {
  const fromWindow = (event: IpcMainEvent) => {
    const window = getMainWindow();
    return (
      !!window &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    );
  };
  const args = (arg: unknown): unknown[] => (Array.isArray(arg) ? arg : []);
  const stops = [
    onWindowMessage(SONG_MEMORY_CHANNEL.ask, (event) => {
      if (fromWindow(event)) {
        event.sender.send(SONG_MEMORY_CHANNEL.status, memory.status());
      }
    }),
    onWindowMessage(SONG_MEMORY_CHANNEL.nowPlaying, (event, arg: unknown) => {
      const [identity, isPlaying] = args(arg);
      if (!fromWindow(event) || typeof isPlaying !== 'boolean') {
        return;
      }
      // Nothing named is nothing playing; a name that is not one is ignored
      // rather than read as a stop.
      const named = toSongIdentity(identity);
      if (identity !== undefined && identity !== null && !named) {
        return;
      }
      memory.nowPlaying(named, isPlaying);
    }),
    onWindowMessage(SONG_MEMORY_CHANNEL.tick, (event) => {
      if (fromWindow(event)) {
        memory.tick();
      }
    }),
    onWindowMessage(SONG_MEMORY_CHANNEL.action, (event, arg: unknown) => {
      const [action] = args(arg);
      if (!fromWindow(event) || typeof action !== 'object' || !action) {
        return;
      }
      const asked = action as Record<string, unknown>;
      if (asked.kind === 'undo') {
        memory.undo();
      } else if (asked.kind === 'dontSave') {
        memory.dontSave();
      } else if (asked.kind === 'forget') {
        memory.forgetNoticed();
      } else if (asked.kind === 'endNotice' && Number.isSafeInteger(asked.id)) {
        memory.endNotice(asked.id as number);
      } else if (asked.kind === 'setOn' && typeof asked.isOn === 'boolean') {
        memory.setOn(asked.isOn);
      }
    }),
    onWindowMessage(SONG_MEMORY_CHANNEL.handOver, (event, arg: unknown) => {
      const [wasOn] = args(arg);
      if (fromWindow(event) && typeof wasOn === 'boolean') {
        memory.handOver(wasOn);
      }
    }),
  ];
  return () => stops.forEach((stop) => stop());
};

export default registerSongMemoryIpc;
