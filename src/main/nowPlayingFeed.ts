/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * What is being equalised, for the core's jobs that follow songs — the song
 * memories and Smart EQ's running mode — said by the window while it is
 * there, and worked out here while it is not.
 *
 * The window names it from every player it has (`SongSoundHost`,
 * `nowPlayingIdentity.ts`). A window let go in the tray (`windowUnload.ts`)
 * names nothing, and the last song it named would stand for every song after
 * it: the memories filing an evening under one title, Smart EQ measuring a
 * playlist as one record. With no window the only players left are the ones
 * main hears for itself — the Library on its host and the machine's own
 * player, read by the media watcher — and this names those the way the
 * window does (`pickPlayingIdentity`): a player of ours playing first, then
 * the machine's while it says it plays, and otherwise the last one heard,
 * paused.
 *
 * A page that loads takes over with its first word; one that leaves — let
 * go, reloaded or crashed — hands back to this at once, carrying the last
 * thing it named so a pause stays a pause.
 */
import type { ILibraryPlayerView } from '../common/library/playerWire';
import { buildSongIdentity, type ISongIdentity } from '../common/songIdentity';
import type { INowPlayingReport } from './ipc/nowPlaying';
import type { ISystemMediaSnapshot } from './systemMedia';

export interface INowPlayingFeed {
  /** What the page's players play, as it says it. */
  pageSaid: (report: INowPlayingReport) => void;
  /** The page went without a word. */
  pageLeft: () => void;
  /** Every view main's Library player sends. */
  libraryViewed: (view: ILibraryPlayerView) => void;
  /** Every reading of the machine's own player. */
  systemSaid: (snapshot: ISystemMediaSnapshot | undefined) => void;
}

interface IHeard {
  identity: ISongIdentity | undefined;
  isPlaying: boolean;
}

const NOTHING: IHeard = { identity: undefined, isPlaying: false };

export const createNowPlayingFeed = (
  onNowPlaying: (report: INowPlayingReport) => void,
): INowPlayingFeed => {
  let isPageSpeaking = false;
  let library = NOTHING;
  let system = NOTHING;
  /** The last thing heard playing, by anybody: what a pause is a pause of. */
  let lastPlaying: ISongIdentity | undefined;
  let told = '';

  const tell = (report: INowPlayingReport) => {
    const key = JSON.stringify(report);
    if (key !== told) {
      told = key;
      onNowPlaying(report);
    }
  };

  const windowless = (): INowPlayingReport => {
    if (library.isPlaying && library.identity) {
      return { identity: library.identity, isPlaying: true, isLibrary: true };
    }
    if (system.isPlaying && system.identity) {
      return { identity: system.identity, isPlaying: true, isLibrary: false };
    }
    return { identity: lastPlaying, isPlaying: false, isLibrary: false };
  };

  const heard = () => {
    const now = windowless();
    if (now.isPlaying) {
      lastPlaying = now.identity;
    }
    if (!isPageSpeaking) {
      tell(now);
    }
  };

  return {
    pageSaid: (report) => {
      // A page that has heard nothing yet says so first — its players and the
      // media watcher's reading arrive a moment after it mounts — and taken
      // at its word that ended the song a memory was following every time
      // the window was opened from the tray. It takes over once it names
      // something; until then what main hears stands.
      if (!isPageSpeaking && !report.identity && !report.isPlaying) {
        return;
      }
      isPageSpeaking = true;
      if (report.isPlaying || report.identity) {
        lastPlaying = report.identity;
      }
      tell(report);
    },
    pageLeft: () => {
      isPageSpeaking = false;
      heard();
    },
    libraryViewed: (view) => {
      // Only the host plays with no page; the page's own element went with it.
      library =
        view.track && view.deck === 'host'
          ? {
              identity: buildSongIdentity(
                'library',
                view.track.id,
                view.track.title,
                view.track.artist,
              ),
              isPlaying: view.isPlaying,
            }
          : NOTHING;
      heard();
    },
    systemSaid: (snapshot) => {
      system = snapshot
        ? {
            identity: buildSongIdentity(
              'system',
              snapshot.app,
              snapshot.title,
              snapshot.artist,
            ),
            isPlaying: snapshot.isPlaying,
          }
        : NOTHING;
      heard();
    },
  };
};
