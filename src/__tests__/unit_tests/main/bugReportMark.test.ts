/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Where one report's logs end and the next one's begin.
 *
 * The mark moves only when a report is delivered, with the moment that
 * report gathered its logs — so a dialog closed without sending, or a bad
 * value, leaves the next report starting where it would have anyway.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { readBugReportMark, writeBugReportMark } from 'main/bugReportMark';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-report-mark-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('the bug report mark', () => {
  it('is nothing on a machine nobody has reported from', async () => {
    await expect(readBugReportMark(dir)).resolves.toBeUndefined();
  });

  it('remembers the gather moment of the delivered report', async () => {
    await writeBugReportMark(dir, '2026-09-15T12:00:00.000Z');
    await expect(readBugReportMark(dir)).resolves.toBe(
      '2026-09-15T12:00:00.000Z',
    );
  });

  it('refuses a mark that is not a time', async () => {
    await writeBugReportMark(dir, 'yesterday-ish');
    await expect(readBugReportMark(dir)).resolves.toBeUndefined();
  });

  it('ignores a file somebody else wrote', async () => {
    fs.writeFileSync(path.join(dir, 'bug-report-mark.json'), '{"x":1}');
    await expect(readBugReportMark(dir)).resolves.toBeUndefined();
  });
});
