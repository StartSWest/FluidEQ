/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * @jest-environment node
 */

/**
 * The picture FluidEQ writes beside a project for the member's AI to look at.
 *
 * This channel writes a file on somebody's disk from the window, and in this
 * app the window runs other people's shaders — so what is held here is mostly
 * what it REFUSES. A caller may not choose the folder, may not choose the
 * name, may not write something that is not a picture, and may not keep the
 * disk busy.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import { ipcMain } from 'electron';
import { PREVIEW_FILE } from '../../../common/memberScenes';
import {
  MAX_PREVIEW_BYTES,
  registerStudioPreviewIpc,
} from '../../../main/ipc/studioPreview';

jest.mock('electron', () => ({
  ipcMain: { handle: jest.fn(), removeHandler: jest.fn() },
}));

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const png = (extra = 16) => Uint8Array.from([...PNG, ...Array(extra).fill(1)]);

let folder: string;
let dispose: () => void;
let write: (id: unknown, bytes: unknown) => boolean;

const register = (folderFor: (id: string) => string | undefined) => {
  dispose = registerStudioPreviewIpc({ folderFor });
  // The newest registration: a test that registers again would otherwise keep
  // calling the handler it just disposed of.
  const { calls } = jest.mocked(ipcMain.handle).mock;
  const [channel, handler] = calls[calls.length - 1];
  expect(channel).toBe('studio-write-preview');
  write = (id, bytes) => handler({} as never, id, bytes) as unknown as boolean;
};

beforeEach(() => {
  jest.clearAllMocks();
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-preview-'));
  register(() => folder);
});

afterEach(() => {
  dispose?.();
  fs.rmSync(folder, { recursive: true, force: true });
});

const written = () => path.join(folder, PREVIEW_FILE);

// The positive control: every refusal below is meaningless without it.
it('writes the picture into the project folder, under its one name', () => {
  expect(write('project', png())).toBe(true);
  expect(fs.existsSync(written())).toBe(true);
  expect(Array.from(fs.readFileSync(written()).subarray(0, 8))).toEqual(PNG);
  // And nothing of the temporary file it was written through is left.
  expect(fs.readdirSync(folder)).toEqual([PREVIEW_FILE]);
});

it('writes nothing for a project the member may not write to', () => {
  dispose();
  register(() => undefined);
  expect(write('someone-elses', png())).toBe(false);
  expect(fs.readdirSync(folder)).toEqual([]);
});

it.each([
  [
    'bytes that are not a picture',
    Uint8Array.from([1, 2, 3, 4, 5, 6, 7, 8, 9]),
  ],
  ['a PNG signature with nothing after it', Uint8Array.from(PNG)],
  ['nothing at all', new Uint8Array(0)],
  ['something that is not bytes', 'preview.png'],
  ['more than the cap', undefined],
])('refuses %s', (_name, bytes) => {
  const sent =
    bytes ?? Uint8Array.from([...PNG, ...new Array(MAX_PREVIEW_BYTES).fill(0)]);
  expect(write('project', sent)).toBe(false);
  expect(fs.readdirSync(folder)).toEqual([]);
});

it('refuses an id that is not one', () => {
  expect(write(42, png())).toBe(false);
  expect(write(undefined, png())).toBe(false);
  expect(fs.readdirSync(folder)).toEqual([]);
});

// The ordinary second build: the picture is replaced, not appended to or
// refused. Also the positive control for the two refusals below, which would
// both pass if nothing were ever written at all.
it('replaces a picture it wrote before', () => {
  expect(write('project', png(16))).toBe(true);
  expect(write('project', png(64))).toBe(true);
  expect(fs.readFileSync(written()).byteLength).toBe(PNG.length + 64);
});

/**
 * Anything at the picture's name that is not a plain file is left alone: a
 * folder stands in for the case that matters and cannot be set up
 * everywhere — a `preview.png` somebody made a link to a file elsewhere.
 * Both are refused by the same `lstat().isFile()`, so this holds the rule
 * that protects both on every platform the suite runs on.
 */
it('writes nothing where something that is not a plain file sits', () => {
  fs.mkdirSync(written());
  expect(write('project', png())).toBe(false);
  expect(fs.lstatSync(written()).isDirectory()).toBe(true);
  expect(fs.readdirSync(written())).toEqual([]);
});

/**
 * The same rule on the real thing, where the platform allows one to be made.
 * Windows refuses without developer mode, so this asserts nothing there —
 * which is why the folder above carries the rule and this only confirms it.
 */
it('leaves a link and what it points at alone', () => {
  const outside = path.join(folder, 'secret.txt');
  fs.writeFileSync(outside, 'not the picture');
  try {
    fs.symlinkSync(outside, written());
  } catch {
    return;
  }
  expect(write('project', png())).toBe(false);
  expect(fs.readFileSync(outside, 'utf8')).toBe('not the picture');
  expect(fs.lstatSync(written()).isSymbolicLink()).toBe(true);
});
