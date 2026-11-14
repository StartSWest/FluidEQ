/**
 * @jest-environment node
 */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  appRelaunchArguments,
  causeLine,
  clearStartFailures,
  ERROR_RESTART_ARGUMENT,
  markLaunch,
  readStartFailures,
  recordFatal,
  START_FAILURE_LIMIT,
  START_REPORT_ARGUMENT,
  START_WINDOW_MS,
} from '../../../main/startFailures';

const T0 = Date.parse('2026-11-14T10:00:00Z');
const BUG = new ReferenceError("Cannot access 's' before initialization");

describe('a start that keeps failing', () => {
  let dir: string;
  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'start-failures-'));
  });
  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  /** One launch that dies `after` ms in, as 2.5.2 did five seconds in. */
  const failedLaunch = (at: number, after = 5_000, wasRestarted = true) => {
    markLaunch(dir, at);
    return recordFatal(dir, at + after, BUG, wasRestarted);
  };

  it('relaunches twice, then ends on the report window', () => {
    expect(failedLaunch(T0, 5_000, false).decision).toBe('relaunch');
    expect(failedLaunch(T0 + 10_000).decision).toBe('relaunch');
    const third = failedLaunch(T0 + 20_000);
    expect(third.decision).toBe('report');
    expect(third.state).toEqual({
      launchedAt: T0 + 20_000,
      failedStarts: START_FAILURE_LIMIT,
      cause: "ReferenceError: Cannot access 's' before initialization",
    });
  });

  it('starts counting again after a start that went well (the control)', () => {
    failedLaunch(T0, 5_000, false);
    failedLaunch(T0 + 10_000);
    // The next launch is quit by the user: a clean start.
    markLaunch(dir, T0 + 20_000);
    clearStartFailures(dir);
    expect(readStartFailures(dir).failedStarts).toBe(0);
    const next = failedLaunch(T0 + 30_000, 5_000, false);
    expect(next.decision).toBe('relaunch');
    expect(next.state.failedStarts).toBe(1);
  });

  it('does not count a fatal error long after starting, and relaunches once for it', () => {
    failedLaunch(T0, 5_000, false);
    const late = failedLaunch(T0 + 10_000, START_WINDOW_MS + 1, false);
    expect(late.decision).toBe('relaunch');
    expect(late.state.failedStarts).toBe(0);
    // The relaunch dies late too: no loop, as before.
    expect(failedLaunch(T0 + 200_000, START_WINDOW_MS + 1, true).decision).toBe(
      'stop',
    );
  });

  it('reads a file it cannot use as a first launch', () => {
    fs.writeFileSync(path.join(dir, 'start-failures.json'), '{not json');
    expect(readStartFailures(dir)).toEqual({ failedStarts: 0 });
    expect(failedLaunch(T0, 5_000, false).state.failedStarts).toBe(1);
  });
});

describe('the pieces of a relaunch', () => {
  it('names the error by its first line', () => {
    expect(causeLine(new Error('first\n    at stack'))).toBe('Error: first');
    expect(causeLine('plain')).toBe('plain');
    expect(causeLine(new Error('x'.repeat(900))).length).toBeLessThan(420);
  });

  it('takes its own marks off the arguments it relaunches with', () => {
    expect(
      appRelaunchArguments([
        'FluidEQ.exe',
        '--updated',
        ERROR_RESTART_ARGUMENT,
        START_REPORT_ARGUMENT,
      ]),
    ).toEqual(['--updated']);
  });
});
