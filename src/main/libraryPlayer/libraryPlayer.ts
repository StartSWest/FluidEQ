/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Library player, in the app's core.
 *
 * It owns what plays: the queue and every press that moves it, when a song
 * ends and when the next one fades in, the session kept across restarts, and
 * the songs continuation draws. It drives the deck that makes the sound —
 * the native host for every song it can play (`hostEngine.ts`), and the
 * window's own element for a video or a song the host cannot play — and it
 * tells the window what to draw. A song therefore moves on and fades into the
 * next whether a window is open, hidden or reloading.
 *
 * Every press is a pure step on the player's state (`common/library/
 * playerState.ts`, `playerCommands.ts`); `settle` then brings the decks, the
 * rack and the window to what the state says. Nothing here waits on a clock:
 * a song ends when its deck says so, and the next fades in when the deck's
 * own position says the music is about to run out.
 */
import { isCrossfadeDue } from '../../common/library/crossfadeTiming';
import {
  type IPendingSeek,
  holdSeek,
  seekAnswered,
  seekSettled,
} from '../../common/library/pendingSeek';
import {
  type ILibraryPlayerState,
  INITIAL_PLAYER_STATE,
  crossfadeDue,
  mayCrossfadeOut,
  playingTrackId,
  restoreCued,
  restoredState,
  setPlaying,
  trackEnded,
  trackFailed,
} from '../../common/library/playerState';
import { continuationDrawn } from '../../common/library/queueEdits';
import type {
  IWindowDeckWant,
  TLibraryDeckOwner,
} from '../../common/library/playerWire';
import { advanceQueue, currentTrackId } from '../../common/library/queue';
import type { ILibraryTrack } from '../../common/library/types';
import {
  deckOwnerFor,
  fadeOverAtMs,
  hostWanted,
  naturalFadeMs,
  transitionFor,
  upcomingFor,
} from './deckWants';
import type { IHostDeckWant } from './hostDeckTypes';
import type { IHostClock, IHostEngine, THostEngineState } from './hostEngine';
import { createContinuationDraw } from './continuationDraw';
import { createLibraryRack } from './libraryRack';
import type { ILibraryPlayer, ILibraryPlayerDeps } from './libraryPlayerTypes';
import { runPlayerCommand } from './playerCommands';
import {
  type IHeardClock,
  type IPlayerSnapshot,
  cuePositionOf,
  publishedClockOf,
} from './playerView';
import { createTrackLevels } from './trackLevels';
import createViewSender from './viewSender';

const createLibraryPlayer = (deps: ILibraryPlayerDeps): ILibraryPlayer => {
  const { library, sources, session, window } = deps;
  let state: ILibraryPlayerState = {
    ...INITIAL_PLAYER_STATE,
    isContinuationOn: session.isContinuationOn(),
  };
  /** The id the queue was on when `track` was last looked up. */
  let resolvedId: string | undefined;
  let track: ILibraryTrack | undefined;
  let next: ILibraryTrack | undefined;
  let owner: TLibraryDeckOwner = 'none';
  /** The deck the song before this one played on. */
  let previousOwner: TLibraryDeckOwner | undefined;
  let refusedTrackId: string | undefined;
  /** The window's Library player is out, on a window that is seen. */
  let windowHasPlayer = false;
  let isWindowSeen = false;
  let host: IHostEngine | undefined;
  let hostState: THostEngineState = 'idle';
  /** The file the host's playing deck holds, so its clock is that song's. */
  let hostActivePath: string | undefined;
  let hostOwns = false;
  let clock: IHeardClock = { positionMs: 0, durationMs: 0 };
  let pendingSeek: IPendingSeek | undefined;
  /** The song whose end already counted, so a held "ended" counts once. */
  let endedTrackId: string | undefined;
  /** The song whose natural overlap already started. */
  let fadedFromTrackId: string | undefined;
  let windowSeek: IWindowDeckWant['seek'];
  const continuation = createContinuationDraw(library.continuation);
  let closed = false;

  const lookup = (id: string | undefined): ILibraryTrack | undefined =>
    id === undefined ? undefined : library.tracks([id])[0];

  const rack = createLibraryRack({
    sources,
    pushLine: (line) => host?.pushChain(line) ?? Promise.resolve(false),
  });

  const levels = createTrackLevels(
    {
      setTrackGains: (input, master) => host?.setTrackGains(input, master),
      setNoiseProfile: (profile) => host?.setNoiseProfile(profile),
    },
    sources,
    rack.settings,
  );

  const snapshot = (): IPlayerSnapshot => {
    const copy = rack.copy();
    return {
      state,
      ...(track ? { track } : {}),
      owner,
      hostState,
      ...(previousOwner ? { previousOwner } : {}),
      ...(copy ? { rack: copy } : {}),
      clock,
      ...(pendingSeek ? { pendingSeek } : {}),
      ...(windowSeek ? { windowSeek } : {}),
      libraryGate: rack.gate(),
    };
  };

  const { view: sendView, clock: sendClock } = createViewSender(
    window,
    snapshot,
  );

  /** Where the queue is, kept for the next launch. */
  const keepSession = (): void =>
    session.keep(
      state.queue,
      publishedClockOf(snapshot()).positionMs,
      state.isContinuationOn,
    );

  // The window adopts the player's half of the gate from the view.
  rack.onGate(() => sendView());

  const hostWant = (): IHostDeckWant =>
    owner === 'host' && track
      ? {
          mediaPath: track.path,
          isPlaying: state.isPlaying,
          positionMs: cuePositionOf(snapshot()),
          upcoming: upcomingFor(track, next),
          transition: transitionFor(rack.copy(), track),
        }
      : { mediaPath: undefined, isPlaying: false, positionMs: 0 };

  const seekCurrent = (positionMs: number): void => {
    const target = Math.max(0, positionMs);
    if (owner === 'host' && host) {
      const pending = holdSeek(target);
      pendingSeek = pending;
      sendClock();
      host
        .seek(target)
        .then((applied) => {
          if (applied) {
            // The same song, a new passage, for the engine's analysis.
            sources.markBoundary();
          }
          // A later seek has the bar; this answer is about an earlier one.
          if (pendingSeek === pending) {
            pendingSeek = seekAnswered(
              pending,
              applied,
              clock.positionMs / 1_000,
            );
            sendClock();
          }
          return undefined;
        })
        .catch(() => undefined);
      return;
    }
    if (owner === 'window') {
      windowSeek = { id: (windowSeek?.id ?? 0) + 1, positionMs: target };
      clock = { ...clock, positionMs: target };
      sendView();
      sendClock();
    }
  };

  /** The song moved on: everything that was about the one before is reset. */
  const songChanged = (): void => {
    const before = track;
    resolvedId = playingTrackId(state);
    track = lookup(resolvedId);
    if (resolvedId !== undefined && track === undefined) {
      // The library no longer has the song the queue is on — its folder was
      // removed — so it stops rather than play on with no bar.
      state = { ...state, isPlaying: false };
    }
    previousOwner = before ? owner : undefined;
    refusedTrackId = undefined;
    endedTrackId = undefined;
    pendingSeek = undefined;
    windowSeek = undefined;
    clock = {
      ...(track ? { trackId: track.id } : {}),
      positionMs: 0,
      durationMs: track?.durationMs ?? 0,
    };
    if (track) {
      continuation.played(track.id);
    }
    // A song coming in over one the host is playing fades, and what is sent
    // about it waits for the fade to be over (`trackLevels.ts`).
    levels.trackChanged(
      track,
      before !== undefined &&
        owner === 'host' &&
        state.isPlaying &&
        track?.kind === 'audio'
        ? fadeOverAtMs(rack.copy(), track)
        : undefined,
    );
  };

  /** Bring the decks, the rack, the window and the session to the state. */
  const settle = (): void => {
    if (closed) {
      return;
    }
    const changed = playingTrackId(state) !== resolvedId;
    if (changed) {
      songChanged();
    }
    const picked = continuation.draw(state, track);
    if (picked.length > 0) {
      state = continuationDrawn(state, picked);
      settle();
      return;
    }
    const nextId = state.queue
      ? currentTrackId(advanceQueue(state.queue, 1))
      : undefined;
    next =
      nextId === undefined || nextId === track?.id ? undefined : lookup(nextId);
    owner = deckOwnerFor({
      track,
      failedTrackId: state.failedTrackId,
      refusedTrackId,
      hostAvailable: host !== undefined,
      hostState,
    });
    if (track && !track.isPlayable && state.isPlaying) {
      state = { ...state, isPlaying: false };
    }
    host?.setEngaged(
      hostWanted({
        track,
        hasRack: rack.copy() !== undefined,
        isPlaying: state.isPlaying,
        windowHasPlayer,
        isWindowSeen,
      }),
    );
    host?.sync(hostWant());
    rack.setWanted(owner === 'host' && state.isPlaying);
    sendView();
    sendClock(changed);
    keepSession();
  };

  /** The song just finished, as its deck said. */
  const ended = (trackId: string): void => {
    if (endedTrackId === trackId || trackId !== track?.id) {
      return;
    }
    endedTrackId = trackId;
    const result = trackEnded(state);
    if (result.restart) {
      // Repeat one: the song comes back on the deck that played it, and its
      // next end counts again.
      endedTrackId = undefined;
      seekCurrent(0);
      return;
    }
    state = result.state;
    settle();
  };

  /** A clock reading for the current song, from the deck that plays it. */
  const heard = (positionMs: number, durationMs: number): void => {
    if (!track) {
      return;
    }
    // A length the deck cannot give — a decoder that could not say, or
    // Chromium answering Infinity mid-song — keeps the one already known:
    // written through as nought it collapsed the seek bar mid-song.
    const known =
      clock.trackId === track.id && clock.durationMs > 0
        ? clock.durationMs
        : (track.durationMs ?? 0);
    clock = {
      trackId: track.id,
      positionMs,
      durationMs: durationMs > 0 ? durationMs : known,
    };
    levels.heardAt(track.id, positionMs);
    state = restoreCued(state, track.id);
    const fadeMs = naturalFadeMs(rack.copy());
    if (
      fadeMs !== undefined &&
      state.isPlaying &&
      fadedFromTrackId !== track.id &&
      mayCrossfadeOut(state) &&
      isCrossfadeDue({
        positionMs,
        durationMs: clock.durationMs,
        edges: track.normalization?.edges,
        fadeMs,
      })
    ) {
      // The overlap starts while there is still music to overlap with.
      fadedFromTrackId = track.id;
      state = crossfadeDue(state);
      settle();
      return;
    }
    sendClock();
  };

  const onHostClock = (frame: IHostClock): void => {
    if (
      pendingSeek &&
      seekSettled(pendingSeek, frame.positionMs / 1_000, hostOwns)
    ) {
      pendingSeek = undefined;
    }
    if (
      owner !== 'host' ||
      !track ||
      hostActivePath !== track.path ||
      !frame.hasSource
    ) {
      return;
    }
    heard(frame.positionMs, frame.durationMs);
    if (frame.ended) {
      ended(track.id);
    }
  };

  host = deps.createHost?.({
    onState: (nextState) => {
      const was = hostState;
      hostState = nextState;
      if (nextState === 'engaged' && was !== 'engaged') {
        // Up again: the song's levels it missed while down.
        levels.resend();
      }
      settle();
    },
    onClock: onHostClock,
    onOwnership: (owns) => {
      hostOwns = owns;
      rack.setHostOwns(owns);
    },
    onRefused: (mediaPath) => {
      if (track?.path === mediaPath) {
        // The window's element plays what the host cannot open.
        refusedTrackId = track.id;
        settle();
      }
    },
    onActive: (mediaPath) => {
      hostActivePath = mediaPath;
    },
    preparePlayback: rack.prepare,
    finishPlayback: rack.finish,
    wantAfterReopen: hostWant,
  });

  const restore = (): void => {
    state = restoredState(state, session.restore(library.tracks));
  };
  restore();
  settle();

  return {
    command: (command) => {
      const result = runPlayerCommand(state, command, {
        positionMs: publishedClockOf(snapshot()).positionMs,
        restartsOnPlay: owner === 'host' && endedTrackId === track?.id,
      });
      state = result.state;
      if (result.stop) {
        fadedFromTrackId = undefined;
      }
      if (result.seekMs !== undefined) {
        if (result.seekMs === 0) {
          endedTrackId = undefined;
        }
        seekCurrent(result.seekMs);
      }
      settle();
      return result.answer;
    },

    deckReport: (report) => {
      if (owner !== 'window' || report.trackId !== track?.id) {
        return;
      }
      switch (report.kind) {
        case 'clock':
          heard(report.positionMs, report.durationMs);
          return;
        case 'ended':
          ended(report.trackId);
          return;
        case 'playing':
          state = setPlaying(state, report.isPlaying);
          settle();
          return;
        default:
          state = trackFailed(state, report.trackId);
          settle();
      }
    },

    rackCopy: (copy) => {
      windowHasPlayer = true;
      rack.setCopy(copy);
      levels.settingsChanged();
      settle();
    },

    away: () => {
      windowHasPlayer = false;
      settle();
    },

    windowSeen: (isSeen) => {
      isWindowSeen = isSeen;
      settle();
    },

    legacy: (raw) => {
      if (!session.adoptLegacy(raw)) {
        return;
      }
      state = { ...state, isContinuationOn: session.isContinuationOn() };
      if (!state.queue) {
        restore();
      }
      settle();
    },

    tracksChanged: (trackIds) => {
      if (track && (trackIds === undefined || trackIds.includes(track.id))) {
        const fresh = lookup(track.id);
        if (fresh) {
          track = fresh;
          levels.measured(fresh);
        } else {
          // Its folder went: settle finds the song gone and stops.
          resolvedId = undefined;
        }
      }
      settle();
    },

    ask: () => {
      sendView(true);
      sendClock(true);
    },

    close: async () => {
      keepSession();
      closed = true;
      await host?.close();
    },
  };
};

export default createLibraryPlayer;
