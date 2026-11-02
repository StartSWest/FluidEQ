/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  TSceneResolution,
  TSceneSmoothing,
} from 'common/scenePerformance';
import { fixtureNoise } from 'common/soundHopsFixture';
import { displayTickMs, isFrameDue } from 'renderer/utils/framePace';
import { createFrameCadence, judgedIntervalMs } from './frameCadence';
import { canvasPlan } from './sceneCanvasPlan';
import {
  sceneChosenScale,
  sceneDrawnSize,
  sceneFinishFor,
  sceneLadderTop,
  sceneOutputSize,
} from './sceneDrawSizes';
import { createCostLadder, type ICostLadder } from './sceneHealth';
import { presentPlan, type TPresentStep } from './scenePost';
import { createRestWatch, isSilentWaveform } from './sceneRest';
import {
  LADDER_RUNS,
  ONE_FORTY_FOUR_MS,
  ONE_TWENTY_MS,
  SIXTY_MS,
} from './sceneSizingRuns';
import { createWarmupLadder } from './sceneWarmup';

/**
 * What `native/scene-core/tests/scene_sizing_parity_test.cpp` holds the C++
 * desktop scenes to, written by `generate-sound-hops-fixture.ts` into
 * `scene_sizing_fixture.h`: the window's own size ladders, frame pacing,
 * rest in silence and draw sizes, each answering inputs that drive every
 * branch. The ladders are fed what a scene would cost at the size they
 * chose, so they move as they do on a real GPU: heavy passages, light ones,
 * a GPU with no clock, a supersampled top, a floor moved under them.
 */

/** A double as C++ reads it back exactly: JavaScript's shortest round trip. */
const cDouble = (value: number) => {
  const text = String(value);
  return text.includes('.') || text.includes('e') ? text : `${text}.0`;
};

const table = (name: string, columns: number, rows: number[][]) =>
  [
    `inline constexpr double ${name}[][${columns}] = {`,
    ...rows.map((row) => `    {${row.map(cDouble).join(', ')}},`),
    '};',
  ].join('\n');

const ACTION_CODES = { refloor: 1, resume: 2, reset: 3 } as const;

/**
 * Each frame: cost ms (−1 for none), post ms (−1), behind, interval ms,
 * hidden, the action before it (0 none, 1 refloor, 2 resume, 3 reset) and
 * its value; then the ladder's answer: scale, slowed, degraded, cheap
 * finish.
 */
const ladderRows = () => {
  const runs: number[][] = [];
  const frames: number[][] = [];
  LADDER_RUNS.forEach((run, index) => {
    runs.push([
      run.warmup ? 1 : 0,
      run.top,
      run.floor,
      frames.length,
      run.frames,
    ]);
    const ladder: ICostLadder = run.warmup
      ? createWarmupLadder(run.top, run.floor)
      : createCostLadder(run.top, run.floor);
    for (let frame = 0; frame < run.frames; frame += 1) {
      const action = run.actions?.find((entry) => entry.at === frame);
      let actionValue = 0;
      if (action?.kind === 'refloor') {
        ladder.refloor(action.value);
        actionValue = action.value;
      } else if (action?.kind === 'resume') {
        ladder.resume(action.value);
        actionValue = action.value;
      } else if (action?.kind === 'reset') {
        ladder.reset();
      }
      const intervalMs = ladder.slowed() ? 1000 / 30 : run.intervalMs;
      const scale = ladder.scale();
      const noise =
        1 + (run.noise ?? 0.15) * fixtureNoise(index * 100_003 + frame);
      const gpuMs = run.costAt(frame) * scale * scale * noise;
      let behind = 0;
      if (gpuMs > intervalMs * 2) {
        behind = 2;
      } else if (gpuMs > intervalMs) {
        behind = 1;
      }
      const postMs = run.clock ? run.postAt?.(frame) : undefined;
      const hidden = run.hiddenAt?.(frame) ?? false;
      const state = ladder.frame(
        {
          ...(run.clock ? { costMs: gpuMs + (postMs ?? 0) } : {}),
          ...(postMs !== undefined ? { postMs } : {}),
          behind,
        },
        intervalMs,
        hidden,
      );
      frames.push([
        run.clock ? gpuMs + (postMs ?? 0) : -1,
        postMs ?? -1,
        behind,
        intervalMs,
        hidden ? 1 : 0,
        action ? ACTION_CODES[action.kind] : 0,
        actionValue,
        ladder.scale(),
        ladder.slowed() ? 1 : 0,
        state === 'degraded' ? 1 : 0,
        ladder.cheapFinish() ? 1 : 0,
      ]);
    }
  });
  return { runs, frames };
};

