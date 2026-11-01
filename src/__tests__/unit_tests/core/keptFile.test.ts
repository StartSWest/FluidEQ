/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A copy the core keeps in a file of its own: read once, written only when
 * it changes, and never a reason for the sound to wait — a file that cannot
 * be written keeps the new value for the session and says so once.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createKeptFile } from 'core/files/keptFile';

let dir: string;
const log = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };

const parse = (raw: unknown): string[] =>
  Array.isArray(raw) ? raw.filter((one) => typeof one === 'string') : [];

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-kept-'));
  log.warn.mockClear();
});

afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const kept = (file = path.join(dir, 'list.json')) =>
  createKeptFile({ filePath: file, parse, empty: [] as string[], log });

describe('a copy the core keeps', () => {
  it('is empty until something is kept', () => {
    expect(kept().read()).toEqual([]);
  });

  it('writes what is kept, and reads it back in a later session', () => {
    const file = path.join(dir, 'list.json');
    const first = kept(file);
    expect(first.keep(['a', 'b'])).toBe(true);

    expect(kept(file).read()).toEqual(['a', 'b']);
  });

  it('writes nothing when handed what it already keeps', () => {
    const file = path.join(dir, 'list.json');
    const copy = kept(file);
    copy.keep(['a']);
    const written = fs.statSync(file).mtimeMs;
    fs.utimesSync(file, new Date(0), new Date(0));

    expect(copy.keep(['a'])).toBe(false);
    expect(fs.statSync(file).mtimeMs).toBe(0);
    expect(written).toBeGreaterThan(0);
  });

  it('checks what it reads, as anything from disk is', () => {
    const file = path.join(dir, 'list.json');
    fs.writeFileSync(file, JSON.stringify(['ok', 3, null]));
    expect(kept(file).read()).toEqual(['ok']);

    fs.writeFileSync(file, '{not json');
    expect(kept(file).read()).toEqual([]);
  });

  it('tells its listeners what changed, and only when it did', () => {
    const copy = kept();
    const heard = jest.fn();
    const stop = copy.onChange(heard);
    copy.keep(['a']);
    copy.keep(['a']);
    stop();
    copy.keep(['b']);

    expect(heard.mock.calls).toEqual([[['a']]]);
  });

  it('keeps the value for the session when the file cannot be written, and says so once', () => {
    // A folder where the file should be: every write fails.
    const file = path.join(dir, 'taken');
    fs.mkdirSync(file);
    const copy = kept(file);

    expect(copy.keep(['a'])).toBe(true);
    expect(copy.keep(['b'])).toBe(true);
    expect(copy.read()).toEqual(['b']);
    expect(log.warn).toHaveBeenCalledTimes(1);
  });
});
