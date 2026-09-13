/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { IAppProcess } from '../../main/ipc/processes';

/**
 * How much history one CPU figure is fitted over.
 *
 * A span of measurement, not a schedule: nothing waits for it. The list asks
 * for new figures once per painted frame, and Windows charges CPU time in
 * scheduler ticks of 15.6 ms — so the plain difference of two totals a second
 * apart is off by up to 1.6 points either way, and read every frame it
 * flicked a steady 3.6% process between 1.5, 3.1 and 4.6 several times a
 * second in the harness. A least-squares slope through every sample of the
 * span averages that quantisation away (about 0.1 point of noise at 60
 * frames a second over two seconds), and still moves the moment the load
 * does.
 */
export const CPU_FIT_SPAN_MS = 2_000;

/**
 * How far a figure has to move before the table shows the new one.
 *
 * Asked sixty times a second, a working set wanders by a few hundred
 * kilobytes and the fitted CPU by a tenth, and a number redrawn on every
 * wobble cannot be read — which is what the old one-second refresh was for.
 * A leak climbing, a spike, a process going quiet all move well past these.
 */
const MEMORY_BAND_MB = 2;
const CPU_BAND_PERCENT = 0.4;

interface IPoint {
  at: number;
  cpuSeconds: number;
}

export interface IProcessReadings {
  /**
   * Folds in one answer from main and returns the rows to show, or undefined
   * when nothing visible changed — so a frame that moved no figure past its
   * band does not re-render the table.
   */
  take(rows: readonly IAppProcess[], at: number): IAppProcess[] | undefined;
}

const settle = (
  shown: number | undefined,
  next: number | undefined,
  band: number,
  round: (value: number) => number,
): number | undefined => {
  if (next === undefined) {
    return undefined;
  }
  const rounded = round(next);
  // Zero is let through inside the band: a process that has gone idle must
  // not keep showing the 0.3% it had on the way down.
  if (
    shown === undefined ||
    Math.abs(next - shown) >= band ||
    (rounded === 0 && shown !== 0)
  ) {
    return rounded;
  }
  return shown;
};

const tenths = (value: number) => Math.round(value * 10) / 10;

/** Share of one core: the slope of CPU seconds against wall time. */
const fittedPercent = (points: readonly IPoint[]): number => {
  const meanAt = points.reduce((sum, p) => sum + p.at, 0) / points.length;
  const meanCpu =
    points.reduce((sum, p) => sum + p.cpuSeconds, 0) / points.length;
  let covariance = 0;
  let variance = 0;
  points.forEach((p) => {
    covariance += (p.at - meanAt) * (p.cpuSeconds - meanCpu);
    variance += (p.at - meanAt) ** 2;
  });
  // Seconds of CPU per millisecond of wall time, as a percentage. The totals
  // only grow, but a fit through quantised steps can dip a hair below zero.
  return variance === 0 ? 0 : Math.max(0, (covariance / variance) * 1e5);
};

/** The same pid, role and figures — anything else is a row worth redrawing. */
const sameRow = (a: IAppProcess, b: IAppProcess) =>
  a.pid === b.pid &&
  a.role === b.role &&
  a.detail === b.detail &&
  a.memoryMb === b.memoryMb &&
  a.cpuPercent === b.cpuPercent;

export const createProcessReadings = (): IProcessReadings => {
  const series = new Map<number, IPoint[]>();
  let shown: IAppProcess[] = [];

  /**
   * Adds a point to a process's series and fits the span it now covers.
   *
   * Undefined until the series spans a whole `CPU_FIT_SPAN_MS` — a dash, which
   * the footnote already explains, rather than a first figure fitted through
   * a handful of ticks. A total that went backwards means the pid now belongs
   * to a different process, so the old series is dropped and measuring
   * starts again.
   */
  const cpuFor = (pid: number, cpuSeconds: number, at: number) => {
    const known = series.get(pid) ?? [];
    const last = known[known.length - 1];
    const points =
      last !== undefined && cpuSeconds < last.cpuSeconds ? [] : known;
    points.push({ at, cpuSeconds });
    // One point older than the span is kept, so the fit always covers the
    // whole of it; everything before that is spent.
    const firstInSpan = points.findIndex((p) => p.at > at - CPU_FIT_SPAN_MS);
    const trimmed = firstInSpan > 1 ? points.slice(firstInSpan - 1) : points;
    series.set(pid, trimmed);
    return at - trimmed[0].at < CPU_FIT_SPAN_MS
      ? undefined
      : fittedPercent(trimmed);
  };

  return {
    take: (rows, at) => {
      const previous = new Map(shown.map((row) => [row.pid, row]));
      const next = rows.map((row): IAppProcess => {
        const last = previous.get(row.pid);
        // A row that has no running total (the DSP host reports its own
        // half-second percentage) keeps the percentage it arrived with.
        const cpu =
          row.cpuSeconds === undefined
            ? row.cpuPercent
            : cpuFor(row.pid, row.cpuSeconds, at);
        return {
          pid: row.pid,
          role: row.role,
          detail: row.detail,
          memoryMb: settle(
            last?.memoryMb,
            row.memoryMb,
            MEMORY_BAND_MB,
            Math.round,
          ),
          cpuPercent: settle(last?.cpuPercent, cpu, CPU_BAND_PERCENT, tenths),
        };
      });

      // A process that has gone takes its history with it.
      const present = new Set(rows.map((row) => row.pid));
      [...series.keys()]
        .filter((pid) => !present.has(pid))
        .forEach((pid) => series.delete(pid));

      const changed =
        next.length !== shown.length ||
        next.some((row, index) => !sameRow(row, shown[index]));
      shown = next;
      return changed ? next : undefined;
    },
  };
};
