/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The one track type this player does not own an element for.
 *
 * A video is drawn by `LibraryVideoStage`, which has to render a real
 * `<video>` for the picture. So the stage registers its element here and the
 * player redirects every transport command at it for exactly as long as the
 * current track is a video — the hidden audio decks are left alone rather than
 * being handed the same file, which would play it twice.
 *
 * `videoTrackId` is what the stage keys off, so it is derived here rather than
 * asked for: the stage unmounts the instant it goes undefined, which is the
 * moment the registration has to be undone.
 */
import { MutableRefObject, useCallback, useState } from 'react';
import { ILibraryTrack } from '../../../common/library/types';

export interface IVideoElement {
  /** The id of the current track when it is a video, otherwise undefined. */
  videoTrackId: string | undefined;
  /**
   * Put the picture away without touching the queue.
   *
   * The visibility half only — silencing it is `stop`'s job, and the session
   * hands out the two together (see `LibraryPlayerContext`). Split because
   * they are genuinely different questions: this one is asked by nothing but
   * the Back button, and `stop` is asked by every transport in the app.
   *
   * The queue survives it. Leaving a video is not throwing away the two
   * thousand things queued behind it.
   */
  closeVideo: () => void;
  /**
   * Forget that anything was closed.
   *
   * Every command that means "play this" calls it, and the one that made it
   * necessary is playing the SAME video again: closing is remembered by id,
   * and picking that same row off the shelf produces the same id, so without
   * this the press landed on a video still marked closed — no picture, no
   * sound, and a row that lit up as playing. A track change clears the mark
   * on its own; this is for the case where nothing changes but the request.
   */
  openVideo: () => void;
  /**
   * The picture, reopened, for the press that asks for it back.
   *
   * Answers true when there WAS a closed video to reopen, so the caller
   * knows it has handled the press. The transport's play button is the
   * caller: with the picture closed there is no element registered, so its
   * usual route reaches a hidden audio deck holding no file and does
   * nothing at all — a dead play button on a track the bar is still showing.
   * Whoever asks a closed video to play means "show it to me again".
   */
  reopenVideo: () => boolean;
  /** Called by the stage; returns the unregister. */
  registerVideoElement: (element: HTMLVideoElement | null) => () => void;
  /**
   * The element every transport command should reach.
   *
   * The registered video when there is one, the audio deck otherwise — which
   * is the whole of what "redirect transport at the stage" means, and why it
   * belongs here rather than beside the decks.
   */
  activeElement: () => HTMLMediaElement | undefined;
}

export const useVideoElement = (options: {
  track: ILibraryTrack | undefined;
  videoElementRef: MutableRefObject<HTMLVideoElement | null>;
  audioElementRef: MutableRefObject<HTMLAudioElement | undefined>;
  volumeRef: MutableRefObject<number>;
  bindMediaEvents: (element: HTMLMediaElement) => () => void;
  /** Set true to reopen a closed picture — see `reopenVideo`. */
  setIsPlaying: (playing: boolean) => void;
}): IVideoElement => {
  const {
    track,
    videoElementRef,
    audioElementRef,
    volumeRef,
    bindMediaEvents,
    setIsPlaying,
  } = options;

  /**
   * The one video the reader has put away, by id and not by a flag.
   *
   * An id rather than a boolean because it answers the question a boolean
   * cannot: the queue moving on to the NEXT video must show its picture. A
   * flag would have had to be cleared by whatever moved the queue, which is
   * four callers and a natural end; an id stops matching on its own the
   * moment the track changes.
   */
  const [closedVideoId, setClosedVideoId] = useState<string | undefined>();

  // Gated on `isPlayable` too: an mkv or avi is `kind === 'video'` exactly
  // like an mp4, but Chromium has no demuxer for it. Without this check
  // `LibraryVideoStage` would still mount a `<video src=...>` for a file it
  // cannot decode — a black box with a broken-media icon on the Library tab
  // — while the bar's own `isUnplayable` message is the only honest answer
  // this case has. Leaving it unset keeps the stage closed and routes
  // nothing anywhere, matching the audio branch below exactly.
  //
  // And unset for a video that has been closed, which is the same statement
  // made once for every consumer: the stage unmounts, the shelves come back,
  // the queue leaves the strip it takes beside a picture, and transport stops
  // being redirected at an element that is no longer there. All of it follows
  // from this one value, which is why closing is expressed here rather than
  // as a second piece of state beside it.
  const videoTrackId =
    track?.kind === 'video' && track.isPlayable && track.id !== closedVideoId
      ? track.id
      : undefined;

  const closeVideo = useCallback(() => {
    setClosedVideoId(track?.id);
  }, [track?.id]);

  const openVideo = useCallback(() => {
    setClosedVideoId(undefined);
  }, []);

  const reopenVideo = useCallback((): boolean => {
    if (closedVideoId === undefined || track?.id !== closedVideoId) {
      return false;
    }
    setClosedVideoId(undefined);
    // The stage remounts on this and starts the element itself — see its own
    // effect, which follows `isPlaying` rather than being told to play. Any
    // other order would have to reach an element that does not exist yet.
    setIsPlaying(true);
    return true;
  }, [closedVideoId, setIsPlaying, track?.id]);

  /** The element every transport command reaches right now. */
  const activeElement = useCallback(
    (): HTMLMediaElement | undefined =>
      videoTrackId
        ? (videoElementRef.current ?? undefined)
        : audioElementRef.current,
    [videoTrackId, audioElementRef, videoElementRef],
  );

  const registerVideoElement = useCallback(
    (element: HTMLVideoElement | null): (() => void) => {
      videoElementRef.current = element;
      if (!element) {
        return () => undefined;
      }
      element.volume = volumeRef.current;
      const unbind = bindMediaEvents(element);
      return () => {
        unbind();
        // `LibraryVideoStage` unmounts the instant `videoTrackId` goes
        // undefined — the queue moved to an audio track, or off the end —
        // and this cleanup is what runs at that exact moment. It has to stop
        // the video itself rather than trust the unmount to: React tears
        // this element out of the DOM, but nothing about removing a node
        // stops whatever it was doing, and the `[trackId]` effect below
        // starts `audio.play()` in the very same commit. `pause()` is
        // synchronous and this cleanup is guaranteed to run before any new
        // effect fires this commit (React runs every destroy function across
        // the tree before any create function), so the two can never
        // overlap. `removeAttribute('src')` on top of `pause()` — matching
        // exactly how the audio element itself is released a few lines
        // down — because a paused-but-loaded video keeps its buffer and its
        // decoder alive; only clearing the source lets both go.
        element.pause();
        element.removeAttribute('src');
        if (videoElementRef.current === element) {
          videoElementRef.current = null;
        }
      };
    },
    [bindMediaEvents, videoElementRef, volumeRef],
  );

  return {
    videoTrackId,
    closeVideo,
    openVideo,
    reopenVideo,
    registerVideoElement,
    activeElement,
  };
};
