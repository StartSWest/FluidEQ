/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * Which part of FluidEQ the processor time went to, for a bug report from a
 * slow machine (Ivan, 2026-10-28: "logs for app performance in general to
 * track on slow pcs which feature causes more cpu and gpu usage ... sent with
 * the bug report").
 *
 * Every process keeps a running total of its processor time, so nothing here
 * samples on a clock: each time what is on screen changes (the page, the look
 * on the graph, the window shown or put away) the totals are read once, and
 * what each process used since the last read is booked to what was on screen
 * until then. A bug report reads them once more, writes one line per thing
 * that was on screen into the log it is about to collect, and starts again.
 * The graphics process stands for the GPU: Chromium does its drawing there,
 * and no GPU load is exposed per application.
 */

import type { IAppProcess, TProcessRole } from './processRoles';

/** What a reading needs from each process: who it is and its time so far. */
export type TProcessReading = Pick<
  IAppProcess,
  'pid' | 'role' | 'cpuSeconds' | 'memoryMb'
>;

interface IScreenTotals {
  seconds: number;
  cpu: Map<TProcessRole, number>;
  peakMemoryMb: number;
}

/** Below this the time on screen says nothing about what it costs. */
const MIN_SECONDS_REPORTED = 5;

export const createPerformanceLog = (now: () => number) => {
  let onScreen = 'starting';
  let readAt: number | undefined;
  let cpuByPid = new Map<number, number>();
  const totals = new Map<string, IScreenTotals>();

  /** Books what every process used since the last reading to `onScreen`. */
  const book = (readings: readonly TProcessReading[]) => {
    const at = now();
    const next = new Map<number, number>();
    const entry = totals.get(onScreen) ?? {
      seconds: 0,
      cpu: new Map<TProcessRole, number>(),
      peakMemoryMb: 0,
    };
    let memoryMb = 0;
    readings.forEach(({ pid, role, cpuSeconds, memoryMb: memory }) => {
      memoryMb += memory ?? 0;
      if (cpuSeconds === undefined) {
        return;
      }
      next.set(pid, cpuSeconds);
      const before = cpuByPid.get(pid);
      // A process that appeared since the last reading started inside this
      // stretch, so all of its time so far belongs to it; one that restarted
      // under the same id counts from zero again.
      const used =
        before === undefined || before > cpuSeconds
          ? cpuSeconds
          : cpuSeconds - before;
      if (readAt !== undefined && used > 0) {
        entry.cpu.set(role, (entry.cpu.get(role) ?? 0) + used);
      }
    });
    if (readAt !== undefined) {
      entry.seconds += (at - readAt) / 1000;
      entry.peakMemoryMb = Math.max(entry.peakMemoryMb, memoryMb);
      totals.set(onScreen, entry);
    }
    cpuByPid = next;
    readAt = at;
  };

  return {
    /** What is on screen now; `readings` close the stretch before it. */
    show(readings: readonly TProcessReading[], screen: string) {
      book(readings);
      onScreen = screen;
    },
    /**
     * One line per thing that was on screen since the last report, the
     * costliest first, as percent of one processor core per process kind.
     * Starts the next report's count afresh.
     */
    report(readings: readonly TProcessReading[]): string[] {
      book(readings);
      const lines = [...totals.entries()]
        .filter(([, entry]) => entry.seconds >= MIN_SECONDS_REPORTED)
        .map(([screen, entry]) => {
          const shares = [...entry.cpu.entries()]
            .map(([role, seconds]) => ({
              role,
              percent: (100 * seconds) / entry.seconds,
            }))
            .filter(({ percent }) => percent >= 0.5)
            .sort((a, b) => b.percent - a.percent);
          const total = shares.reduce((sum, { percent }) => sum + percent, 0);
          return { screen, entry, shares, total };
        })
        .sort((a, b) => b.total - a.total)
        .map(({ screen, entry, shares, total }) => {
          const minutes = (entry.seconds / 60).toFixed(1);
          const each = shares
            .map(({ role, percent }) => `${role} ${percent.toFixed(1)}%`)
            .join(', ');
          return `Performance: ${screen} for ${minutes} min, ${total.toFixed(1)}% of one core${each ? ` (${each})` : ''}, up to ${Math.round(entry.peakMemoryMb)} MB`;
        });
      totals.clear();
      return lines;
    },
  };
};

export type TPerformanceLog = ReturnType<typeof createPerformanceLog>;
