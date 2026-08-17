/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * A fader between the backing track and the original recording.
 *
 * Once a song has been separated the player holds two stems that sum back to
 * the master, so the useful control is not a switch but a level: 0 is a clean
 * karaoke backing, 1 is the record as released, and the middle is a guide
 * vocal sitting under the singer — which is what most people actually want
 * while they are still learning the tune.
 *
 * The instrumental plays in the existing `<audio>` element, and the vocal is
 * added on top from a buffer. That direction is deliberate. The alternative —
 * playing the master and subtracting the vocal — is the same arithmetic, but
 * cancellation only works while the two are sample-aligned, and a few
 * milliseconds of drift turns into comb filtering across the whole mix.
 * Addition degrades far more gracefully: the same drift makes the guide vocal
 * slightly early, which is close to inaudible.
 */
interface IUseKaraokeVocalMixOptions {
  /** The element playing the instrumental. It remains the clock. */
  audioRef: React.RefObject<HTMLAudioElement | null>;
  /** The isolated voice, or undefined when this song has not been separated. */
  vocals?: File;
}

/** Where the fader sits when a separated song is first opened. */
const DEFAULT_VOCAL_LEVEL = 0;

/** Below this the node is disconnected outright rather than left at a tiny gain. */
const SILENT = 0.001;

export const useKaraokeVocalMix = ({
  audioRef,
  vocals,
}: IUseKaraokeVocalMixOptions) => {
  const contextRef = useRef<AudioContext | undefined>(undefined);
  const bufferRef = useRef<AudioBuffer | undefined>(undefined);
  const sourceRef = useRef<AudioBufferSourceNode | undefined>(undefined);
  const gainRef = useRef<GainNode | undefined>(undefined);
  const [level, setLevel] = useState(DEFAULT_VOCAL_LEVEL);
  const [isReady, setIsReady] = useState(false);

  // Decode once per stem. A four-minute stereo song is ~40MB as float32, which
  // is worth spending to keep the fader instant and the playback gapless.
  useEffect(() => {
    let cancelled = false;
    if (!vocals) {
      bufferRef.current = undefined;
      setIsReady(false);
      return undefined;
    }
    (async () => {
      const context =
        contextRef.current ?? (contextRef.current = new AudioContext());
      const decoded = await context.decodeAudioData(await vocals.arrayBuffer());
      if (cancelled) {
        return;
      }
      bufferRef.current = decoded;
      setIsReady(true);
    })().catch(() => {
      if (!cancelled) {
        setIsReady(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [vocals]);

  const stop = useCallback(() => {
    try {
      sourceRef.current?.stop();
    } catch {
      // Already stopped; a source node is single-use and this is the cheapest
      // way to say "stop if you have not".
    }
    sourceRef.current?.disconnect();
    sourceRef.current = undefined;
  }, []);

  /**
   * Start the vocal from wherever the element currently is.
   *
   * Called on play and again on every seek, because a buffer source cannot be
   * repositioned — it is created, started at an offset, and thrown away.
   */
  const sync = useCallback(() => {
    const element = audioRef.current;
    const context = contextRef.current;
    const buffer = bufferRef.current;
    if (!element || !context || !buffer || level < SILENT) {
      stop();
      return;
    }
    stop();
    const gain = gainRef.current ?? (gainRef.current = context.createGain());
    gain.gain.value = level;
    gain.connect(context.destination);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(gain);
    source.playbackRate.value = element.playbackRate;
    if (!element.paused) {
      source.start(0, Math.min(element.currentTime, buffer.duration));
    }
    sourceRef.current = source;
  }, [audioRef, level, stop]);

  // Follow the element. Seeking and pausing both have to re-issue the source,
  // and `ended` releases it so a finished song is not holding a live node.
  useEffect(() => {
    const element = audioRef.current;
    if (!element || !isReady) {
      return undefined;
    }
    const onPlay = () => sync();
    const onPause = () => stop();
    element.addEventListener('play', onPlay);
    element.addEventListener('seeked', onPlay);
    element.addEventListener('pause', onPause);
    element.addEventListener('ended', onPause);
    if (!element.paused) {
      sync();
    }
    return () => {
      element.removeEventListener('play', onPlay);
      element.removeEventListener('seeked', onPlay);
      element.removeEventListener('pause', onPause);
      element.removeEventListener('ended', onPause);
      stop();
    };
  }, [audioRef, isReady, stop, sync]);

  // A level change while playing should be heard immediately, not at the next
  // seek, so the gain is adjusted in place rather than restarting the source.
  useEffect(() => {
    const gain = gainRef.current;
    if (!gain) {
      return;
    }
    if (level < SILENT) {
      stop();
      return;
    }
    if (!sourceRef.current) {
      sync();
      return;
    }
    // A short ramp instead of a jump: an instant gain change on a signal that
    // is not at a zero crossing is an audible click.
    gain.gain.setTargetAtTime(level, gain.context.currentTime, 0.015);
  }, [level, stop, sync]);

  useEffect(
    () => () => {
      stop();
      contextRef.current?.close().catch(() => undefined);
      contextRef.current = undefined;
    },
    [stop],
  );

  return {
    /** 0 = backing track only, 1 = the original recording. */
    vocalLevel: level,
    setVocalLevel: setLevel,
    /** True once a stem is decoded and the fader will do something. */
    canMixVocals: isReady,
  };
};

export default useKaraokeVocalMix;
