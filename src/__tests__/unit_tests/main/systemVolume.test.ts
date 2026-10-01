/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The volume slider's helper, FluidEQ-Volume.exe, as main runs it.
 *
 * Asked for when the slider appears and kept while it shows, so a helper that
 * ended by itself took the slider with it for as long as the window stayed
 * up: nothing started another. It is put back now, under the same rule as the
 * media helper (`helperReplacement.ts`).
 */

import { EventEmitter } from 'events';
import { spawn } from 'child_process';
import log from 'electron-log';
import { createSystemVolumeWatch } from '../../../main/systemVolume';

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('electron-log', () => ({ info: jest.fn(), warn: jest.fn() }));
jest.mock('../../../main/ipc/windowMessages', () => jest.fn());

const HELPER = 'C:\\FluidEQ\\resources\\native\\FluidEQ-Volume.exe';
const found = () => HELPER;

/** A helper child: lines to push out of it, an input that records commands. */
const fakeChild = () => {
  const stdout = Object.assign(new EventEmitter(), { setEncoding: jest.fn() });
  const stdin = Object.assign(new EventEmitter(), {
    end: jest.fn(),
    write: jest.fn(),
    destroyed: false,
  });
  const child = Object.assign(new EventEmitter(), { stdin, stdout });
  (spawn as jest.Mock).mockReturnValue(child);
  return {
    child,
    stdin,
    say: (line: string) => stdout.emit('data', `${line}\n`),
  };
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('a volume helper that ends by itself', () => {
  it('is put back, the slider keeping its level until the new one reads it', () => {
    const first = fakeChild();
    const onChange = jest.fn();
    const watch = createSystemVolumeWatch(onChange, found);
    watch.start();
    first.say('volume\t0.5\t0');
    onChange.mockClear();

    const second = fakeChild();
    first.child.emit('exit', 0, null);

    expect(spawn).toHaveBeenCalledTimes(2);
    // Told "no output" in between, the slider would vanish and come back.
    expect(onChange).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/volume helper.*exit code 0.*starting another/),
    );
    second.say('volume\t0.6\t1');
    expect(onChange).toHaveBeenCalledWith({ level: 0.6, isMuted: true });
    // And the slider's next move reaches the helper that is running.
    watch.set(0.3);
    expect(second.stdin.write).toHaveBeenCalledWith('set 0.3000\n');
    expect(first.stdin.write).not.toHaveBeenCalled();
    watch.stop();
  });

  it('is not started again when it ended before printing anything', () => {
    const { child } = fakeChild();
    const onChange = jest.fn();
    const watch = createSystemVolumeWatch(onChange, found);
    watch.start();

    fakeChild();
    child.emit('exit', 1, null);

    expect(spawn).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
    expect(log.warn).toHaveBeenCalledWith(
      expect.stringMatching(/exit code 1.*not starting another/),
    );
    watch.stop();
  });

  it('is not started again once the window stopped it', () => {
    const first = fakeChild();
    const watch = createSystemVolumeWatch(jest.fn(), found);
    watch.start();
    first.say('volume\t0.5\t0');
    watch.stop();

    fakeChild();
    first.child.emit('exit', 0, null);

    expect(first.stdin.end).toHaveBeenCalledTimes(1);
    expect(spawn).toHaveBeenCalledTimes(1);
    expect(log.warn).not.toHaveBeenCalled();
  });

  it('gives up after three in a row that each ended before following a change', () => {
    let current = fakeChild();
    const onChange = jest.fn();
    const watch = createSystemVolumeWatch(onChange, found);
    watch.start();
    for (let ended = 0; ended < 3; ended += 1) {
      current.say('volume\t0.5\t0');
      const next = fakeChild();
      current.child.emit('exit', 0, null);
      current = next;
    }
    expect(spawn).toHaveBeenCalledTimes(4);
    onChange.mockClear();

    current.say('volume\t0.5\t0');
    fakeChild();
    current.child.emit('exit', 0, null);

    expect(spawn).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenCalledWith(null);
    watch.stop();
  });

  it('does not take the same reading twice for a change', () => {
    let current = fakeChild();
    const onChange = jest.fn();
    const watch = createSystemVolumeWatch(onChange, found);
    watch.start();
    for (let ended = 0; ended < 4; ended += 1) {
      // A helper saying where things stand again has followed nothing.
      current.say('volume\t0.5\t0');
      current.say('volume\t0.5\t0');
      const next = fakeChild();
      current.child.emit('exit', 0, null);
      current = next;
    }

    expect(spawn).toHaveBeenCalledTimes(4);
    expect(onChange).toHaveBeenLastCalledWith(null);
    watch.stop();
  });

  it('counts again from a helper that followed a change', () => {
    let current = fakeChild();
    const watch = createSystemVolumeWatch(jest.fn(), found);
    watch.start();
    for (let ended = 0; ended < 3; ended += 1) {
      current.say('volume\t0.5\t0');
      const next = fakeChild();
      current.child.emit('exit', 0, null);
      current = next;
    }

    // The level moved: it followed Windows through a change.
    current.say('volume\t0.5\t0');
    current.say('volume\t0.7\t0');
    fakeChild();
    current.child.emit('exit', 0, null);

    expect(spawn).toHaveBeenCalledTimes(5);
    watch.stop();
  });

  it('counts again when the window asks for it afresh', () => {
    let current = fakeChild();
    const watch = createSystemVolumeWatch(jest.fn(), found);
    watch.start();
    for (let ended = 0; ended < 3; ended += 1) {
      current.say('volume\t0.5\t0');
      const next = fakeChild();
      current.child.emit('exit', 0, null);
      current = next;
    }

    // The slider shown again: a reload, or the window opening the bar.
    watch.start();
    current.say('volume\t0.5\t0');
    fakeChild();
    current.child.emit('exit', 0, null);

    expect(spawn).toHaveBeenCalledTimes(5);
    watch.stop();
  });
});
