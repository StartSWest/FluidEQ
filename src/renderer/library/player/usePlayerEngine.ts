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
import { MutableRefObject, useCallback, useRef } from 'react';
import { IDspSettings } from '../../../common/dsp/chain';
import { ILibraryTrack } from '../../../common/library/types';
import { readDspNativeTransport, useDspNativeTransport } from '../../dsp/store';
import { MIN_LEAD_IN_TRIM_MS } from './playerContract';
import {
  useNativeBackend,
  useNativeDeviceGeneration,
  useNativeMirror,
  useNativeTransport,
} from '../../dsp/useNativeBackend';

export interface IPlayerEngine {
  /** True while a native deck holds a track, so its clock is the real one. */
  hostOwnsTransport: boolean;
  hostOwnsTransportRef: MutableRefObject<boolean>;
  /** Move the audible deck's playhead. See `seekHost`. */
  seekHost: (positionMs: number) => void;
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
   * muted, while the host is told the same file at the same position. A host
   * that cannot start leaves the elements unmuted, so library playback remains
   * available unchanged while the DSP rack is visibly unavailable.
   *
   * `useNativeBackend` answers `undefined` until the native engine has actually
   * engaged, so there is nothing here to call early or on the browser path.
   */
  /**
   * THE TRACK, NOT THE TRANSPORT.
   *
   * This used to be `isPlaying && track?.kind === 'audio'`, so every pause tore
   * the engine down and every play built it again — and pressing pause is not a
   * rare event. That one `isPlaying` is what made the whole rack feel broken:
   *
   *  - The supervisor spawned and killed processes on every transport change,
   *    and a start arriving mid-handshake used to be answered "not ready",
   *    which made the incoming controller kill the host it had just asked for.
   *  - Tearing the mirror down hands the audio back to the elements, so for a
   *    moment the element and the host both play the same file a few
   *    milliseconds apart. That is a comb filter, and it is what "it kills the
   *    bass" was.
   *  - Switching to Karaoke or Online Media pauses the Library, which took the
   *    engine with it and left the player rebuilding itself on the way back.
   *
   * Having a track is the stable fact. A paused deck is a loaded deck, and the
   * host is simply told to pause — which the mirror already does from
   * `isPlaying`. The engine's lifetime now follows what there is to play, not
   * whether it is playing this instant, and the resident process is bounded by
   * the Library provider's own off-tab lease rather than by the pause button.
   */
  const nativeBackend = useNativeBackend(dspSettings, track?.kind === 'audio');
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
  /**
   * Where the listener just asked to be, until the host's clock agrees.
   *
   * A seek is a round trip — renderer to main, down the host's stdin, into the
   * deck, and back up on the next telemetry frame. The bar reads the host, so
   * without this it spends that trip showing the position the thumb was
   * dragged AWAY from: released at 2:30, snaps to 0:45, jumps to 2:30. Held
   * across a scrub that works, it reads as a scrub that does not.
   *
   * Let go the moment the host's clock MOVES, whatever it moved to — not when
   * it reaches the target. If the seek landed, the next frame is the target. If
   * the deck refused it, the next frame is the song playing on from where it
   * was, and the bar tells the truth about that instead of freezing on a
   * position the audio never went to. Nothing here waits on a duration; it
   * waits on the next frame from an engine that sends forty a second.
   */
  const pendingSeekRef = useRef<
    { targetMs: number; fromSeconds: number } | undefined
  >(undefined);
  if (
    pendingSeekRef.current &&
    (!hostOwnsTransport ||
      hostTransport.positionSeconds !== pendingSeekRef.current.fromSeconds)
  ) {
    pendingSeekRef.current = undefined;
  }
  const clockPositionMs = hostOwnsTransport
    ? hostTransport.positionSeconds * 1_000
    : positionMs;
  const publishedPositionMs =
    pendingSeekRef.current?.targetMs ?? clockPositionMs;
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
  const measuredLeadInMs = track?.normalization?.edges?.leadInMs ?? 0;
  const mirrorSeek = useNativeMirror(nativeBackend, audioElements, {
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
    transition: dspSettings.crossfade.enabled
      ? {
          durationMs: dspSettings.crossfade.durationMs,
          curve: dspSettings.crossfade.curve,
          shape: dspSettings.crossfade.shape,
          startPositionMs:
            measuredLeadInMs >= MIN_LEAD_IN_TRIM_MS ? measuredLeadInMs : 0,
        }
      : undefined,
  });

  /**
   * The scrubber's route to the deck that is making the sound.
   *
   * The position it will read back is claimed here, in the same call that
   * sends the command — before the round trip rather than after it, because
   * the whole point is to have an answer DURING the trip. Read from the store
   * rather than from `hostTransport` so the comparison is against the last
   * frame that actually arrived, not the one this render was built from.
   */
  const seekHost = useCallback(
    (nextPositionMs: number) => {
      const targetMs = Math.max(0, nextPositionMs);
      pendingSeekRef.current = {
        targetMs,
        fromSeconds: readDspNativeTransport().positionSeconds,
      };
      mirrorSeek(targetMs);
    },
    [mirrorSeek],
  );

  return {
    hostOwnsTransport,
    hostOwnsTransportRef,
    seekHost,
    hostEnded: hostTransport.ended,
    publishedPositionMs,
    publishedDurationMs,
    endedTrackRef,
  };
};
