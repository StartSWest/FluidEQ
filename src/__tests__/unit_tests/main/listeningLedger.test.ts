/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * This computer's listening tally: per account, capped, a fortnight long,
 * remembering what was sent and what each account answered.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { createListeningLedger } from '../../../main/usage/listeningLedger';

const DAY = 24 * 60 * 60 * 1000;
const NOON = new Date(2026, 9, 21, 12).getTime();

let dir: string;
let now = NOON;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-listening-'));
  now = NOON;
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const ledger = () =>
  createListeningLedger({ userDataDir: dir, now: () => now });

describe('the listening tally', () => {
  it('counts whole minutes per account, and never one as the other', () => {
    const tally = ledger();
    tally.accrue('a', 125);
    tally.accrue('b', 60);
    expect(tally.todayMinutes('a')).toBe(2);
    expect(tally.todayMinutes('b')).toBe(1);
    expect(tally.pending('a')).toEqual([{ day: '2026-10-21', minutes: 2 }]);
  });

  it('holds a day to sixteen hours', () => {
    const tally = ledger();
    tally.accrue('a', 20 * 3600);
    expect(tally.todayMinutes('a')).toBe(16 * 60);
  });

  it('sends a day again only once it has grown', () => {
    const tally = ledger();
    tally.accrue('a', 180);
    tally.markUploaded('a', { day: '2026-10-21', minutes: 3 });
    expect(tally.pending('a')).toEqual([]);
    tally.accrue('a', 60);
    expect(tally.pending('a')).toEqual([{ day: '2026-10-21', minutes: 4 }]);
  });

  it('keeps only the fortnight the server still takes', () => {
    const tally = ledger();
    tally.accrue('a', 120);
    now = NOON + 20 * DAY;
    tally.accrue('a', 60);
    expect(tally.pending('a').map((day) => day.day)).toEqual(['2026-11-10']);
  });

  it('remembers each account’s answer across launches, and forgets one taken back', () => {
    ledger().setSharing('a', true);
    ledger().setSharing('b', false);
    const read = ledger();
    expect(read.sharing('a')).toBe(true);
    expect(read.sharing('b')).toBe(false);
    expect(read.sharing('c')).toBeUndefined();
    read.setSharing('a', undefined);
    expect(ledger().sharing('a')).toBeUndefined();
  });

  it('clears one account’s days and leaves the other’s', () => {
    const tally = ledger();
    tally.accrue('a', 120);
    tally.accrue('b', 120);
    tally.setSharing('a', false);
    tally.clearDays('a');
    expect(tally.pending('a')).toEqual([]);
    expect(ledger().pending('b')).toHaveLength(1);
    expect(ledger().sharing('a')).toBe(false);
  });

  it('starts from nothing on a file that does not read', () => {
    fs.writeFileSync(path.join(dir, 'listening-ledger.json'), '{not json');
    expect(ledger().pending('a')).toEqual([]);
    fs.writeFileSync(
      path.join(dir, 'listening-ledger.json'),
      JSON.stringify({ a: { days: { nope: { seconds: 1, uploaded: 0 } } } }),
    );
    expect(ledger().pending('a')).toEqual([]);
  });
});
