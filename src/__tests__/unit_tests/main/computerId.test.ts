/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import readComputerId from '../../../main/usage/computerId';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('this computer’s id for the board', () => {
  let dir: string;

  beforeEach(() => {
    dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-computer-'));
  });

  afterEach(() => {
    fs.rmSync(dir, { recursive: true, force: true });
  });

  it('is made once, at random, and kept', () => {
    const first = readComputerId(dir);
    expect(first).toMatch(UUID);
    expect(readComputerId(dir)).toBe(first);
    // A second installation is another computer.
    const other = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-computer-'));
    try {
      expect(readComputerId(other)).not.toBe(first);
    } finally {
      fs.rmSync(other, { recursive: true, force: true });
    }
  });

  it('holds nothing but the number', () => {
    const id = readComputerId(dir);
    const stored: unknown = JSON.parse(
      fs.readFileSync(path.join(dir, 'computer-id.json'), 'utf8'),
    );
    expect(stored).toEqual({ id });
  });

  it('starts again from a damaged file rather than sending it', () => {
    fs.writeFileSync(path.join(dir, 'computer-id.json'), '{"id":"my-pc"}');
    const id = readComputerId(dir);
    expect(id).toMatch(UUID);
    expect(readComputerId(dir)).toBe(id);
  });
});
