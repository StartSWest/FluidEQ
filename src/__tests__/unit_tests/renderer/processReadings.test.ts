/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Processes list's figures, asked for once per painted frame.
 *
 * Windows charges CPU time in 15.6 ms scheduler ticks, so a percentage taken
 * from two totals a moment apart flicks between neighbouring values on a
 * steady process, and a working set wanders by a few hundred kilobytes. What
 * is held here is that a steady process reads steady, a real change still
 * shows at once, and the table is only redrawn when a figure moved.
 */

import type { IAppProcess } from '../../../main/ipc/processes';
import {
  CPU_FIT_SPAN_MS,
  createProcessReadings,
} from '../../../renderer/utils/processReadings';

const TICK_S = 0.0156;
const FRAME_MS = 1000 / 60;

/** A process's CPU total as Windows reports it: whole scheduler ticks. */
const quantised = (seconds: number) => Math.floor(seconds / TICK_S) * TICK_S;

const row = (over: Partial<IAppProcess> = {}): IAppProcess => ({
  pid: 7,
  role: 'window',
  memoryMb: 300,
  cpuSeconds: 0,
  ...over,
});

/** Feeds `frames` answers of a process using `share` of a core. */
const run = (
  readings: ReturnType<typeof createProcessReadings>,
  {
    share,
    frames,
    from = 0,
    memory = () => 300,
  }: {
    share: number;
    frames: number;
    from?: number;
    memory?: (frame: number) => number;
  },
) => {
  const shown: Array<IAppProcess[] | undefined> = [];
  for (let frame = 0; frame < frames; frame += 1) {
    const at = from + frame * FRAME_MS;
    shown.push(
      readings.take(
        [
          row({
            cpuSeconds: quantised((at / 1000) * share),
            memoryMb: memory(frame),
          }),
        ],
        at,
      ),
    );
  }
  return shown;
};

describe('the CPU figure', () => {
  it('waits for a whole span of history before showing one', () => {
    const readings = createProcessReadings();
    const shown = run(readings, {
      share: 0.036,
      frames: Math.floor(CPU_FIT_SPAN_MS / FRAME_MS),
    });
    expect(shown[0]?.[0].cpuPercent).toBeUndefined();
    const last = shown.filter(Boolean).pop();
    expect(last?.[0].cpuPercent).toBeUndefined();
  });

  it('reads a steady process steadily, where the plain difference flicked', () => {
    const readings = createProcessReadings();
    const shown = run(readings, { share: 0.036, frames: 60 * 6 });
    const figures = new Set(
      shown
        .flatMap((rows) => rows ?? [])
        .map((entry) => entry.cpuPercent)
        .filter((value): value is number => value !== undefined),
    );
    // One figure, near the true 3.6%, from the moment it appears.
    expect(figures.size).toBe(1);
    expect([...figures][0]).toBeCloseTo(3.6, 0);

    // The control: the difference of totals one frame apart, which is what a
    // percentage over a frame is, jumps between nothing and a whole tick.
    const perFrame = new Set(
      Array.from({ length: 60 }, (_, frame) => {
        const before = quantised((frame * FRAME_MS * 0.036) / 1000);
        const after = quantised(((frame + 1) * FRAME_MS * 0.036) / 1000);
        return Math.round(((after - before) / (FRAME_MS / 1000)) * 100);
      }),
    );
    expect([...perFrame].sort((x, y) => x - y)).toEqual([0, 94]);
  });

  it('follows a process that gets busy', () => {
    const readings = createProcessReadings();
    run(readings, { share: 0.02, frames: 60 * 3 });
    const busy = run(readings, {
      share: 0.5,
      frames: 60 * 3,
      from: 3000,
    })
      .flatMap((rows) => rows ?? [])
      .pop();
    expect(busy?.cpuPercent).toBeGreaterThan(40);
  });

  it('starts measuring again when a pid comes back as a different process', () => {
    const readings = createProcessReadings();
    run(readings, { share: 0.5, frames: 60 * 3 });
    // The total went backwards: not the process that was measured.
    const reused = readings.take([row({ cpuSeconds: 0.01 })], 3100);
    expect(reused?.[0].cpuPercent).toBeUndefined();
  });

  it('keeps the percentage a row brought when it has no running total', () => {
    const readings = createProcessReadings();
    const shown = readings.take(
      [{ pid: 99, role: 'engine', memoryMb: 64, cpuPercent: 1.3 }],
      0,
    );
    expect(shown?.[0].cpuPercent).toBe(1.3);
  });
});

describe('the table', () => {
  it('holds a memory figure through a wobble, and shows a real move', () => {
    const readings = createProcessReadings();
    const shown = run(readings, {
      share: 0,
      frames: 30,
      memory: (frame) => 300 + (frame % 2),
    });
    // The first answer draws the table; the one-megabyte wobble never does.
    expect(shown[0]?.[0].memoryMb).toBe(300);
    expect(shown.slice(1).every((rows) => rows === undefined)).toBe(true);

    const grown = readings.take([row({ cpuSeconds: 0, memoryMb: 305 })], 1000);
    expect(grown?.[0].memoryMb).toBe(305);
  });

  it('lets a process that went idle show zero at once', () => {
    const readings = createProcessReadings();
    const first = readings.take(
      [{ pid: 99, role: 'engine', memoryMb: 300, cpuPercent: 0.3 }],
      10,
    );
    expect(first?.[0].cpuPercent).toBe(0.3);
    // The control: a move inside the band to anything but zero is held.
    expect(
      readings.take(
        [{ pid: 99, role: 'engine', memoryMb: 300, cpuPercent: 0.2 }],
        15,
      ),
    ).toBeUndefined();
    const idle = readings.take(
      [{ pid: 99, role: 'engine', memoryMb: 300, cpuPercent: 0 }],
      20,
    );
    // Inside the band, but zero is let through.
    expect(idle?.[0].cpuPercent).toBe(0);
  });

  it('redraws when a process comes or goes', () => {
    const readings = createProcessReadings();
    readings.take([row()], 0);
    expect(readings.take([row()], 10)).toBeUndefined();
    expect(
      readings.take([row(), row({ pid: 8, role: 'graphics' })], 20),
    ).toHaveLength(2);
    expect(readings.take([row()], 30)).toHaveLength(1);
  });
});
