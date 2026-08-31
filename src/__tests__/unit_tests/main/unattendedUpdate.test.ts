/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  consumeUnattendedRestart,
  createUnattendedUpdate,
  rememberUnattendedRestart,
} from '../../../main/unattendedUpdate';

const makeHarness = (
  overrides: {
    isInstallerReady?: boolean;
    isPlayingAudio?: boolean;
    isWindowOnScreen?: boolean;
  } = {},
) => {
  const install = jest.fn();
  const rememberRestart = jest.fn();
  const unattended = createUnattendedUpdate({
    install,
    isInstallerReady: () => overrides.isInstallerReady ?? true,
    isPlayingAudio: () => overrides.isPlayingAudio ?? false,
    isWindowOnScreen: () => overrides.isWindowOnScreen ?? false,
    rememberRestart,
  });
  return { install, rememberRestart, unattended };
};

describe('createUnattendedUpdate', () => {
  it('installs when the app is out of the way, and marks the restart first', () => {
    const harness = makeHarness();

    expect(harness.unattended.applyIfUnattended('a test')).toBe(true);
    expect(harness.install).toHaveBeenCalledTimes(1);

    // The marker has to be on disk before the process is asked to end, or the
    // copy that comes back opens a window at somebody who put FluidEQ away.
    const markedAt = harness.rememberRestart.mock.invocationCallOrder[0];
    const installedAt = harness.install.mock.invocationCallOrder[0];
    expect(markedAt).toBeLessThan(installedAt);
  });

  it('does nothing without a verified installer', () => {
    const harness = makeHarness({ isInstallerReady: false });

    expect(harness.unattended.applyIfUnattended('a test')).toBe(false);
    expect(harness.install).not.toHaveBeenCalled();
    expect(harness.rememberRestart).not.toHaveBeenCalled();
  });

  it('leaves a window that is on screen alone', () => {
    const harness = makeHarness({ isWindowOnScreen: true });

    expect(harness.unattended.applyIfUnattended('a test')).toBe(false);
    expect(harness.install).not.toHaveBeenCalled();
  });

  it('does not cut off audio that is playing', () => {
    // The case the window check cannot cover: the DSP host plays perfectly
    // well with no window, so "hidden" is not "idle".
    const harness = makeHarness({ isPlayingAudio: true });

    expect(harness.unattended.applyIfUnattended('a test')).toBe(false);
    expect(harness.install).not.toHaveBeenCalled();
  });

  it('tries once and never again', () => {
    // A successful install ends the process, so a second call means the first
    // failed to start — and hiding a window again does not make a refused
    // installer launch. Retrying would raise a failure toast on every hide,
    // minimise and screen lock for the rest of the session.
    const harness = makeHarness();

    expect(harness.unattended.applyIfUnattended('first')).toBe(true);
    expect(harness.unattended.applyIfUnattended('second')).toBe(false);
    expect(harness.unattended.applyIfUnattended('third')).toBe(false);
    expect(harness.install).toHaveBeenCalledTimes(1);
    expect(harness.rememberRestart).toHaveBeenCalledTimes(1);
  });
});

describe('the unattended restart marker', () => {
  let markerPath: string;

  beforeEach(() => {
    markerPath = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-unattended-')),
      'unattended-update.json',
    );
  });

  it('reports a restart when the version actually moved', () => {
    rememberUnattendedRestart(markerPath, '1.5.0');

    expect(consumeUnattendedRestart(markerPath, '1.6.0')).toBe(true);
  });

  it('answers once, then clears itself', () => {
    rememberUnattendedRestart(markerPath, '1.5.0');

    expect(consumeUnattendedRestart(markerPath, '1.6.0')).toBe(true);
    // Second launch: an ordinary one, which must open a window.
    expect(consumeUnattendedRestart(markerPath, '1.6.0')).toBe(false);
    expect(fs.existsSync(markerPath)).toBe(false);
  });

  it('ignores a marker left behind by an install that never happened', () => {
    // THE FAILURE THIS TEST EXISTS FOR: without the version test, one
    // installer that refused to launch would leave FluidEQ starting with no
    // window forever, which from the outside is the app not starting.
    rememberUnattendedRestart(markerPath, '1.5.0');

    expect(consumeUnattendedRestart(markerPath, '1.5.0')).toBe(false);
  });

  it('treats a missing or damaged marker as an ordinary launch', () => {
    expect(consumeUnattendedRestart(markerPath, '1.6.0')).toBe(false);

    fs.writeFileSync(markerPath, 'not json at all', 'utf8');
    expect(consumeUnattendedRestart(markerPath, '1.6.0')).toBe(false);

    fs.writeFileSync(markerPath, JSON.stringify({ nope: 1 }), 'utf8');
    expect(consumeUnattendedRestart(markerPath, '1.6.0')).toBe(false);
  });
});
