/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The core's real Library player behind the window's bridge, for tests that
 * render the window's player: its presses reach `createLibraryPlayer` the way
 * main's channels hand them over, and its view and clock come back the way
 * main pushes them. No native host by default, so every song plays on the
 * window's element — what a machine without the host (Linux) does.
 */
import {
  PLAYER_RACK_CHANNEL,
  parsePlayerRackCopy,
} from '../../common/library/playerRack';
import {
  LIBRARY_PLAYER_CHANNEL,
  parseDeckReport,
  parsePlayerCommand,
} from '../../common/library/playerWire';
import {
  restoreSession,
  type IPlaybackMemory,
} from '../../common/library/playbackMemory';
import type { ILibraryTrack } from '../../common/library/types';
import createLibraryPlayer from '../../main/libraryPlayer/libraryPlayer';
import type { ILibraryPlayer } from '../../main/libraryPlayer/libraryPlayerTypes';
import type {
  IHostEngine,
  IHostEngineEvents,
} from '../../main/libraryPlayer/hostEngine';
import type { ISourcePublication } from '../../main/libraryPlayer/sourcePublication';

type TListener = (...args: unknown[]) => void;
type TIpcRenderer = Window['electron']['ipcRenderer'];

export interface ICorePlayerBridge {
  player: ILibraryPlayer;
  /** The window bridge's two generic members, backed by the core. */
  bridge: Pick<TIpcRenderer, 'sendMessage' | 'on'>;
  /** What the window sent, by channel, for a test to read. */
  sent: { channel: string; args: unknown[] }[];
  /** Everything the session kept, newest last. */
  kept: { positionMs: number; ids?: readonly string[] }[];
}

const quietSources = (): ISourcePublication => ({
  setSource: () => undefined,
  markBoundary: () => undefined,
  setPlayback: () => undefined,
  prepareStart: () => Promise.resolve(false),
  release: () => Promise.resolve(true),
});

export const createCorePlayerBridge = (options: {
  /** The library the core reads songs from, by id, at the moment it asks. */
  tracks: () => readonly ILibraryTrack[];
  memory?: IPlaybackMemory;
  host?: (events: IHostEngineEvents) => IHostEngine;
}): ICorePlayerBridge => {
  const listeners = new Map<string, Set<TListener>>();
  const emit = (channel: string, ...args: unknown[]) =>
    [...(listeners.get(channel) ?? [])].forEach((listener) =>
      listener(...args),
    );
  const sent: ICorePlayerBridge['sent'] = [];
  const kept: ICorePlayerBridge['kept'] = [];
  let { memory } = options;
  const lookup = (ids: readonly string[]) => {
    const all = new Map(options.tracks().map((track) => [track.id, track]));
    return ids
      .map((id) => all.get(id))
      .filter((track): track is ILibraryTrack => track !== undefined);
  };
  const player = createLibraryPlayer({
    library: { tracks: lookup, continuation: () => [] },
    ...(options.host ? { createHost: options.host } : {}),
    sources: quietSources(),
    session: {
      isContinuationOn: () => true,
      restore: (tracks) => {
        if (!memory) {
          return undefined;
        }
        const found = tracks(memory.trackIds);
        return restoreSession(
          memory,
          new Map(found.map((track) => [track.id, track.durationMs])),
        );
      },
      keep: (queue, positionMs) => {
        kept.push({ positionMs, ...(queue ? { ids: queue.trackIds } : {}) });
      },
      adoptLegacy: () => {
        memory = undefined;
        return false;
      },
    },
    window: {
      view: (view) => emit(LIBRARY_PLAYER_CHANNEL.view, view),
      clock: (clock) => emit(LIBRARY_PLAYER_CHANNEL.clock, clock),
    },
  });
  const first = (args: unknown[]) => args[0];
  const on = (channel: string, listener: TListener) => {
    const set = listeners.get(channel) ?? new Set<TListener>();
    set.add(listener);
    listeners.set(channel, set);
    return () => {
      set.delete(listener);
    };
  };
  return {
    player,
    sent,
    kept,
    bridge: {
      sendMessage: (channel, args, requestId) => {
        sent.push({ channel, args });
        switch (channel) {
          case LIBRARY_PLAYER_CHANNEL.command: {
            const command = parsePlayerCommand(first(args));
            if (command) {
              const joined = player.command(command).joined ?? 0;
              if (requestId !== undefined) {
                emit(channel, { result: joined }, requestId);
              }
            }
            return;
          }
          case LIBRARY_PLAYER_CHANNEL.deck: {
            const report = parseDeckReport(first(args));
            if (report) {
              player.deckReport(report);
            }
            return;
          }
          case PLAYER_RACK_CHANNEL: {
            const copy = parsePlayerRackCopy(first(args));
            if (copy) {
              player.rackCopy(copy);
            }
            return;
          }
          case LIBRARY_PLAYER_CHANNEL.ask:
            player.ask();
            return;
          case LIBRARY_PLAYER_CHANNEL.away:
            player.away();
            return;
          case LIBRARY_PLAYER_CHANNEL.legacy:
            player.legacy(first(args));
            break;
          default:
        }
      },
      // The preload's own answers its `removeListener`; nothing here reads it.
      on: on as unknown as TIpcRenderer['on'],
    },
  };
};
