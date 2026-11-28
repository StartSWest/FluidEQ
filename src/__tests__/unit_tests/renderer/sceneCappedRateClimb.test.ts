/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Ivan's Studio stage, frame by frame, through the rules the runner and the
 * worker keep: the schedule that picks which display frames are drawn
 * (`createPaceSchedule`), the gaps they come at (`createFrameCadence`), the
 * interval each frame is judged against (`judgedIntervalMs`) and the
 * listener's own ladder (`createWarmupLadder`, Auto's from the floor up to
 * the supersample).
 *
 * His stage read "Runs smoothly · 2.3 ms · 100 fps · 100%" at "60 a second"
 * on Auto: drawn at every frame of a 100 Hz display, 2.3 ms at the panel's
 * size is too dear to draw at twice it each way inside a hundredth of a
 * second, so the picture stayed at the panel's size. Held to the sixty he
 * chose, every frame has a sixtieth and the supersample fits.
 */

import {
  SCENE_AUTO_FLOOR,
  SCENE_SUPERSAMPLE,
} from '../../../common/scenePerformance';
import {
  createFrameCadence,
  judgedIntervalMs,
} from '../../../renderer/graph/frameCadence';
import { createWarmupLadder } from '../../../renderer/graph/sceneLadder';
import {
  createPaceSchedule,
  displayTickMs,
} from '../../../renderer/utils/framePace';

/** What a frame of his scene costs the GPU at the panel's own size. */
const NATIVE_MS = 2.3;

/** `seconds` of the stage on a `hz` display, held to `paceMs`. */
const playStage = (hz: number, paceMs: number, seconds: number) => {
  const schedule = createPaceSchedule();
  const cadence = createFrameCadence();
  const ladder = createWarmupLadder(SCENE_SUPERSAMPLE, SCENE_AUTO_FLOOR);
  let lastTickAt: number | undefined;
  let tickMs = 1000 / 60;
  let drawnAt: number | undefined;
  let drawn = 0;
  for (let tick = 0; tick < hz * seconds; tick += 1) {
    const now = (tick * 1000) / hz;
    tickMs = displayTickMs(now, lastTickAt, tickMs);
    lastTickAt = now;
    if (schedule.isDue(now, paceMs, tickMs)) {
      schedule.drawn(now, paceMs);
      const gap = drawnAt === undefined ? undefined : now - drawnAt;
      if (gap !== undefined) {
        cadence.note(gap);
      }
      drawnAt = now;
      drawn += 1;
      const scale = ladder.scale();
      ladder.frame(
        { costMs: NATIVE_MS * scale ** 2, behind: 0 },
        judgedIntervalMs(cadence.intervalMs(), gap, paceMs),
        'shown',
      );
    }
  }
  return { fps: drawn / seconds, scale: ladder.scale() };
};

describe('the Studio stage at "60 a second" on a 100 Hz display', () => {
  it('draws sixty frames a second', () => {
    expect(playStage(100, 1000 / 60, 10).fps).toBeCloseTo(60, 0);
  });

  it('climbs on Auto to the supersample, above the panel’s own size', () => {
    expect(playStage(100, 1000 / 60, 10).scale).toBe(SCENE_SUPERSAMPLE);
  });

  // The control: every frame of the display, which is what the stage drew
  // while euphoria lifted the cap, holds the same scene at the panel's size.
  it('stays at the panel’s size drawn at every frame of the display', () => {
    const uncapped = playStage(100, 0, 10);
    expect(uncapped.fps).toBe(100);
    expect(uncapped.scale).toBe(1);
  });
});
