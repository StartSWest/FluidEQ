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
import { MutableRefObject, useCallback } from 'react';
import { ILibraryTrack } from '../../../common/library/types';

export interface IVideoElement {
  /** The id of the current track when it is a video, otherwise undefined. */
  videoTrackId: string | undefined;
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
}): IVideoElement => {
  const {
    track,
    videoElementRef,
    audioElementRef,
    volumeRef,
    bindMediaEvents,
  } = options;

  // Gated on `isPlayable` too: an mkv or avi is `kind === 'video'` exactly
  // like an mp4, but Chromium has no demuxer for it. Without this check
  // `LibraryVideoStage` would still mount a `<video src=...>` for a file it
  // cannot decode — a black box with a broken-media icon on the Library tab
  // — while the bar's own `isUnplayable` message is the only honest answer
  // this case has. Leaving it unset keeps the stage closed and routes
  // nothing anywhere, matching the audio branch below exactly.
  const videoTrackId =
    track?.kind === 'video' && track.isPlayable ? track.id : undefined;

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

  return { videoTrackId, registerVideoElement, activeElement };
};
