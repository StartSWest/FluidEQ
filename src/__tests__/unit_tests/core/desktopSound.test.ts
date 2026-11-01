/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * When the core hears the desktop backgrounds' music: only while one follows
 * it, answering them until it cannot, and then giving the job back to the
 * window until the output changes — the one thing that can make it hear
 * where it could not. Nothing here waits on a timer.
 */
import type {
  ISystemSound,
  ISystemSoundListener,
} from 'core/systemSound/systemSound';
import { createDesktopSound } from 'core/liveFrames/desktopSound';
import { analyserSignal, signalBlocks } from '../../utils/analyserSignal';

const fakeSystemSound = () => {
  const runs: { listener: ISystemSoundListener; stop: jest.Mock }[] = [];
  let refuse = false;
  const sound: ISystemSound = {
    listen: (listener) => {
      if (refuse) {
        listener.lost();
        return () => undefined;
      }
      const stop = jest.fn();
      runs.push({ listener, stop });
      return stop;
    },
  };
  return {
    sound,
    runs,
    refuseFromNowOn: (next: boolean) => {
      refuse = next;
    },
  };
};

const hear = (listener: ISystemSoundListener) => {
  listener.ready();
  signalBlocks(analyserSignal(), 0, 4096).forEach((block) =>
    listener.audio(block),
  );
};

describe('the desktop backgrounds’ music, heard by the core', () => {
  it('listens only while a background follows the music', () => {
    const { sound, runs } = fakeSystemSound();
    const desktop = createDesktopSound(sound);
    expect(runs).toHaveLength(0);

    desktop.want(true);
    desktop.want(true);
    expect(runs).toHaveLength(1);

    desktop.want(false);
    expect(runs[0].stop).toHaveBeenCalledTimes(1);
  });

  it('answers with what it hears, and with silence before it has heard', () => {
    const { sound, runs } = fakeSystemSound();
    const desktop = createDesktopSound(sound);
    desktop.want(true);
    expect(desktop.read().points).toEqual([]);

    hear(runs[0].listener);
    expect(desktop.read().points.length).toBeGreaterThan(0);
  });

  it('gives the job to the window when it loses the output, until the output changes', () => {
    const { sound, runs } = fakeSystemSound();
    const desktop = createDesktopSound(sound);
    const told = jest.fn();
    desktop.onServesChanged(told);
    desktop.want(true);
    hear(runs[0].listener);

    runs[0].listener.lost();
    expect(desktop.serves()).toBe(false);
    expect(told).toHaveBeenLastCalledWith(false);
    // Wanting it again is not a reason to think it can hear now.
    desktop.want(false);
    desktop.want(true);
    expect(runs).toHaveLength(1);

    desktop.outputChanged();
    expect(desktop.serves()).toBe(true);
    expect(told).toHaveBeenLastCalledWith(true);
    expect(runs).toHaveLength(2);
    // A new run is new music: nothing of the last one is drawn.
    expect(desktop.read().points).toEqual([]);
  });

  it('gives the job to the window at once where nothing can hear the output', () => {
    const { sound, refuseFromNowOn } = fakeSystemSound();
    refuseFromNowOn(true);
    const desktop = createDesktopSound(sound);
    expect(desktop.serves()).toBe(true);

    desktop.want(true);
    expect(desktop.serves()).toBe(false);
  });

  it('changes nothing on an output change while it hears', () => {
    const { sound, runs } = fakeSystemSound();
    const desktop = createDesktopSound(sound);
    const told = jest.fn();
    desktop.onServesChanged(told);
    desktop.want(true);

    desktop.outputChanged();
    expect(runs).toHaveLength(1);
    expect(told).not.toHaveBeenCalled();
  });

  it('ignores a run it stopped', () => {
    const { sound, runs } = fakeSystemSound();
    const desktop = createDesktopSound(sound);
    desktop.want(true);
    desktop.want(false);

    runs[0].listener.lost();
    expect(desktop.serves()).toBe(true);
  });
});
