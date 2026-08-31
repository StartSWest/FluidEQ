/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The native engine, and the clock it hands back.
 *
 * `useNativeBackend` answers `undefined` unless the host is the selected
 * engine, so everything below it is a branch rather than a flag somebody has
 * to remember to check — there is nothing to call by accident.
 *
 * The clock is the part worth reading twice. While a deck holds a track, the
 * position and duration come from the engine MAKING the sound; the element is
 * muted, paused, and holding its file only as a fallback. Before that — engaged
 * but with nothing loaded — there is no host clock to read and the element is
 * still the authority, which is what `hasSource` distinguishes.
 *
 * Reading both at once is what cost an evening: a deck cued at the position the
 * PREVIOUS track had reached played from the middle while the seek bar read
 * zero, because each side was telling the truth about a different player.
 */
import { MutableRefObject, useRef } from 'react';
import { IDspSettings } from '../../../common/dsp/chain';
import { ILibraryTrack } from '../../../common/library/types';
import { useDspNativeTransport } from '../../dsp/store';
import {
  useNativeBackend,
  useNativeDeviceGeneration,
  useNativeMeters,
  useNativeMirror,
  useNativeTransport,
} from '../../dsp/useNativeBackend';

export interface IPlayerEngine {
  /** True while a native deck holds a track, so its clock is the real one. */
  hostOwnsTransport: boolean;
  hostOwnsTransportRef: MutableRefObject<boolean>;
  /** The deck reached the end of its file. */
  hostEnded: boolean;
  /** The clock of whichever engine is playing. */
  publishedPositionMs: number;
  publishedDurationMs: number;
  /** Fired for at most one track. */
  endedTrackRef: MutableRefObject<string | undefined>;
}

export const usePlayerEngine = (options: {
  dspSettings: IDspSettings;
  audioElements: readonly HTMLAudioElement[];
  track: ILibraryTrack | undefined;
  isPlaying: boolean;
  /** The element's own clock, used until a deck has something. */
  positionMs: number;
  durationMs: number;
  volume: number;
}): IPlayerEngine => {
  const {
    dspSettings,
    audioElements,
    track,
    isPlaying,
    positionMs,
    durationMs,
    volume,
  } = options;

  /**
   * The native engine, shadowing this player — and now the default one.
   *
   * Deliberately a SHADOW rather than a replacement, which is what it stays
   * after becoming the default. The elements above keep every job they have —
   * position, events, the queue's advance, the crossfade's cue point — and are
   * muted, while the host is told the same file at the same position. That is
   * what made the two engines comparable while there was a switch, and it is
   * what makes the fallback whole now that there is not: a host that cannot
   * start leaves the elements unmuted and the TypeScript chain processing, and
   * the only thing the user loses is which engine did the arithmetic.
   *
   * `useNativeBackend` answers `undefined` unless the native engine is
   * selected, so there is nothing here to call by accident on either path.
   */
  const nativeBackend = useNativeBackend(dspSettings);
  // The panel's graphs read the engine that is audible, not the muted one.
  useNativeMeters(nativeBackend);
  // And the mirror re-cues when the host moves to a different endpoint.
  useNativeDeviceGeneration(nativeBackend);
  // The clock comes from the engine making the sound. See `hostTransport`.
  useNativeTransport(nativeBackend);
  /**
   * One clock, and it belongs to whatever is audible.
   *
   * While the host is playing, the element is muted and its position is a
   * second decode of the same file kept only to be a clock. Reading both is
   * what let a track cued at the previous one's position play from the middle
   * with the bar at zero: each was right about a different player.
   *
   * `hasSource` rather than "is the native engine on", because the host has a
   * clock only once a deck holds something. Between engaging and the first
   * load there is nothing to read, and the element is still the authority.
   */
  const hostTransport = useDspNativeTransport();
  const hostOwnsTransport = hostTransport.hasSource;
  const publishedPositionMs = hostOwnsTransport
    ? hostTransport.positionSeconds * 1_000
    : positionMs;
  // A duration of zero means the decoder could not say, which is legal — the
  // element's own answer is better than none.
  const publishedDurationMs =
    hostOwnsTransport && hostTransport.durationSeconds > 0
      ? hostTransport.durationSeconds * 1_000
      : durationMs;
  const hostOwnsTransportRef = useRef(hostOwnsTransport);
  hostOwnsTransportRef.current = hostOwnsTransport;
  /** Fired for at most one track; see the effect beside `handleEnded`. */
  const endedTrackRef = useRef<string | undefined>(undefined);
  useNativeMirror(nativeBackend, audioElements, {
    mediaPath: track?.path,
    isPlaying,
    positionMs,
    volume,
    /**
     * The fade the mirror should use if the track changes under it.
     *
     * Passed as state rather than called as an event: the player sets the new
     * track, React re-renders, and the mirror sees the change on the very next
     * sync — which is exactly when the fade should start. A method called
     * afterwards always arrived to find the track already cued as a cut.
     */
    transition:
      dspSettings.enabled && dspSettings.crossfade.enabled
        ? {
            durationMs: dspSettings.crossfade.durationMs,
            curve: dspSettings.crossfade.curve,
            shape: dspSettings.crossfade.shape,
          }
        : undefined,
  });

  return {
    hostOwnsTransport,
    hostOwnsTransportRef,
    hostEnded: hostTransport.ended,
    publishedPositionMs,
    publishedDurationMs,
    endedTrackRef,
  };
};
