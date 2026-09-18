/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useEffect, useState } from 'react';

/**
 * How fast a scene's own time runs for a listener who has asked for less
 * motion.
 *
 * A quarter. Everything a scene does by itself — drifting, sweeping,
 * spinning, flying, a camera moving through it — runs at a quarter speed,
 * while everything it does because of the music does not change: the level,
 * the beat and the bands are read from the sound, not from the clock.
 *
 * NOT zero. The ambient layer's answer to this setting is to draw nothing,
 * which costs a listener some decoration over the app; a visualizer held
 * still is the feature switched off, and the setting says reduce. A quarter
 * is slow enough that a sweep reads as a drift rather than a movement, and
 * far enough from a standstill that the scene is still a scene.
 *
 * The clock is the one lever that reaches EVERY scene. A member writes
 * whatever shader they like and the only things all of them are handed are a
 * time and an elapsed; there is no way to ask a stranger's shader to move
 * less that does not go through those.
 */
export const REDUCED_MOTION_SPEED = 0.25;

const asks = () =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * The speed a scene's clock should run at, following the setting while a
 * scene plays.
 *
 * Answered as "full" wherever the question cannot be asked — under the test
 * environment, in a renderer still booting — because reduced motion is only
 * the answer when it is actually set. An absent `matchMedia` means animate.
 */
export const useSceneMotionSpeed = (): number => {
  const [reduced, setReduced] = useState(asks);
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      typeof window.matchMedia !== 'function'
    ) {
      return undefined;
    }
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const changed = () => setReduced(query.matches);
    query.addEventListener('change', changed);
    return () => query.removeEventListener('change', changed);
  }, []);
  return reduced ? REDUCED_MOTION_SPEED : 1;
};
