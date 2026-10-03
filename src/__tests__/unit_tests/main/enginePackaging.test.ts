/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import { createRequire } from 'module';
import path from 'path';

interface ResourceMatcher {
  from: string;
  to: string;
  createFilter: () => (file: string, stat: fs.Stats) => boolean;
}

const root = path.join(__dirname, '../../../..');
const native = path.join(root, 'native/.build/bin');
const resources = path.join(root, 'release/build/resources');
const { build } = JSON.parse(
  fs.readFileSync(path.join(root, 'package.json'), 'utf8'),
);
// Resolve the packager's own matcher, so the test exercises the same glob and
// destination rules as a release without copying binaries or building NSIS.
const builderRequire = createRequire(require.resolve('electron-builder'));
const { getFileMatchers } = builderRequire(
  'app-builder-lib/out/fileMatcher',
) as {
  getFileMatchers: (
    config: unknown,
    name: string,
    destination: string,
    options: {
      defaultSrc: string;
      globalOutDir: string;
      customBuildOptions: Record<string, never>;
      macroExpander: (value: string) => string;
    },
  ) => ResourceMatcher[];
};
const matchers = getFileMatchers(build, 'extraResources', resources, {
  defaultSrc: root,
  globalOutDir: path.join(root, 'release/build'),
  customBuildOptions: {},
  macroExpander: (value) => value,
});
const installer = fs.readFileSync(
  path.join(root, 'native/system-apo/setup/shipped_dlls.cmake'),
  'utf8',
);
const dlls = /foreach\(\s*name\s+([^)]+)\)/.exec(installer)?.[1].split(/\s+/);

describe('packaged FluidEQ Engine dependencies', () => {
  it('ships every runtime accepted by setup beside the engine', () => {
    expect(dlls).toContain('FluidEQ-Engine.dll');
    expect(dlls).toContain('onnxruntime.dll');
    const matcher = matchers.find((entry) => entry.from === native);
    expect(matcher).toBeDefined();
    expect(matcher?.to).toBe(path.join(resources, 'native'));
    const accepts = matcher?.createFilter();
    const stat = fs.statSync(__filename);
    const omitted = dlls?.filter(
      (name) => !accepts?.(path.join(native, name), stat),
    );
    expect(omitted).toEqual([]);
  });

  it('keeps native test executables out of the installed resources', () => {
    const accepts = matchers
      .find((entry) => entry.from === native)
      ?.createFilter();
    const stat = fs.statSync(__filename);
    expect(accepts?.(path.join(native, 'FluidEQ-Engine-Setup.exe'), stat)).toBe(
      true,
    );
    expect(
      accepts?.(path.join(native, 'engine_split_process_test.exe'), stat),
    ).toBe(false);
  });
});
