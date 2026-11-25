/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import crypto from 'crypto';
import writeFileAtomically, {
  writeFileOverReaders,
} from '../../../main/atomicWrite';

describe('atomic file replacement', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-atomic-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (
      path.dirname(directory) !== os.tmpdir() ||
      !path.basename(directory).startsWith('fluideq-atomic-')
    ) {
      throw new Error('Unexpected fixture directory');
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });

  it('creates nested files and replaces complete binary contents', () => {
    const target = path.join(directory, 'nested', 'file');
    writeFileAtomically(target, 'before', 0o600);
    const bytes = Uint8Array.from([0, 255, 1, 128]);
    writeFileAtomically(target, bytes, 0o600);
    expect(fs.readFileSync(target)).toEqual(Buffer.from(bytes));
    expect(fs.readdirSync(path.dirname(target))).toEqual(['file']);
  });

  it('creates and replaces files with a long valid basename', () => {
    const target = path.join(directory, `${'scene'.repeat(44)}.frag`);
    fs.writeFileSync(target, 'original scene');

    writeFileAtomically(target, 'restored scene');
    expect(fs.readFileSync(target, 'utf8')).toBe('restored scene');
    const created = path.join(directory, `${'other'.repeat(44)}.frag`);
    writeFileAtomically(created, 'new scene');
    expect(fs.readFileSync(created, 'utf8')).toBe('new scene');
  });

  it('does not write through the predictable temporary hard link', () => {
    const target = path.join(directory, 'scene.frag');
    const outside = path.join(directory, 'outside');
    fs.writeFileSync(outside, 'private settings');
    fs.linkSync(outside, `${target}.tmp`);

    writeFileAtomically(target, 'restored scene');

    expect(fs.readFileSync(target, 'utf8')).toBe('restored scene');
    expect(fs.readFileSync(outside, 'utf8')).toBe('private settings');
    expect(fs.readFileSync(`${target}.tmp`, 'utf8')).toBe('private settings');
  });

  it('fails closed on a collision without opening or removing the planted link', () => {
    const target = path.join(directory, 'scene.frag');
    const outside = path.join(directory, 'outside');
    const id = '12345678-1234-4234-8234-123456789abc';
    jest.spyOn(crypto, 'randomUUID').mockReturnValue(id);
    const temporary = path.join(directory, `.fluideq-${process.pid}-${id}.tmp`);
    fs.writeFileSync(target, 'current scene');
    fs.writeFileSync(outside, 'private settings');
    fs.linkSync(outside, temporary);

    expect(() => writeFileAtomically(target, 'restored scene')).toThrow();
    expect(fs.readFileSync(target, 'utf8')).toBe('current scene');
    expect(fs.readFileSync(outside, 'utf8')).toBe('private settings');
    expect(fs.statSync(temporary).ino).toBe(fs.statSync(outside).ino);
  });

  it('replaces a linked destination instead of modifying its other names', () => {
    const target = path.join(directory, 'scene.frag');
    const outside = path.join(directory, 'outside');
    fs.writeFileSync(outside, 'private settings');
    fs.linkSync(outside, target);

    writeFileAtomically(target, 'restored scene');

    expect(fs.readFileSync(target, 'utf8')).toBe('restored scene');
    expect(fs.readFileSync(outside, 'utf8')).toBe('private settings');
  });

  it('cleans only its own temporary when replacement fails', () => {
    const target = path.join(directory, 'scene.frag');
    fs.mkdirSync(target);
    fs.writeFileSync(path.join(target, 'keep'), 'original');

    expect(() => writeFileAtomically(target, 'restored scene')).toThrow();

    expect(fs.readdirSync(directory)).toEqual(['scene.frag']);
    expect(fs.readFileSync(path.join(target, 'keep'), 'utf8')).toBe('original');
  });
});

/**
 * A file other programs hold while it is written: OneDrive's sync and the
 * virus scanner open every file in a synced folder, and Windows refuses a
 * rename while either file is open - Alpine's publish line was lost that
 * way (2026-11-25).
 */
describe('replacing a file other programs are reading', () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-readers-'));
  });

  afterEach(() => {
    jest.restoreAllMocks();
    if (
      path.dirname(directory) !== os.tmpdir() ||
      !path.basename(directory).startsWith('fluideq-readers-')
    ) {
      throw new Error('Unexpected fixture directory');
    }
    fs.rmSync(directory, { recursive: true, force: true });
  });

  const refuseRenames = (code: string) =>
    jest.spyOn(fs, 'renameSync').mockImplementation(() => {
      throw Object.assign(new Error(`${code}: refused`), { code });
    });

  it('writes the file in place when the rename is refused, leaving nothing beside it', () => {
    const target = path.join(directory, 'studio-notes.json');
    fs.writeFileSync(
      target,
      '{"description":"a much longer line than the next"}',
    );
    refuseRenames('EPERM');

    writeFileOverReaders(target, '{"whatsNew":"new"}');

    expect(fs.readFileSync(target, 'utf8')).toBe('{"whatsNew":"new"}');
    expect(fs.readdirSync(directory)).toEqual(['studio-notes.json']);
  });

  it('creates the file when a scanner holds the temporary and none is there yet', () => {
    const target = path.join(directory, 'studio-notes.json');
    refuseRenames('EBUSY');

    writeFileOverReaders(target, '{"whatsNew":"first"}');

    expect(fs.readFileSync(target, 'utf8')).toBe('{"whatsNew":"first"}');
    expect(fs.readdirSync(directory)).toEqual(['studio-notes.json']);
  });

  it('replaces a file another handle holds open, on this platform for real', () => {
    const target = path.join(directory, 'studio-notes.json');
    fs.writeFileSync(target, 'before');
    // On Windows this handle alone makes the rename fail with EPERM.
    const reader = fs.openSync(target, 'r');
    try {
      writeFileOverReaders(target, 'after');
    } finally {
      fs.closeSync(reader);
    }
    expect(fs.readFileSync(target, 'utf8')).toBe('after');
    expect(fs.readdirSync(directory)).toEqual(['studio-notes.json']);
  });

  it('never writes through a hard link in place of the rename it was refused', () => {
    const target = path.join(directory, 'studio-notes.json');
    const outside = path.join(directory, 'outside');
    fs.writeFileSync(outside, 'private settings');
    fs.linkSync(outside, target);
    refuseRenames('EPERM');

    expect(() => writeFileOverReaders(target, 'notes')).toThrow(/EPERM/);

    expect(fs.readFileSync(outside, 'utf8')).toBe('private settings');
    expect(fs.readdirSync(directory).sort()).toEqual([
      'outside',
      'studio-notes.json',
    ]);
  });

  it('throws any other failure of the rename, writing nothing', () => {
    const target = path.join(directory, 'studio-notes.json');
    fs.writeFileSync(target, 'before');
    refuseRenames('ENOSPC');

    expect(() => writeFileOverReaders(target, 'after')).toThrow(/ENOSPC/);

    expect(fs.readFileSync(target, 'utf8')).toBe('before');
    expect(fs.readdirSync(directory)).toEqual(['studio-notes.json']);
  });
});
