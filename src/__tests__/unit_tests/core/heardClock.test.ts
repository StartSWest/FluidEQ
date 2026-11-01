/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Time counted by the output's sound: a step per stretch heard, listening
 * only while wanted, and after the output could not be heard, nothing asked
 * again until the output changes.
 */
import createHeardClock from 'core/systemSound/heardClock';
import type {
  ISystemSound,
  ISystemSoundListener,
} from 'core/systemSound/systemSound';

const setUp = () => {
  const runs: { listener: ISystemSoundListener; stop: jest.Mock }[] = [];
  let canHear = true;
  const systemSound: ISystemSound = {
    listen: (listener) => {
      if (!canHear) {
        listener.lost();
        return () => undefined;
      }
      const stop = jest.fn();
      runs.push({ listener, stop });
      return stop;
    },
  };
  const onStep = jest.fn();
  const onLost = jest.fn();
  const clock = createHeardClock({
    systemSound,
    secondsPerStep: 0.25,
    onStep,
    onLost,
  });
  const hear = (seconds: number, sampleRate = 48000) =>
    runs[runs.length - 1].listener.audio({
      sampleRate,
      channels: 2,
      frames: Math.round(seconds * sampleRate),
      sequence: 0,
      pcm: new ArrayBuffer(0),
    });
  return {
    clock,
    runs,
    onStep,
    onLost,
    hear,
    deafen: () => {
      canHear = false;
    },
    undeafen: () => {
      canHear = true;
    },
  };
};

it('steps once per stretch of sound heard, however it arrives', () => {
  const { clock, hear, onStep, runs } = setUp();
  clock.follow(true);
  hear(0.1);
  hear(0.1);
  expect(onStep).not.toHaveBeenCalled();
  hear(0.1);
  expect(onStep).toHaveBeenCalledTimes(1);
  // A block of no known rate counts for nothing, however many frames.
  runs[runs.length - 1].listener.audio({
    sampleRate: 0,
    channels: 2,
    frames: 48000,
    sequence: 0,
    pcm: new ArrayBuffer(0),
  });
  expect(onStep).toHaveBeenCalledTimes(1);
});

it('listens only while wanted, once', () => {
  const { clock, runs } = setUp();
  clock.follow(false);
  expect(runs).toHaveLength(0);
  clock.follow(true);
  clock.follow(true);
  expect(runs).toHaveLength(1);
  clock.follow(false);
  expect(runs[0].stop).toHaveBeenCalledTimes(1);
});

it('asks nothing again after the output could not be heard, until it changes', () => {
  const { clock, runs, deafen, undeafen, onLost } = setUp();
  deafen();
  clock.follow(true);
  expect(clock.isLost()).toBe(true);
  expect(onLost).toHaveBeenCalledTimes(1);
  undeafen();
  clock.follow(true);
  expect(runs).toHaveLength(0);
  clock.reset();
  clock.follow(true);
  expect(runs).toHaveLength(1);
  expect(clock.isLost()).toBe(false);
});