/** Not a gap: the cadence is reset there. */
const CADENCE_RESET = -1000;

/** Each gap noted, then the interval: steady, a stall, a faster display. */
const cadenceRows = () => {
  const cadence = createFrameCadence();
  const rows: number[][] = [[0, cadence.intervalMs()]];
  for (let frame = 0; frame < 80; frame += 1) {
    let gap = SIXTY_MS + fixtureNoise(frame + 7) * 0.4;
    if (frame % 17 === 5) {
      gap = 90;
    } else if (frame >= 50) {
      gap = ONE_FORTY_FOUR_MS + fixtureNoise(frame) * 0.2;
    }
    if (frame === 30) {
      gap = -1;
    }
    cadence.note(gap);
    rows.push([gap, cadence.intervalMs()]);
  }
  cadence.reset();
  rows.push([CADENCE_RESET, cadence.intervalMs()]);
  return rows;
};

/**
 * Each frame's time, whether it was silent, and whether the scene rests:
 * silence long enough and just short of it, exactly the wait, sound ending
 * the rest.
 */
const restRows = () => {
  const rest = createRestWatch();
  return [
    [1000, 1],
    [5000, 1],
    [10999, 1],
    [11000, 1],
    [11500, 1],
    [12000, 0],
    [13000, 1],
    [22000, 1],
    [23000, 1],
    [23016, 0],
  ].map(([now, silent]) => [
    now,
    silent,
    rest.frame(now, silent === 1) ? 1 : 0,
  ]);
};

/** Elapsed, pace and display frame, then whether a frame is due. */
const dueRows = () => {
  const rows: number[][] = [];
  [0, SIXTY_MS, 1000 / 30].forEach((pace) =>
    [ONE_FORTY_FOUR_MS, 10, ONE_TWENTY_MS, SIXTY_MS].forEach((tick) => {
      for (let frames = 1; frames <= 6; frames += 1) {
        const elapsed = tick * frames + fixtureNoise(frames * 13) * 0.3;
        rows.push([
          elapsed,
          pace,
          tick,
          isFrameDue(elapsed, pace, tick) ? 1 : 0,
        ]);
      }
      // A hair inside the jitter the rule allows for, and a hair outside.
      [0.24, 0.27].forEach((share) => {
        const elapsed = pace - tick * share;
        rows.push([
          elapsed,
          pace,
          tick,
          isFrameDue(elapsed, pace, tick) ? 1 : 0,
        ]);
      });
    }),
  );
  return rows;
};

/** Now, the last tick (−1 for none) and the previous frame, then the tick. */
const tickRows = () =>
  [
    [100, -1, 16],
    [100, 92, 16],
    [100, 99, 16],
    [500, 100, 16],
  ].map(([now, last, previous]) => [
    now,
    last,
    previous,
    displayTickMs(now, last < 0 ? undefined : last, previous),
  ]);

/** The display's beat and the drawn gap (−1 for none), then the interval judged. */
const judgedRows = () =>
  [
    [SIXTY_MS, -1],
    [SIXTY_MS, 9],
    [SIXTY_MS, 40],
  ].map(([display, drawn]) => [
    display,
    drawn,
    judgedIntervalMs(display, drawn < 0 ? undefined : drawn),
  ]);

/** Eight peaks, then whether they are silence. */
const silenceRows = () =>
  [
    [0, 0, 0, 0, 0, 0, 0, 0],
    [0.001, -0.002, 0.0029, 0, 0, 0, 0, 0],
    [0, 0, 0, 0, 0, 0, 0.003, 0],
    [0, -0.5, 0, 0, 0, 0, 0, 0],
  ].map((peaks) => [...peaks, isSilentWaveform(peaks) ? 1 : 0]);

