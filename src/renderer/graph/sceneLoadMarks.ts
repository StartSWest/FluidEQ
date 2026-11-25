/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Each step of a scene's load as a user-timing entry, `scene:<step>`: what a
 * Performance recording of a scene worker shows on its Timings track, and
 * what the load harness reads to say where the time between a pick and the
 * first frame went.
 *
 * One entry per step name at a time. A worker lives as long as its scene and
 * loads it again on every Studio save, and the browser keeps every
 * user-timing entry for the life of the worker with no limit, so the step's
 * older entry is cleared as the new one is made. A recording loses nothing:
 * it reads user timing from the trace, which has the entry the moment it is
 * made.
 */
export const markSceneStep = (step: string, startedAt: number): void => {
  if (
    typeof performance === 'undefined' ||
    typeof performance.measure !== 'function'
  ) {
    return;
  }
  const name = `scene:${step}`;
  performance.clearMeasures(name);
  performance.measure(name, { start: startedAt, end: performance.now() });
};

/** Runs `step`, marked as `name` from now until it settles. */
export const timeSceneStep = async <T>(
  name: string,
  step: () => Promise<T>,
): Promise<T> => {
  const startedAt = performance.now();
  try {
    return await step();
  } finally {
    markSceneStep(name, startedAt);
  }
};
