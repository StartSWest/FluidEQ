/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * An app update replaced the app and never the engine, so every engine fix
 * stopped at the machines that installed it fresh; and `pnpm dev` compiled
 * the engine while Windows went on running the copy installed hours earlier.
 * Both came from nothing comparing the two. These pin the comparison the app
 * and `sync-dev-engine` act on — which pairs of folders call for the Windows
 * prompt, and which must never raise one — against scratch folders, because
 * the real ones are where a test run has no business looking.
 */

import {
  mkdtempSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'fs';
import os from 'os';
import path from 'path';
import type { IFluidEngineStatus } from '../../../common/audioEngine';

// `engineStatus` reaches the registry module, and through it Electron, whose
// package fetches its whole binary when it is imported outside Electron with
// none installed. Nothing here asks the registry anything.
jest.mock('main/registry', () => ({
  isEqualizerAPOInstalled: jest.fn(),
  noteFluidEngineRegistered: jest.fn(),
}));

// Imports come after jest.mock on purpose: the module under test reads the
// mocked dependency at import time.
// eslint-disable-next-line import/first
import { planEngineUpdate } from '../../../main/engineUpdate';
// eslint-disable-next-line import/first
import { readFluidEngineUpdateReady } from '../../../main/engineStatus';

const ENGINE = 'FluidEQ-Engine.dll';
const RUNTIME = 'msvcp140.dll';

let root = '';
let bundle = '';
let installed = '';

const put = (dir: string, name: string, bytes: string) =>
  writeFileSync(path.join(dir, name), bytes);

beforeEach(() => {
  root = mkdtempSync(path.join(os.tmpdir(), 'fluideq-engine-update-'));
  bundle = mkdtempSync(path.join(root, 'bundle-'));
  installed = mkdtempSync(path.join(root, 'installed-'));
  put(bundle, ENGINE, 'engine v2');
  put(bundle, RUNTIME, 'runtime');
  put(bundle, 'FluidEQ-Engine-Setup.exe', 'helper');
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('planEngineUpdate', () => {
  it('leaves a machine without the engine alone, however different the files', async () => {
    put(installed, RUNTIME, 'some other runtime');
    await expect(planEngineUpdate(bundle, installed)).resolves.toEqual({
      kind: 'not-installed',
    });
  });

  it('offers nothing from an app that carries no engine', async () => {
    const empty = mkdtempSync(path.join(root, 'no-native-build-'));
    put(installed, ENGINE, 'engine v1');
    await expect(planEngineUpdate(empty, installed)).resolves.toEqual({
      kind: 'no-bundle',
    });
  });

  it('does nothing when every installed DLL matches', async () => {
    put(installed, ENGINE, 'engine v2');
    put(installed, RUNTIME, 'runtime');
    await expect(planEngineUpdate(bundle, installed)).resolves.toEqual({
      kind: 'current',
    });
  });

  it('updates when the engine itself changed', async () => {
    put(installed, ENGINE, 'engine v1');
    put(installed, RUNTIME, 'runtime');
    await expect(planEngineUpdate(bundle, installed)).resolves.toEqual({
      kind: 'stale',
      files: [ENGINE],
    });
  });

  // The version resource cannot see this: it is the same on both builds.
  it('updates when the bytes differ and nothing else does', async () => {
    put(installed, ENGINE, 'engine v2 but rebuilt');
    put(installed, RUNTIME, 'runtime');
    await expect(planEngineUpdate(bundle, installed)).resolves.toEqual({
      kind: 'stale',
      files: [ENGINE],
    });
  });

  it('updates when a runtime DLL the engine needs is missing', async () => {
    put(installed, ENGINE, 'engine v2');
    await expect(planEngineUpdate(bundle, installed)).resolves.toEqual({
      kind: 'stale',
      files: [RUNTIME],
    });
  });

  it('names every file that differs, in order', async () => {
    put(installed, ENGINE, 'engine v1');
    put(installed, RUNTIME, 'old runtime');
    put(bundle, 'vcruntime140.dll', 'vc');
    await expect(planEngineUpdate(bundle, installed)).resolves.toEqual({
      kind: 'stale',
      files: [ENGINE, RUNTIME, 'vcruntime140.dll'],
    });
  });

  it('never counts the helper, other programs or folders, which install does not copy', async () => {
    put(installed, ENGINE, 'engine v2');
    put(installed, RUNTIME, 'runtime');
    put(bundle, 'FluidEQ-DSP.exe', 'host');
    mkdirSync(path.join(bundle, 'symbols.dll'));
    await expect(planEngineUpdate(bundle, installed)).resolves.toEqual({
      kind: 'current',
    });
  });

  // What was installed and is no longer carried is not this app's to judge:
  // `install` copies over, it does not delete.
  it('ignores installed files this app does not carry', async () => {
    put(installed, ENGINE, 'engine v2');
    put(installed, RUNTIME, 'runtime');
    put(installed, 'retired.dll', 'from an older build');
    await expect(planEngineUpdate(bundle, installed)).resolves.toEqual({
      kind: 'current',
    });
  });
});

describe('readFluidEngineUpdateReady', () => {
  const status = (
    overrides: Partial<IFluidEngineStatus> = {},
  ): IFluidEngineStatus => ({
    installed: true,
    dllPath: path.join(installed, ENGINE),
    endpoints: [],
    ...overrides,
  });

  // Positive control for every "no" below: the same folders, one byte apart,
  // are a yes.
  it('offers the update when the installed engine is not this build', async () => {
    put(installed, ENGINE, 'engine v1');
    put(installed, RUNTIME, 'runtime');
    await expect(readFluidEngineUpdateReady(status(), bundle)).resolves.toBe(
      true,
    );
  });

  it('offers nothing once the installed engine is this build', async () => {
    put(installed, ENGINE, 'engine v2');
    put(installed, RUNTIME, 'runtime');
    await expect(readFluidEngineUpdateReady(status(), bundle)).resolves.toBe(
      false,
    );
  });

  it('offers nothing when the helper says no engine is installed', async () => {
    put(installed, ENGINE, 'engine v1');
    await expect(
      readFluidEngineUpdateReady(status({ installed: false }), bundle),
    ).resolves.toBe(false);
  });

  it('offers nothing when the helper did not say where the engine is', async () => {
    put(installed, ENGINE, 'engine v1');
    await expect(
      readFluidEngineUpdateReady(status({ dllPath: undefined }), bundle),
    ).resolves.toBe(false);
  });

  it('compares against the folder Windows loads the engine from', async () => {
    const elsewhere = mkdtempSync(path.join(root, 'registered-'));
    put(elsewhere, ENGINE, 'engine v2');
    put(elsewhere, RUNTIME, 'runtime');
    put(installed, ENGINE, 'engine v1');
    await expect(
      readFluidEngineUpdateReady(
        status({ dllPath: path.join(elsewhere, ENGINE) }),
        bundle,
      ),
    ).resolves.toBe(false);
  });

  // A prompt for Windows permission has to be sure there is something to
  // install; a file that cannot be read is not that. The engine differs here
  // too, so only the unreadable file can be what says no.
  it('offers nothing when a file cannot be read', async () => {
    put(installed, ENGINE, 'engine v1');
    // Named like a DLL, and a folder: it exists, and it cannot be hashed.
    mkdirSync(path.join(installed, RUNTIME));
    await expect(readFluidEngineUpdateReady(status(), bundle)).resolves.toBe(
      false,
    );
  });
});

/**
 * The comparison is by bytes, so it is only as good as the build that makes
 * them: two builds of the same sources have to come out identical, or every
 * release — each built afresh — offers the update for an engine that did not
 * change. The MSVC linker stamped the time of the link into the file until
 * `/Brepro` (native/CMakeLists.txt); measured, three builds from two folders
 * and two copies of the tree now hash the same, and two without it did not.
 */
describe('the engine this tree builds', () => {
  const NATIVE = path.join(__dirname, '../../../../native');

  const sources = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        return sources(full);
      }
      return /\.(c|cc|cpp|h|hpp|rc|txt)$/i.test(entry.name) ? [full] : [];
    });

  /** Whatever in `dirs` would make one build of it differ from the next. */
  const varyingStamps = (dirs: string[]): string[] =>
    dirs
      .flatMap((dir) => sources(path.join(NATIVE, dir)))
      .filter((file) =>
        /__DATE__|__TIME__|__TIMESTAMP__|FEQ_BUILD_REVISION/.test(
          readFileSync(file, 'utf8'),
        ),
      )
      .map((file) => path.relative(NATIVE, file));

  it('is linked and compiled to be the same file every time', () => {
    const cmake = readFileSync(path.join(NATIVE, 'CMakeLists.txt'), 'utf8');
    expect(cmake).toMatch(/add_link_options\(\/Brepro\)/);
    expect(cmake).toMatch(
      /add_compile_options\(\$<\$<COMPILE_LANGUAGE:CXX>:\/Brepro>\)/,
    );
  });

  // Everything the engine DLL is built from: its own sources and the DSP core
  // it links. The tests beside them are not in it, and neither is the host.
  it('carries no date, time or revision that would differ from build to build', () => {
    expect(
      varyingStamps([
        'system-apo/src',
        'system-apo/include',
        'dsp-core/src',
        'dsp-core/include',
      ]),
    ).toEqual([]);
  });

  // Positive control for the one above: the host does carry the revision, and
  // the same scan finds it there.
  it('would find a revision stamp where there is one', () => {
    expect(varyingStamps(['dsp-host'])).not.toEqual([]);
  });
});
