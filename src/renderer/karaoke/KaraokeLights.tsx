/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useRef } from 'react';
import { getEaseFactor } from 'common/smoothing';
import {
  useLiveAudioCapture,
  useLiveAudioControl,
} from '../audio/LiveAudioContext';

/**
 * How fast the lights answer the music: quick to rise, slow to let go, and a
 * beat flash quicker to fade than the level, so it reads as a hit and not as
 * the room getting brighter.
 */
const RISE_MS = 45;
const FALL_MS = 260;
const BEAT_FALL_MS = 120;

const LEVELS = ['level', 'bass', 'treble', 'beat'] as const;
type TLevel = (typeof LEVELS)[number];

/**
 * The stage's own lights, for a song with no cover and no visualizer behind
 * it: two washes and two beams that sway on their own and follow the music —
 * the beams open and brighten with its level and treble, the washes swell
 * with the bass, and every beat flashes them (Ivan, 2026-10-29: "the
 * spotlights need to animate nicely with music").
 *
 * The music is the window's own reading (`liveSound.ts`), the one every
 * drawing reads. It reaches the lights as four CSS properties set once a
 * frame on this layer, and only opacity and scale follow them, so the beams
 * are never repainted. Paused, the levels fall back to rest and the loop
 * stops once they are there; nothing runs while the song is not playing.
 */
export default function KaraokeLights({ isPlaying }: { isPlaying: boolean }) {
  const layer = useRef<HTMLDivElement>(null);
  const { readFrame, isPaused } = useLiveAudioControl();
  const listening = isPlaying && !isPaused;
  useLiveAudioCapture(listening);
  const readFrameRef = useRef(readFrame);
  readFrameRef.current = readFrame;
  // Kept across a pause and a resume: the loop starts again from where the
  // lights stand, and eases down from there, never snapping to rest.
  const levelsRef = useRef<Record<TLevel, number>>({
    level: 0,
    bass: 0,
    treble: 0,
    beat: 0,
  });

  useEffect(() => {
    const element = layer.current;
    if (!element) {
      return undefined;
    }
    const levels = levelsRef.current;
    let last: number | undefined;
    let frame = 0;
    const step = (now: number) => {
      const elapsed = last === undefined ? 16 : now - last;
      last = now;
      const heard = listening
        ? readFrameRef.current()?.sound?.music()
        : undefined;
      let resting = true;
      LEVELS.forEach((key) => {
        const target = heard ? Math.min(1, Math.max(0, heard[key])) : 0;
        let fall = FALL_MS;
        if (key === 'beat') {
          fall = BEAT_FALL_MS;
        }
        levels[key] +=
          (target - levels[key]) *
          getEaseFactor(elapsed, target > levels[key] ? RISE_MS : fall);
        if (levels[key] > 0.002) {
          resting = false;
        }
        element.style.setProperty(
          `--karaoke-light-${key}`,
          levels[key].toFixed(3),
        );
      });
      frame = listening || !resting ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
  }, [listening]);

  return (
    <div
      ref={layer}
      className="karaoke-stage-media karaoke-ambient"
      aria-hidden
      inert
    >
      <span className="karaoke-ambient__light" />
      <span className="karaoke-ambient__light is-cool" />
    </div>
  );
}
