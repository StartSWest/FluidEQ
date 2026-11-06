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
import writeFileAtomically from '../../../main/atomicWrite';

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
