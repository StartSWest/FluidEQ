/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The three commands that start, stop and suspend playback.
 *
 * Everything else in this player rearranges a list or moves a playhead. These
 * decide whether there is anything playing at all, which is why they sit
 * together and why each is short: the work is in stating the intent clearly,
 * not in carrying it out.
 *
 * `toggle` is the one with a decision in it. While the host owns the transport
 * the element is paused and holding its file as a fallback, so `element.paused`
 * answers "yes" forever — asking it would call `play()` on the second decoder
 * every press. The STATE is the request there, and the mirror carries it to
 * the host on the next tick.
 */
import {
  Dispatch,
  MutableRefObject,
  SetStateAction,
  useCallback,
  useEffect,
} from 'react';
import {
  ILibraryQueue,
  buildQueue,
  currentTrackId,
} from '../../../common/library/queue';
import {
  claimPlayback,
  registerPlayer,
  releasePlayback,
} from '../../audio/playbackOwner';
import type { TSetPlaybackHandoff } from '../../audio/playbackHandoff';

export interface IPlaybackCommands {
  /** Pause and rewind the loaded item without discarding its queue. */
  stop: () => void;
  playTracks: (trackIds: readonly string[], startTrackId: string) => void;
  /** Play or pause, asked of whichever engine is actually playing. */
  toggle: () => void;
}

