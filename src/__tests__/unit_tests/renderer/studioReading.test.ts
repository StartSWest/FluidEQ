/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Studio's cost line has to be readable while it is live.
 *
 * Written straight from the frame callback, the raw figures rewrote the line
 * several times a second and the digits blurred. What is held here is that an
 * ordinary wobble does not move the number, that a real change does arrive,
 * and that neither depends on how fast the machine draws — the whole reason
 * the easing goes by half-life rather than by a share of each frame.
 */

import { createStudioReadingSettler } from '../../../renderer/studio/studioReading';

type TSettler = ReturnType<typeof createStudioReadingSettler>;

/** A scene running at `fps`, its GPU time wobbling by `wobble` each frame. */
const run = (
  settler: TSettler,
  {
    seconds,
    fps,
    costMs,
    wobble = 0,
    scale = 1,
  }: {
    seconds: number;
    fps: number;
    costMs?: number;
    wobble?: number;
    scale?: number;
  },
) => {
  const intervalMs = 1000 / fps;
  const lines: string[] = [];
  const frames = Math.round(seconds * fps);
  let last = settler.frame({
    intervalMs,
    scale,
    ...(costMs ? { costMs } : {}),
  });
  for (let frame = 0; frame < frames; frame += 1) {
    const swing = frame % 2 === 0 ? wobble : -wobble;
    last = settler.frame({
      intervalMs,
      scale,
      ...(costMs === undefined ? {} : { costMs: costMs + swing }),
    });
    lines.push(
      `${last.costMs === undefined ? '' : last.costMs.toFixed(1)}|${last.fps}|${
        last.size
      }`,
    );
  }
  return { lines, last };
};

it('holds the line still while the frames only wobble', () => {
  const settler = createStudioReadingSettler();
  // A second to settle, then two seconds of the jitter every GPU has.
  run(settler, { seconds: 1, fps: 60, costMs: 4 });
  const { lines } = run(settler, {
    seconds: 2,
    fps: 60,
    costMs: 4,
    wobble: 0.35,
  });
  const moved = lines.filter(
    (line, index) => index > 0 && line !== lines[index - 1],
  );
  expect(moved).toHaveLength(0);
});

it('follows a real change, and settles within a tenth of it', () => {
  const settler = createStudioReadingSettler();
  run(settler, { seconds: 1, fps: 60, costMs: 4 });
  const heavier = run(settler, { seconds: 2, fps: 60, costMs: 9 });
  // Within one step of the measurement: the hold is what keeps it still.
  expect(heavier.last.costMs ?? 0).toBeGreaterThanOrEqual(8.9);
  expect(heavier.last.costMs ?? 0).toBeLessThanOrEqual(9.1);
  const lighter = run(settler, { seconds: 2, fps: 60, costMs: 2 });
  expect(lighter.last.costMs ?? 0).toBeGreaterThanOrEqual(1.9);
  expect(lighter.last.costMs ?? 0).toBeLessThanOrEqual(2.1);
});

// The half-life is wall-clock, so the same wobble is ignored and the same
// change arrives at 30, 60 and 144 frames a second.
it.each([
  [30, 30],
  [60, 60],
  // Past a hundred the rate is shown in fives, so 144 reads as 145: a frame
  // either way there is a fifth of a percent, and the rate wanders by more.
  [144, 145],
])('reads the same at %i frames a second', (fps, shown) => {
  const settler = createStudioReadingSettler();
  run(settler, { seconds: 1, fps, costMs: 4, wobble: 0.3 });
  const { last } = run(settler, { seconds: 2, fps, costMs: 8, wobble: 0.3 });
  expect(last.costMs ?? 0).toBeGreaterThanOrEqual(7.9);
  expect(last.costMs ?? 0).toBeLessThanOrEqual(8.1);
  expect(last.fps).toBe(shown);
});

it('keeps the GPU time through the frames its timer does not answer', () => {
  const settler = createStudioReadingSettler();
  const intervalMs = 1000 / 120;
  run(settler, { seconds: 1, fps: 120, costMs: 1.2 });
  // The timer answers one frame in four. In between the line has to stay as
  // it is: dropping the milliseconds changed its shape sixty times a second.
  const lines = new Set<string>();
  for (let frame = 0; frame < 240; frame += 1) {
    const reading = settler.frame({
      intervalMs,
      scale: 1,
      ...(frame % 4 === 0 ? { costMs: 1.2 } : {}),
    });
    lines.add(
      `${reading.costMs === undefined ? 'none' : reading.costMs.toFixed(1)}`,
    );
  }
  expect([...lines]).toEqual(['1.2']);
});

it('counts the frames that arrive, not the speed of the quick ones', () => {
  const settler = createStudioReadingSettler();
  // Frames alternating 8 ms and 24 ms arrive 62 times a second. Easing the
  // interval instead of the rate would call that 50.
  let fps = 0;
  for (let frame = 0; frame < 400; frame += 1) {
    fps = settler.frame({ intervalMs: frame % 2 === 0 ? 8 : 24, scale: 1 }).fps;
  }
  expect(fps).toBeGreaterThan(60);
  expect(fps).toBeLessThan(65);
});

