/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * `pnpm dev` compiled the FluidEQ Engine and Windows went on running the copy
 * installed hours earlier, because nothing compared the two. These pin the
 * comparison `sync-dev-engine` acts on: which build folder and install folder
 * pairs call for a reinstall, and which must never raise a UAC prompt.
 */

import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';
import {
  helperError,
  planEngineSync,
} from '../../../../.erb/scripts/engineSync';

const ENGINE = 'FluidEQ-Engine.dll';
const RUNTIME = 'msvcp140.dll';

describe('planEngineSync', () => {
  let root = '';
  let build = '';
  let installed = '';

  const put = (dir: string, name: string, bytes: string) =>
    writeFileSync(path.join(dir, name), bytes);

  beforeEach(() => {
    root = mkdtempSync(path.join(os.tmpdir(), 'fluideq-engine-sync-'));
    build = mkdtempSync(path.join(root, 'build-'));
    installed = mkdtempSync(path.join(root, 'installed-'));
    put(build, ENGINE, 'engine v2');
    put(build, RUNTIME, 'runtime');
    put(build, 'FluidEQ-Engine-Setup.exe', 'helper');
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  it('leaves a machine without the engine alone, however different the files', () => {
    put(installed, RUNTIME, 'some other runtime');
    expect(planEngineSync(build, installed)).toEqual({ kind: 'not-installed' });
  });

  it('does nothing when every installed DLL matches the build', () => {
    put(installed, ENGINE, 'engine v2');
    put(installed, RUNTIME, 'runtime');
    expect(planEngineSync(build, installed)).toEqual({ kind: 'current' });
  });

  it('reinstalls when the engine itself changed', () => {
    put(installed, ENGINE, 'engine v1');
    put(installed, RUNTIME, 'runtime');
    expect(planEngineSync(build, installed)).toEqual({
      kind: 'stale',
      files: [ENGINE],
    });
  });

  it('reinstalls when a runtime DLL the engine needs is missing', () => {
    put(installed, ENGINE, 'engine v2');
    expect(planEngineSync(build, installed)).toEqual({
      kind: 'stale',
      files: [RUNTIME],
    });
  });

  it('never counts the helper or other programs, which install does not copy', () => {
    put(installed, ENGINE, 'engine v2');
    put(installed, RUNTIME, 'runtime');
    put(build, 'FluidEQ-DSP.exe', 'host');
    expect(planEngineSync(build, installed)).toEqual({ kind: 'current' });
  });
});

describe('helperError', () => {
  it("reads the reason out of the helper's result document", () => {
    expect(
      helperError('{"command":"install","ok":false,"error":"access denied"}'),
    ).toBe('access denied');
  });

  it('has nothing to say for a success, an empty error or unreadable output', () => {
    expect(helperError('{"ok":true,"error":""}')).toBeUndefined();
    expect(helperError('')).toBeUndefined();
    expect(helperError('not json')).toBeUndefined();
  });
});