export const usePlaybackCommands = (options: {
  activeElement: () => HTMLMediaElement | undefined;
  /** Both audio decks; a fallback crossfade can have both audible at once. */
  audioElements: readonly HTMLAudioElement[];
  queueRef: MutableRefObject<ILibraryQueue | undefined>;
  /** True while the native host is the transport. See `toggle` above. */
  hostOwnsTransportRef: MutableRefObject<boolean>;
  setQueue: Dispatch<SetStateAction<ILibraryQueue | undefined>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setRetainWhenHidden: TSetPlaybackHandoff;
  setAddedIds: Dispatch<SetStateAction<ReadonlySet<string>>>;
  /** Ends an overlap and clears its resource-cleanup timer. */
  finishCrossfadeRef: MutableRefObject<(() => void) | undefined>;
  /** The one running element fade/watchdog, if any. */
  fadeFrameRef: MutableRefObject<number>;
  /** Rewind the native deck when it, rather than the element, is audible. */
  seekHost: (positionMs: number) => void;
  setPositionMs: Dispatch<SetStateAction<number>>;
  volumeRef: MutableRefObject<number>;
  /** Lets a stopped restored session begin at zero instead of its saved time. */
  endedTrackRef: MutableRefObject<string | undefined>;
  naturalCrossfadeTrackRef: MutableRefObject<string | undefined>;
  /** Bumped to force a reload of a track the queue is already on. */
  setLoadRequest: Dispatch<SetStateAction<number>>;
  /**
   * Cleared when the listener picks something themselves.
   *
   * A restore that outlived the track it was saved for is what put a saved
   * position onto whatever loaded next.
   */
  pendingRestore: MutableRefObject<
    { trackId: string; positionMs: number } | undefined
  >;
  audioElementRef: MutableRefObject<HTMLAudioElement | undefined>;
}): IPlaybackCommands => {
  const {
    activeElement,
    audioElements,
    queueRef,
    hostOwnsTransportRef,
    setQueue,
    setIsPlaying,
    setRetainWhenHidden,
    setAddedIds,
    finishCrossfadeRef,
    fadeFrameRef,
    seekHost,
    setPositionMs,
    volumeRef,
    endedTrackRef,
    naturalCrossfadeTrackRef,
    setLoadRequest,
    pendingRestore,
    audioElementRef,
  } = options;

  const playTracks = useCallback(
    (trackIds: readonly string[], startTrackId: string) => {
      setRetainWhenHidden(false);
      // PLAY REPLACES. Pressing play on a record is choosing what to listen
      // to now, and the list built by hand for what came before it does not
      // survive that — it was a list of what to play next, and "next" has
      // just been answered by something else. Add to up next is the half that
      // keeps a list; this is the half that starts one.
      setAddedIds((current) => (current.size === 0 ? current : new Set()));
      setQueue((current) => {
        const next = buildQueue(
          [...trackIds],
          startTrackId,
          current?.isShuffled ?? false,
        );
        // Shuffle and repeat are player preferences, not properties of one
        // list — picking a new album should not silently turn Repeat off.
        return current ? { ...next, repeat: current.repeat } : next;
      });

      // ASKING FOR THE TRACK THAT IS ALREADY CUED IS STILL ASKING FOR IT.
      //
      // Everything that starts sound hangs off the loader effect, and that
      // effect is keyed on `trackId` CHANGING — deliberately, so a rescan
      // refreshing this track's tags cannot restart it. The cost is the case
      // where the queue is already sitting on the very track being asked for,
      // and then a press did nothing at all:
      //
      //   - after a restart, where the session is restored cued and paused
      //     with no source fetched (see `pendingRestore` in that effect), so
      //     the album's Play looked broken while the bar's Play worked;
      //   - after Stop, where the same album is chosen again.
      //
      // Only the audio element is given a source here. A video belongs to
      // `LibraryVideoStage`, which loads it itself — see `videoTrackId`.
      const cued = queueRef.current
        ? currentTrackId(queueRef.current)
        : undefined;
      if (cued !== startTrackId) {
        return;
      }
      const element = activeElement();
      if (!element) {
        return;
      }
      pendingRestore.current = undefined;
      if (element === audioElementRef.current && !element.getAttribute('src')) {
        setLoadRequest((current) => current + 1);
        return;
      }
      element.play().catch(() => undefined);
    },
    [
      activeElement,
      setAddedIds,
      setQueue,
      queueRef,
      setLoadRequest,
      pendingRestore,
      audioElementRef,
      setRetainWhenHidden,
    ],
  );

  /**
   * Suspend the engine that is actually audible, without clearing its queue.
   *
   * The old one-player stopper paused the fallback elements directly. Once the
   * native deck took over those elements were already paused, so Online Media
   * or an outside player could "stop" them successfully while the host carried
   * on making sound. State is the native transport command; the mirror sends
   * the corresponding host pause on the next render.
   */
  const pausePlayback = useCallback(() => {
    setRetainWhenHidden(false);
    if (hostOwnsTransportRef.current) {
      setIsPlaying(false);
      releasePlayback('library');
      return;
    }
    const elements = new Set<HTMLMediaElement>(audioElements);
    const active = activeElement();
    if (active) {
      elements.add(active);
    }
    elements.forEach((element) => element.pause());
    setIsPlaying(false);
    releasePlayback('library');
  }, [
    activeElement,
    audioElements,
    hostOwnsTransportRef,
    setIsPlaying,
    setRetainWhenHidden,
  ]);

  // How Online Media, Karaoke and an outside system-media session silence the
  // Library. Kept beside the command rather than beside the elements, because
  // the elements are only fallbacks while the native host owns transport.
  useEffect(() => registerPlayer('library', pausePlayback), [pausePlayback]);

  const stop = useCallback(() => {
    const hostWasAudible = hostOwnsTransportRef.current;
    // Settle the overlap before resolving `activeElement`: its completion
    // selects the incoming deck and releases the outgoing decoder. Leaving
    // that timer alive after Stop could dispose the wrong deck later.
    finishCrossfadeRef.current?.();
    cancelAnimationFrame(fadeFrameRef.current);
    fadeFrameRef.current = 0;
    pausePlayback();
    if (hostWasAudible) {
      seekHost(0);
    }
    const element = activeElement();
    if (element) {
      // Pause happens first. A stopped decoder can jump without emitting the
      // click that an audible seek needs `startSeekFade` to hide.
      element.currentTime = 0;
    }
    audioElements.forEach((deck) => {
      deck.volume = volumeRef.current;
    });
    pendingRestore.current = undefined;
    endedTrackRef.current = undefined;
    naturalCrossfadeTrackRef.current = undefined;
    setPositionMs(0);
  }, [
    activeElement,
    audioElements,
    endedTrackRef,
    fadeFrameRef,
    finishCrossfadeRef,
    hostOwnsTransportRef,
    naturalCrossfadeTrackRef,
    pausePlayback,
    pendingRestore,
    seekHost,
    setPositionMs,
    volumeRef,
  ]);

  const toggle = useCallback(() => {
    const element = activeElement();
    if (!element) {
      return;
    }
    /**
     * Ask the engine that is playing, not the one that is only loaded.
     *
     * While the host owns the transport the element is paused and holding the
     * file as a fallback, so `element.paused` answers "yes" forever and this
     * would have called `play()` on it every time — starting the second
     * decoder the pause exists to stop, and restarting the sound in the
     * element as well as the host on any deck the host had failed to open.
     *
     * The state IS the request here. `sync` carries it to the host on the very
     * next tick, which is where a play or a pause actually happens.
     */
    if (hostOwnsTransportRef.current) {
      setIsPlaying((playing) => {
        setRetainWhenHidden(false);
        if (playing) {
          releasePlayback('library');
        } else {
          claimPlayback('library');
        }
        return !playing;
      });
      return;
    }
    if (element.paused) {
      setRetainWhenHidden(false);
      element.play().catch(() => undefined);
    } else {
      setRetainWhenHidden(false);
      element.pause();
    }
  }, [activeElement, hostOwnsTransportRef, setIsPlaying, setRetainWhenHidden]);

  return { stop, playTracks, toggle };
};
