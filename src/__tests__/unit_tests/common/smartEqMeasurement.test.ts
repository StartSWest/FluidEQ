/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The measurement the core runs, fed frame by frame: a checkpoint per second
 * of sound heard, a one-shot that ends with its answer, a running mode that
 * never does, a change of rate refused — and what a running mode makes of
 * its reports (`planSmartEqRewrite`): nothing until the estimate settles,
 * then the layer and the ranges it moved, and nothing again once written.
 */
import type { IBalanceReport, IBalanceResult } from 'common/autoBalanceCapture';
import type { ISmartEqSettings } from 'common/constants';
import { BALANCE_FRAME_INTERVAL_MS } from 'common/autoBalanceTuning';
import {
  type IMeasurementView,
  type IRawSourceFrame,
  createSmartEqMeasurement,
} from 'common/smartEqMeasurement';
import { DEFAULT_SMART_EQ_SETTINGS } from 'common/smartEqCore';
import { planSmartEqRewrite } from 'common/smartEqSolve';
import { presenceLineAt } from 'common/presenceLines';

/** 320 log-spaced points from 20 Hz to 20 kHz, like the live analyser. */
const AXIS = Array.from(
  { length: 320 },
  (_value, index) =>
    10 **
    (Math.log10(20) + (index / 319) * (Math.log10(20000) - Math.log10(20))),
);

/** Full-band music with a scooped middle, which every mode corrects. */
const levelAt = (frequency: number) =>
  -20 -
  8 * Math.log10(frequency / 20) -
  9 * Math.exp(-((Math.log2(frequency / 1500) / 0.8) ** 2));

const frameAt = (sampleRate = 48000): IRawSourceFrame => {
  const levels = Float64Array.from(AXIS, levelAt);
  return { axis: AXIS, levels, peakDb: Math.max(...levels), sampleRate };
};

const setUp = (isContinuous: boolean) => {
  let clock = 0;
  const views: IMeasurementView[] = [];
  const reports: IBalanceReport[] = [];
  const results: IBalanceResult[] = [];
  const failures: string[] = [];
  const measurement = createSmartEqMeasurement({
    isContinuous,
    lineOf: (edge, label, centre, typical) =>
      presenceLineAt({}, 'detail', edge, label, centre, typical),
    now: () => clock,
    onView: (view) => views.push(view),
    onReport: (report) => reports.push(report),
    onResult: (result) => results.push(result),
    onFailed: (reason) => failures.push(reason),
  });
  const hearSeconds = (count: number, sampleRate = 48000) => {
    const frames = Math.round((count * 1000) / BALANCE_FRAME_INTERVAL_MS);
    for (let index = 0; index < frames; index += 1) {
      clock += BALANCE_FRAME_INTERVAL_MS;
      measurement.hear(frameAt(sampleRate));
    }
  };
  return { measurement, views, reports, results, failures, hearSeconds };
};

it('checks in as it starts and then once per second of sound heard, drawing each range as it goes', () => {
  const { reports, views, hearSeconds } = setUp(true);
  hearSeconds(0.5);
  expect(reports).toHaveLength(1);
  expect(views[views.length - 1].presenceLevels.length).toBeGreaterThan(0);
  hearSeconds(3);
  expect(reports).toHaveLength(4);
});

it('ends a one-shot with its answer, and hears nothing after', () => {
  const { results, views, reports, hearSeconds } = setUp(false);
  hearSeconds(60);
  expect(results).toHaveLength(1);
  expect(views[views.length - 1].presenceLevels).toEqual([]);
  const heard = reports.length;
  hearSeconds(5);
  expect(reports).toHaveLength(heard);
});

it('keeps a running mode going for as long as there is sound', () => {
  const { results, reports, hearSeconds } = setUp(true);
  hearSeconds(60);
  expect(results).toHaveLength(0);
  expect(reports.length).toBeGreaterThan(50);
});

it('refuses a change of rate rather than mixing two axes', () => {
  const { failures, views, hearSeconds } = setUp(true);
  hearSeconds(1);
  hearSeconds(0.1, 44100);
  expect(failures).toEqual(['eq.smart.error.formatChanged']);
  expect(views[views.length - 1].presenceLevels).toEqual([]);
});

it('starts again from nothing on a new song', () => {
  const { measurement, reports, views, hearSeconds } = setUp(true);
  hearSeconds(2);
  expect(reports[reports.length - 1].listenedMs).toBeGreaterThan(1000);
  measurement.restart();
  expect(views[views.length - 1].progress).toBeUndefined();
  hearSeconds(0.5);
  expect(reports[reports.length - 1].listenedMs).toBeLessThan(100);
});

it('says silence at once, without waiting for a checkpoint', () => {
  const { measurement, views, hearSeconds } = setUp(true);
  hearSeconds(1.2);
  measurement.setSilent(true);
  expect(views[views.length - 1].progress?.isSilent).toBe(true);
});

it('writes a running mode’s answer only once it has settled, and only once', () => {
  const { reports, hearSeconds } = setUp(true);
  hearSeconds(20);
  // Heard well enough to answer, but still moving.
  const early = reports.find(
    (report) =>
      !report.isConverged && report.regions.some((region) => region.isCovered),
  );
  const settled = reports.filter((report) => report.isConverged);
  expect(early).toBeDefined();
  expect(settled.length).toBeGreaterThan(0);
  const settings = { ...DEFAULT_SMART_EQ_SETTINGS, mode: 'detail' as const };
  expect(
    planSmartEqRewrite(early as IBalanceReport, undefined, settings),
  ).toBeUndefined();
  const last = settled[settled.length - 1];
  const plan = planSmartEqRewrite(last, undefined, settings);
  expect(plan?.layer?.filters).toBeDefined();
  expect(plan?.moved.length).toBeGreaterThan(0);
  // Written, the same answer is nothing to write again — nor one that
  // differs from what is written by less than anybody could hear.
  expect(planSmartEqRewrite(last, plan?.layer, settings)).toBeUndefined();
  const written = plan?.layer as ISmartEqSettings;
  const [first] = Object.keys(written.filters);
  const nudged = {
    ...written,
    filters: {
      ...written.filters,
      [first]: {
        ...written.filters[first],
        gain: written.filters[first].gain + 0.1,
      },
    },
  };
  expect(planSmartEqRewrite(last, nudged, settings)).toBeUndefined();
  // A record that has dropped an end of its spectrum is not answered.
  expect(
    planSmartEqRewrite({ ...last, isBandLimited: true }, undefined, settings),
  ).toBeUndefined();
});