it('counts the frames that really arrive, not the display beat the runner works to', () => {
  const settler = createStudioReadingSettler();
  // The runner's own interval is the low quartile of the recent gaps — here
  // it says 120 a second while the frames are actually 40 ms apart.
  let last = settler.frame({ intervalMs: 1000 / 120, scale: 1, atMs: 0 });
  for (let frame = 1; frame <= 120; frame += 1) {
    last = settler.frame({
      intervalMs: 1000 / 120,
      scale: 1,
      atMs: frame * 40,
    });
  }
  expect(last.fps).toBe(25);
});

it('leaves a stall out of the rate rather than counting it as a frame', () => {
  const settler = createStudioReadingSettler();
  let at = 0;
  const run = (frames: number, gap: number) => {
    let last = { fps: 0 };
    for (let frame = 0; frame < frames; frame += 1) {
      at += gap;
      last = settler.frame({ intervalMs: gap, scale: 1, atMs: at });
    }
    return last;
  };
  run(120, 1000 / 60);
  // The page was away for four seconds; the next frame is not one a second.
  at += 4000;
  settler.frame({ intervalMs: 1000 / 60, scale: 1, atMs: at });
  expect(run(2, 1000 / 60).fps).toBe(60);
});

it('says the resolution in the words the rows above it use', () => {
  const settler = createStudioReadingSettler();
  // `best` smoothing draws twice the panel each way and averages down. That
  // is how the edges are finished, not the resolution: full is full, and a
  // Resolution row that only ever says up to 100% had a reading beside it
  // that said 200%.
  expect(settler.frame({ intervalMs: 8, scale: 2 }).size).toBe(100);
  expect(settler.frame({ intervalMs: 8, scale: 1.4 }).size).toBe(100);
  // Below the panel, the ladder's own steps, as the menu names them.
  expect(settler.frame({ intervalMs: 8, scale: 0.67 }).size).toBe(67);
  expect(settler.frame({ intervalMs: 8, scale: 0.35 }).size).toBe(35);
});

it('shows the size the controller chose, exactly as it chose it', () => {
  const settler = createStudioReadingSettler();
  const { last } = run(settler, {
    seconds: 1,
    fps: 60,
    costMs: 6,
    scale: 0.67,
  });
  expect(last.size).toBe(67);
  // And a step the controller takes is on the card at once, not eased into.
  expect(
    settler.frame({ intervalMs: 1000 / 60, scale: 1, costMs: 6 }).size,
  ).toBe(100);
});

it('leaves out the GPU time where the card cannot measure it', () => {
  const settler = createStudioReadingSettler();
  const reading = settler.frame({ intervalMs: 1000 / 60, scale: 1 });
  expect(reading.costMs).toBeUndefined();
  expect(reading.fps).toBe(60);
});

/**
 * The page hands the worker a frame only when the last one is answered, so a
 * Studio window busy for three refreshes sends 80 a second while the worker
 * fills a 240 Hz panel. The rate on the card is the worker's own count.
 */
const runShown = (
  settler: TSettler,
  {
    answers,
    pageGapMs,
    framesPerAnswer,
    start,
  }: {
    answers: number;
    pageGapMs: number;
    framesPerAnswer: number;
    start: { frames: number; atMs: number };
  },
) => {
  let last = { fps: 0 };
  const shown = { ...start };
  const readings: number[] = [];
  for (let answer = 0; answer < answers; answer += 1) {
    shown.frames += framesPerAnswer;
    shown.atMs += pageGapMs;
    last = settler.frame({
      intervalMs: pageGapMs,
      scale: 1,
      atMs: shown.atMs,
      shown: { ...shown },
    });
    readings.push(last.fps);
  }
  return { last, shown, readings };
};

it('counts the frames the worker put on the canvas, not how often the page handed it the music', () => {
  const settler = createStudioReadingSettler();
  const { last } = runShown(settler, {
    answers: 200,
    pageGapMs: 12.5,
    framesPerAnswer: 3,
    start: { frames: 0, atMs: 0 },
  });
  expect(last.fps).toBe(240);
});

it('keeps the figure through an answer with no new frame in it', () => {
  const settler = createStudioReadingSettler();
  const { shown } = runShown(settler, {
    answers: 200,
    pageGapMs: 12.5,
    framesPerAnswer: 3,
    start: { frames: 0, atMs: 0 },
  });
  // The same count again: nothing was drawn between the two answers.
  expect(
    settler.frame({
      intervalMs: 12.5,
      scale: 1,
      atMs: shown.atMs + 12.5,
      shown: { ...shown },
    }).fps,
  ).toBe(240);
});

it('starts the count over for a worker built again, never reading it backwards', () => {
  const settler = createStudioReadingSettler();
  runShown(settler, {
    answers: 200,
    pageGapMs: 12.5,
    framesPerAnswer: 3,
    start: { frames: 0, atMs: 0 },
  });
  // A new worker counts from nothing on a clock of its own.
  const { readings, last } = runShown(settler, {
    answers: 240,
    pageGapMs: 1000 / 60,
    framesPerAnswer: 1,
    start: { frames: 0, atMs: 0 },
  });
  expect(Math.min(...readings)).toBeGreaterThanOrEqual(60);
  expect(Math.max(...readings)).toBeLessThanOrEqual(240);
  expect(last.fps).toBe(60);
});
