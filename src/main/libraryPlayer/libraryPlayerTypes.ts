/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What the core's Library player (`libraryPlayer.ts`) is built from and
 * what it offers the rest of main.
 */
import type { IPlayerRackCopy } from '../../common/library/playerRack';
import type {
  ILibraryPlayerAnswer,
  ILibraryPlayerClock,
  ILibraryPlayerView,
  TLibraryPlayerCommand,
  TWindowDeckReport,
} from '../../common/library/playerWire';
import type { ILibraryTrack } from '../../common/library/types';
import type { IHostEngine, IHostEngineEvents } from './hostEngine';
import type { IPlaybackSession } from './playbackSession';
import type { ISourcePublication } from './sourcePublication';

export interface ILibraryPlayerLibrary {
  /** The songs the library has of these ids, synchronously. */
  tracks: (ids: readonly string[]) => ILibraryTrack[];
  continuation: (
    seedId: string,
    exclude: readonly string[],
    count: number,
  ) => string[];
}

/** How the player reaches the window; a window that is not there drops it. */
export interface ILibraryPlayerWindow {
  view: (view: ILibraryPlayerView) => void;
  clock: (clock: ILibraryPlayerClock) => void;
}

export interface ILibraryPlayerDeps {
  library: ILibraryPlayerLibrary;
  /** The host engine, built round this player's events; none: no host. */
  createHost?: (events: IHostEngineEvents) => IHostEngine;
  sources: ISourcePublication;
  session: IPlaybackSession;
  window: ILibraryPlayerWindow;
}

export interface ILibraryPlayer {
  command: (command: TLibraryPlayerCommand) => ILibraryPlayerAnswer;
  deckReport: (report: TWindowDeckReport) => void;
  rackCopy: (copy: IPlayerRackCopy) => void;
  /** The window's old copy of the session, handed over once. */
  legacy: (raw: unknown) => void;
  /** The window put its Library player away; see `hostWanted`. */
  away: () => void;
  /** These songs changed in the library, or every one may have (undefined). */
  tracksChanged: (trackIds?: readonly string[]) => void;
  /** The window wants the view and the clock again. */
  ask: () => void;
  close: () => Promise<void>;
}
