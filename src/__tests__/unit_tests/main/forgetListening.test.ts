/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * The leaderboard's files are deleted at launch: the listening tally and the
 * computer id, and nothing else in the folder.
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
  it('deletes every tally of use and the computer id, and nothing beside them', () => {
    write('usage-ledger.json');
    write('computer-id.json');
    // The tally the unreleased builds kept for the admin's statistics.
    write('listening-ledger.json');
    // The seconds each scene was on screen, for the admin's favourites.
    write('scene-plays.json');
    // The positive control: the app's own state sits beside them and stays.
    write('state.json');
    const warn = jest.fn();

    forgetListening(dir, { warn });

    expect(fs.readdirSync(dir)).toEqual(['state.json']);
    expect(warn).not.toHaveBeenCalled();
  });

  it('says nothing when there is nothing to delete', () => {
    const warn = jest.fn();
    forgetListening(dir, { warn });
    forgetListening(dir, { warn });
    expect(warn).not.toHaveBeenCalled();
  });

  it('logs a file it could not remove, and carries on with the other', () => {
    // A folder by that name cannot be unlinked.
    fs.mkdirSync(path.join(dir, 'usage-ledger.json'));
    write('computer-id.json');
    const warn = jest.fn();

    forgetListening(dir, { warn });

    expect(fs.existsSync(path.join(dir, 'computer-id.json'))).toBe(false);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0][0]).toContain('usage-ledger.json');
  });
});
