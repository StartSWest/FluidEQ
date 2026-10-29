/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
/** @jest-environment node */

import {
  createPerformanceLog,
  type TProcessReading,
} from '../../../main/performanceLog';

const reading = (
  window: number,
  graphics: number,
  memoryMb = 100,
): TProcessReading[] => [
  { pid: 1, role: 'core', cpuSeconds: 1, memoryMb },
  { pid: 2, role: 'window', cpuSeconds: window, memoryMb },
  { pid: 3, role: 'graphics', cpuSeconds: graphics, memoryMb },
];

const setup = () => {
  let clock = 0;
  const performanceLog = createPerformanceLog(() => clock);
  return {
    performanceLog,
    pass: (seconds: number) => {
      clock += seconds * 1000;
    },
  };
};

it('books each stretch of processor time to what was on screen during it', () => {
  const { performanceLog, pass } = setup();
  performanceLog.show(reading(0, 0), 'eq, app, look analyzer-auto');
  pass(60);
  // A minute on the EQ: 6 s of window and 3 s of graphics time.
  performanceLog.show(reading(6, 3), 'karaoke, app, look plus:alpine');
  pass(120);
  // Two minutes of Karaoke under a scene: 60 s and 48 s.
  const lines = performanceLog.report(reading(66, 51, 300));
  expect(lines).toEqual([
    'Performance: karaoke, app, look plus:alpine for 2.0 min, 90.0% of one core (window 50.0%, graphics 40.0%), up to 900 MB',
    'Performance: eq, app, look analyzer-auto for 1.0 min, 15.0% of one core (window 10.0%, graphics 5.0%), up to 300 MB',
  ]);
});

it('starts the next report afresh, and leaves out a glimpse too short to say anything', () => {
  const { performanceLog, pass } = setup();
  performanceLog.show(reading(0, 0), 'eq, app, look analyzer-auto');
  pass(60);
  performanceLog.report(reading(6, 3));
  pass(2);
  performanceLog.show(reading(7, 3), 'dsp, app, look analyzer-auto');
  pass(30);
  // The control: the stretch long enough is reported, the glimpse is not.
  expect(performanceLog.report(reading(10, 3))).toEqual([
    'Performance: dsp, app, look analyzer-auto for 0.5 min, 10.0% of one core (window 10.0%), up to 300 MB',
  ]);
});

it('counts a process that started or restarted inside a stretch from its own start', () => {
  const { performanceLog, pass } = setup();
  performanceLog.show(reading(10, 10), 'library, app, look analyzer-auto');
  pass(100);
  const restarted: TProcessReading[] = [
    { pid: 2, role: 'window', cpuSeconds: 5 },
    { pid: 9, role: 'desktop', cpuSeconds: 20 },
  ];
  expect(performanceLog.report(restarted)).toEqual([
    'Performance: library, app, look analyzer-auto for 1.7 min, 25.0% of one core (desktop 20.0%, window 5.0%), up to 0 MB',
  ]);
});
