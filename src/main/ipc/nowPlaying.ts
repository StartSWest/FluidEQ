/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { BrowserWindow, IpcMainEvent } from 'electron';
import NOW_PLAYING_CHANNEL from '../../common/nowPlaying';
import type { ISongIdentity, TSongSource } from '../../common/songIdentity';
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

export interface INowPlayingReport {
  identity: ISongIdentity | undefined;
  isPlaying: boolean;
  /** The Library plays it, through FluidEQ's own host. */
  isLibrary: boolean;
}

/**
 * What the window's players play (`common/nowPlaying.ts`), taken from the
 * window's own top frame only and checked as anything from a page is.
 */
const registerNowPlayingIpc = ({
  getMainWindow,
  onNowPlaying,
}: {
  getMainWindow: () => BrowserWindow | null;
  onNowPlaying: (report: INowPlayingReport) => void;
}): (() => void) => {
  const fromWindow = (event: IpcMainEvent) => {
    const window = getMainWindow();
    return (
      !!window &&
      event.sender === window.webContents &&
      event.senderFrame === window.webContents.mainFrame
    );
  };
  return onWindowMessage(NOW_PLAYING_CHANNEL, (event, arg: unknown) => {
    const [identity, isPlaying, isLibrary] = Array.isArray(arg) ? arg : [];
    if (
      !fromWindow(event) ||
      typeof isPlaying !== 'boolean' ||
      typeof isLibrary !== 'boolean'
    ) {
      return;
    }
    // Nothing named is nothing playing; a name that is not one is ignored
    // rather than read as a stop.
    const named = toSongIdentity(identity);
    if (identity !== undefined && identity !== null && !named) {
      return;
    }
    onNowPlaying({ identity: named, isPlaying, isLibrary });
  });
};

export default registerNowPlayingIpc;
