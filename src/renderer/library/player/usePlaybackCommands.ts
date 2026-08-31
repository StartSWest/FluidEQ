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
import { Dispatch, MutableRefObject, SetStateAction, useCallback } from 'react';
import {
  ILibraryQueue,
  buildQueue,
  currentTrackId,
} from '../../../common/library/queue';
import { claimPlayback, releasePlayback } from '../../audio/playbackOwner';

export interface IPlaybackCommands {
  /** Clear the queue outright — the bar goes back to its idle state. */
  stop: () => void;
  playTracks: (trackIds: readonly string[], startTrackId: string) => void;
  /** Play or pause, asked of whichever engine is actually playing. */
  toggle: () => void;
}

export const usePlaybackCommands = (options: {
  activeElement: () => HTMLMediaElement | undefined;
  queueRef: MutableRefObject<ILibraryQueue | undefined>;
  /** True while the native host is the transport. See `toggle` above. */
  hostOwnsTransportRef: MutableRefObject<boolean>;
  setQueue: Dispatch<SetStateAction<ILibraryQueue | undefined>>;
  setIsPlaying: Dispatch<SetStateAction<boolean>>;
  setAddedIds: Dispatch<SetStateAction<ReadonlySet<string>>>;
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
    queueRef,
    hostOwnsTransportRef,
    setQueue,
    setIsPlaying,
    setAddedIds,
    setLoadRequest,
    pendingRestore,
    audioElementRef,
  } = options;

  const stop = useCallback(() => {
    setQueue(undefined);
  }, [setQueue]);

  const playTracks = useCallback(
    (trackIds: readonly string[], startTrackId: string) => {
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
    ],
  );

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
      element.play().catch(() => undefined);
    } else {
      element.pause();
    }
  }, [activeElement, hostOwnsTransportRef, setIsPlaying]);

  return { stop, playTracks, toggle };
};
