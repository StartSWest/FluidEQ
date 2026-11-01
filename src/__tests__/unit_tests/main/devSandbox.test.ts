/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which runs are a development sandbox: only an unpackaged build given an
 * absolute folder. An installed FluidEQ started with the variable set is the
 * ordinary app, whatever the environment says, because a sandbox refuses
 * every engine command and an installed copy that did would never repair a
 * listener's engine.
 */
import path from 'path';
import {
  SANDBOX_CDP_PORT_VARIABLE,
  SANDBOX_DEFAULT_CDP_PORT,
  SANDBOX_DIR_VARIABLE,
  SANDBOX_ENGINE_VARIABLE,
  devSandbox,
  sandboxFor,
  sandboxProductName,
} from 'main/devSandbox';

const ROOT = path.resolve(path.sep, 'scratch', 'fluideq-sandbox');

describe('which run is a development sandbox', () => {
  it('lays every folder out under the one it was given', () => {
    expect(sandboxFor({ [SANDBOX_DIR_VARIABLE]: ROOT }, false)).toEqual({
      root: ROOT,
      userData: path.join(ROOT, 'userData'),
      engineConfigDir: path.join(ROOT, 'engine', 'config'),
      instanceLockDir: path.join(ROOT, 'lock'),
      cdpPort: SANDBOX_DEFAULT_CDP_PORT,
      drivesEngine: false,
    });
  });

  it('drives the real engine and takes the real lock only when told live', () => {
    const live = sandboxFor(
      { [SANDBOX_DIR_VARIABLE]: ROOT, [SANDBOX_ENGINE_VARIABLE]: 'live' },
      false,
    );
    expect(live).toEqual({
      root: ROOT,
      userData: path.join(ROOT, 'userData'),
      engineConfigDir: undefined,
      instanceLockDir: undefined,
      cdpPort: SANDBOX_DEFAULT_CDP_PORT,
      drivesEngine: true,
    });
    // Anything else is the sealed sandbox, whose folders are its own.
    expect(
      sandboxFor(
        { [SANDBOX_DIR_VARIABLE]: ROOT, [SANDBOX_ENGINE_VARIABLE]: 'LIVE' },
        false,
      )?.drivesEngine,
    ).toBe(false);
    // And never a packaged build, live or not.
    expect(
      sandboxFor(
        { [SANDBOX_DIR_VARIABLE]: ROOT, [SANDBOX_ENGINE_VARIABLE]: 'live' },
        true,
      ),
    ).toBeUndefined();
  });

  it('is never a packaged build', () => {
    expect(sandboxFor({ [SANDBOX_DIR_VARIABLE]: ROOT }, true)).toBeUndefined();
  });

  it('needs an absolute folder', () => {
    expect(sandboxFor({}, false)).toBeUndefined();
    expect(sandboxFor({ [SANDBOX_DIR_VARIABLE]: '' }, false)).toBeUndefined();
    expect(
      sandboxFor({ [SANDBOX_DIR_VARIABLE]: 'fluideq-sandbox' }, false),
    ).toBeUndefined();
  });

  it('takes a DevTools port of its own, never the development window’s', () => {
    const port = (value: string) =>
      sandboxFor(
        { [SANDBOX_DIR_VARIABLE]: ROOT, [SANDBOX_CDP_PORT_VARIABLE]: value },
        false,
      )?.cdpPort;

    expect(port('9250')).toBe(9250);
    expect(port('9222')).toBe(SANDBOX_DEFAULT_CDP_PORT);
    expect(port('80')).toBe(SANDBOX_DEFAULT_CDP_PORT);
    expect(port('70000')).toBe(SANDBOX_DEFAULT_CDP_PORT);
    expect(port('92.5')).toBe(SANDBOX_DEFAULT_CDP_PORT);
    expect(port('next')).toBe(SANDBOX_DEFAULT_CDP_PORT);
  });

  it('leaves an ordinary run’s name alone', () => {
    expect(devSandbox).toBeUndefined();
    expect(sandboxProductName('FluidEQ')).toBe('FluidEQ');
  });
});