const PINS: [number, TSceneResolution][] = [
  [-1, 'auto'],
  [1, 'native'],
  [0.77, 'quality'],
  [0.5, 'performance'],
];
const SMOOTHINGS: TSceneSmoothing[] = ['off', 'fast', 'best'];
const STEP_CODES: Record<TPresentStep, number> = {
  fsr: 0,
  downsample: 1,
  fxaa: 2,
  copy: 3,
};

/**
 * Panel width and height, pin (−1 for auto), smoothing (0 off, 1 fast,
 * 2 best), FSR, the ladder's scale, cheap finish; then the output, the top,
 * the scale, the drawn size, the finish, the canvas and the passes (−1 for
 * none).
 */
const drawRows = () => {
  const rows: number[][] = [];
  [
    [1920, 1080],
    [2560, 1440],
    [3840, 2160],
    // Supersampled by under a twentieth: not worth the pass.
    [3640, 2160],
    [5120, 2880],
    [1366, 768],
  ].forEach(([width, height]) =>
    PINS.forEach(([pin, resolution]) =>
      SMOOTHINGS.forEach((smoothing, smoothingIndex) =>
        [true, false].forEach((fsr) =>
          [1, 0.67].forEach((ladderScale) => {
            const cheap = ladderScale < 1 && !fsr;
            const output = sceneOutputSize(width, height);
            const top = sceneLadderTop(smoothing, output);
            const scale = sceneChosenScale(resolution, top, ladderScale);
            const drawn = sceneDrawnSize(output, scale);
            const performance = {
              upscaler: fsr ? ('fsr' as const) : ('simple' as const),
              smoothing,
            };
            const finish = sceneFinishFor(performance, scale, cheap);
            const plan = canvasPlan(drawn.width, drawn.height, output, finish);
            const steps = presentPlan(plan).map((step) => STEP_CODES[step]);
            rows.push([
              width,
              height,
              pin,
              smoothingIndex,
              fsr ? 1 : 0,
              ladderScale,
              cheap ? 1 : 0,
              output.width,
              output.height,
              top,
              scale,
              drawn.width,
              drawn.height,
              finish.fsr ? 1 : 0,
              finish.fxaa ? 1 : 0,
              plan.canvasWidth,
              plan.canvasHeight,
              steps[0] ?? -1,
              steps[1] ?? -1,
            ]);
          }),
        ),
      ),
    ),
  );
  return rows;
};

export const sceneSizingFixture = (): string => {
  const ladder = ladderRows();
  return [
    '// Written by .erb/scripts/generate-sound-hops-fixture.ts from',
    '// src/renderer/graph/sceneSizingFixture.ts. Do not edit; regenerate.',
    '#pragma once',
    '',
    'namespace feq::scene::fixture {',
    '',
    '// Each run: warm-up, top, floor, first frame, frames.',
    table('kLadderRuns', 5, ladder.runs),
    '',
    '// Each frame: cost, post, behind, interval, hidden, action, its value;',
    '// then scale, slowed, degraded, cheap finish.',
    table('kLadderFrames', 11, ladder.frames),
    '',
    `// Gap noted (${CADENCE_RESET} for a reset), then the interval.`,
    table('kCadence', 2, cadenceRows()),
    '',
    '// Now, silent, then resting.',
    table('kRest', 3, restRows()),
    '',
    '// Elapsed, pace, display frame, then due.',
    table('kFrameDue', 4, dueRows()),
    '',
    '// Now, last tick (-1 none), previous, then the tick.',
    table('kDisplayTick', 4, tickRows()),
    '',
    "// The display's beat, the drawn gap (-1 none), then the interval judged.",
    table('kJudgedInterval', 3, judgedRows()),
    '',
    '// Eight peaks, then silent.',
    table('kSilence', 9, silenceRows()),
    '',
    '// Panel, pin, smoothing, FSR, ladder scale, cheap; then output, top,',
    '// scale, drawn, finish, canvas, passes.',
    table('kDrawPlans', 19, drawRows()),
    '',
    '}  // namespace feq::scene::fixture',
    '',
  ].join('\n');
};
