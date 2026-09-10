/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  createUsageLedger,
  DAILY_CAP_MINUTES,
  KEEP_DAYS,
  localDayKey,
  minutesOf,
} from '../../../main/usage/usageLedger';
import {
  accrueFromFrame,
  MAX_FRAME_GAP_SECONDS,
} from '../../../renderer/usage/usageAccrual';

const DAY_MS = 24 * 60 * 60 * 1000;
// Noon local, so a day key never straddles midnight in any zone the CI runs in.
const NOON = new Date(2026, 8, 7, 12).getTime();

describe('what one frame is worth', () => {
  it('counts the gap since the previous frame while music plays', () => {
    expect(accrueFromFrame(1000, 1045, true)).toBeCloseTo(0.045);
  });

  it('counts nothing in silence, on the first frame, or going backwards', () => {
    expect(accrueFromFrame(1000, 1045, false)).toBe(0);
    expect(accrueFromFrame(undefined, 1045, true)).toBe(0);
    expect(accrueFromFrame(2000, 1000, true)).toBe(0);
  });

  /** A window hidden for an hour did not listen for an hour. */
  it('caps a long gap so a sleep or a hidden window is not counted as listening', () => {
    expect(accrueFromFrame(0, 60 * 60 * 1000, true)).toBe(
      MAX_FRAME_GAP_SECONDS,
    );
  });
});

describe('the usage ledger', () => {
  let directory: string;
  let clock: number;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-usage-'));
    clock = NOON;
  });

  afterEach(() => {
    fs.rmSync(directory, { force: true, recursive: true });
  });

  const build = () =>
    createUsageLedger({ userDataDir: directory, now: () => clock });

  it('starts opted out with nothing counted', () => {
    const ledger = build();
    expect(ledger.optedIn()).toBe(false);
    expect(ledger.today()).toEqual({ day: localDayKey(NOON), minutes: 0 });
    expect(ledger.pending()).toEqual([]);
  });

  it('accrues seconds into whole minutes for the local day, and survives a restart', () => {
    const ledger = build();
    ledger.accrue(90);
    ledger.accrue(45);
    expect(ledger.today().minutes).toBe(2);
    expect(build().today().minutes).toBe(2);
  });

  it('caps a day at sixteen hours', () => {
    const ledger = build();
    ledger.accrue(20 * 60 * 60);
    expect(ledger.today().minutes).toBe(DAILY_CAP_MINUTES);
    expect(minutesOf(10 ** 9)).toBe(DAILY_CAP_MINUTES);
  });

  it('starts a new tally when the local day changes', () => {
    const ledger = build();
    ledger.accrue(600);
    clock += DAY_MS;
    ledger.accrue(60);
    expect(ledger.today().minutes).toBe(1);
    expect(ledger.pending()).toEqual([
      { day: localDayKey(NOON), minutes: 10 },
      { day: localDayKey(NOON + DAY_MS), minutes: 1 },
    ]);
  });

  it('reports only what has grown since the last upload', () => {
    const ledger = build();
    ledger.accrue(600);
    const [today] = ledger.pending();
    ledger.markUploaded(today.day, today.minutes);
    expect(ledger.pending()).toEqual([]);
    ledger.accrue(60);
    expect(ledger.pending()).toEqual([{ day: today.day, minutes: 11 }]);
  });

  it('ignores an upload mark that would move backwards', () => {
    const ledger = build();
    ledger.accrue(600);
    ledger.markUploaded(localDayKey(NOON), 10);
    ledger.markUploaded(localDayKey(NOON), 3);
    expect(ledger.pending()).toEqual([]);
  });

  it('forgets days older than the window', () => {
    const ledger = build();
    ledger.accrue(600);
    clock += (KEEP_DAYS + 1) * DAY_MS;
    ledger.accrue(60);
    expect(ledger.pending()).toEqual([{ day: localDayKey(clock), minutes: 1 }]);
  });

  it('ignores nonsense seconds', () => {
    const ledger = build();
    ledger.accrue(Number.NaN);
    ledger.accrue(-50);
    expect(ledger.today().minutes).toBe(0);
  });

  it('remembers the choice to join, and clears the days without it', () => {
    const ledger = build();
    ledger.setOptedIn(true);
    ledger.accrue(600);
    expect(build().optedIn()).toBe(true);
    ledger.clearDays();
    expect(ledger.today().minutes).toBe(0);
    expect(ledger.optedIn()).toBe(true);
  });

  it('reads a damaged file as empty rather than throwing', () => {
    fs.writeFileSync(path.join(directory, 'usage-ledger.json'), '{not json');
    expect(build().today().minutes).toBe(0);
  });
});
