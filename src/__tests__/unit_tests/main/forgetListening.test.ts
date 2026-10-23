/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * The leaderboard's tally is deleted at launch, and nothing else in the
 * folder: the computer id and the statistics' own tally stay.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import forgetListening from '../../../main/usage/forgetListening';

let dir: string;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-forget-'));
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const write = (name: string) =>
  fs.writeFileSync(path.join(dir, name), '{"optedIn":true,"days":{}}');

describe('what the leaderboard left behind', () => {
  it('deletes the board tally, and nothing beside it', () => {
    write('usage-ledger.json');
    // The id the statistics use too, their own tally, and the scene plays.
    write('computer-id.json');
    write('listening-ledger.json');
    write('scene-plays.json');
    const warn = jest.fn();

    forgetListening(dir, { warn });

    expect(fs.readdirSync(dir).sort()).toEqual([
      'computer-id.json',
      'listening-ledger.json',
      'scene-plays.json',
    ]);
    expect(warn).not.toHaveBeenCalled();
  });

  it('says nothing when there is nothing to delete', () => {
    const warn = jest.fn();
    forgetListening(dir, { warn });
    forgetListening(dir, { warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a file it could not remove', () => {
    // A folder by that name cannot be unlinked.
    fs.mkdirSync(path.join(dir, 'usage-ledger.json'));
    const warn = jest.fn();

    forgetListening(dir, { warn });

    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('usage-ledger.json');
  });
});
