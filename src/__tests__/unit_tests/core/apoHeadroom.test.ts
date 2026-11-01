/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Auto normalize on Equalizer APO, heard and decided by the core: it listens
 * only while it is on, waits for each trim to land before measuring again and
 * takes nothing heard before it as evidence, looks again sooner after an
 * edit, clears an older version's estimate once before listening, and after
 * a helper that failed waits for the output to change.
 */
import type {
  ISystemSound,
  ISystemSoundBlock,
  ISystemSoundListener,
} from 'core/systemSound/systemSound';
import {
  createApoHeadroom,
  type IApoHeadroomState,
} from 'core/headroom/apoHeadroom';
import { createPeakFrames } from 'core/headroom/peakFrames';

const RATE = 48000;

/** `seconds` of a steady level, in 10 ms blocks. */
const blocksAt = (amplitude: number, seconds: number): ISystemSoundBlock[] =>
  Array.from({ length: Math.round(seconds * 100) }, (_v, sequence) => ({
    sampleRate: RATE,
    channels: 2,
    frames: 480,
    sequence,
    pcm: new Float32Array(960).fill(amplitude).buffer,
  }));

const setUp = () => {
  const runs: { listener: ISystemSoundListener; stop: jest.Mock }[] = [];
  let refuse = false;
  const systemSound: ISystemSound = {
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
  const writes: { trim: number; land: (applied: boolean) => void }[] = [];
  const applyTrim = jest.fn(
    (trim: number) =>
      new Promise<boolean>((resolve) => {
        writes.push({ trim, land: resolve });
      }),
  );
  const headroom = createApoHeadroom({ systemSound, applyTrim });
  const play = (blocks: ISystemSoundBlock[]) =>
    blocks.forEach((block) => runs[runs.length - 1].listener.audio(block));
  return {
    headroom,
    runs,
    writes,
    applyTrim,
    play,
    refuseFromNowOn: () => {
      refuse = true;
    },
  };
};

const on = (over: Partial<IApoHeadroomState> = {}): IApoHeadroomState => ({
  enabled: true,
  trimDb: 0,
  hasLegacyProgramme: false,
  ...over,
});

/** Let a write's answer and what follows it run. */
const settle = async () => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

describe('Auto normalize on Equalizer APO, in the core', () => {
  it('listens only while it is on', () => {
    const { headroom, runs } = setUp();
    headroom.follow(on({ enabled: false }));
    expect(runs).toHaveLength(0);

    headroom.follow(on());
    headroom.follow(on());
    expect(runs).toHaveLength(1);

    headroom.follow(on({ enabled: false }));
    expect(runs[0].stop).toHaveBeenCalledTimes(1);
  });

  it('turns down an output near full scale, and waits for each write before sending more', async () => {
    const { headroom, writes, play } = setUp();
    headroom.follow(on());
    // At full scale for three seconds: one write, held until it lands.
    play(blocksAt(1, 3));
    expect(writes).toHaveLength(1);
    expect(writes[0].trim).toBeLessThan(0);

    writes[0].land(true);
    await settle();
    // Two more seconds as loud: the next step, measured after the first.
    play(blocksAt(1, 2.1));
    expect(writes).toHaveLength(2);
    expect(writes[1].trim).toBeLessThan(writes[0].trim);
  });

  it('takes nothing heard before a write landed as evidence', async () => {
    const { headroom, writes, play } = setUp();
    headroom.follow(on());
    // Written on the twentieth tenth of a second; the write lands halfway
    // through the twenty-first, so that tenth began at the old level.
    play(blocksAt(1, 2.05));
    expect(writes).toHaveLength(1);
    writes[0].land(true);
    await settle();
    // Two more seconds: nineteen tenths that began after the landing, and
    // the one that straddled it, which does not count.
    play(blocksAt(1, 2));
    expect(writes).toHaveLength(1);
    // The control: one tenth more makes twenty, and the next write.
    play(blocksAt(1, 0.1));
    expect(writes).toHaveLength(2);
  });

  it('looks again sooner after an edit to the chain', () => {
    const quietThenEdited = setUp();
    quietThenEdited.headroom.follow(on({ trimDb: -4 }));
    quietThenEdited.headroom.edited();
    quietThenEdited.play(blocksAt(0.3, 2.1));
    // The control: the same quiet passage with no edit writes nothing yet.
    const untouched = setUp();
    untouched.headroom.follow(on({ trimDb: -4 }));
    untouched.play(blocksAt(0.3, 2.1));

    expect(quietThenEdited.writes.map((write) => write.trim)).toEqual([-3.5]);
    expect(untouched.writes).toHaveLength(0);
  });

  it('clears an older version’s estimate once, with the trim alone, before listening', () => {
    const { headroom, writes, play } = setUp();
    headroom.follow(on({ trimDb: -3, hasLegacyProgramme: true }));
    expect(writes.map((write) => write.trim)).toEqual([-3]);
    // Nothing more until that has landed.
    play(blocksAt(1, 3));
    expect(writes).toHaveLength(1);
  });

  it('waits for the output to change after the helper fails', () => {
    const { headroom, runs } = setUp();
    headroom.follow(on());
    runs[0].listener.lost();
    // Being told the state again is not a reason to think it can hear now.
    headroom.follow(on());
    headroom.follow(on());
    expect(runs).toHaveLength(1);
  });

  it('starts again on a new output once it can hear', () => {
    const { headroom, runs } = setUp();
    headroom.follow(on());
    runs[0].listener.lost();
    headroom.outputChanged();
    expect(runs).toHaveLength(2);
  });

  it('starts nothing on a new output where nothing can hear it', () => {
    const { headroom, runs, refuseFromNowOn } = setUp();
    headroom.follow(on());
    refuseFromNowOn();
    runs[0].listener.lost();
    headroom.outputChanged();
    // Refused again: no run, and nothing loops.
    expect(runs).toHaveLength(1);
  });

  it('changes nothing on an output change while it hears', () => {
    const { headroom, runs } = setUp();
    headroom.follow(on());
    headroom.outputChanged();
    expect(runs).toHaveLength(1);
    expect(runs[0].stop).not.toHaveBeenCalled();
  });

  it('ignores a write that lands after it was switched off', async () => {
    const { headroom, writes, play, runs } = setUp();
    headroom.follow(on());
    play(blocksAt(1, 2.5));
    headroom.follow(on({ enabled: false }));
    writes[0].land(true);
    await settle();
    headroom.follow(on());
    // A fresh run, measuring from its own start.
    expect(runs).toHaveLength(2);
    play(blocksAt(1, 1.5));
    expect(writes).toHaveLength(1);
  });
});

describe('the output’s peaks, a tenth of a second at a time', () => {
  it('measures every channel across blocks of any size', () => {
    const frames: {
      peakDbfs: number;
      durationMs: number;
      startFrame: number;
    }[] = [];
    const peaks = createPeakFrames((frame) => frames.push(frame));
    const block = (left: number, right: number, length: number) => {
      const pcm = new Float32Array(length * 2);
      for (let at = 0; at < length; at += 1) {
        pcm[at * 2] = left;
        pcm[at * 2 + 1] = right;
      }
      return {
        sampleRate: RATE,
        channels: 2,
        frames: length,
        sequence: 0,
        pcm: pcm.buffer,
      };
    };
    peaks.push(block(0.25, -0.5, 3000));
    peaks.push(block(0, 0, 1800));
    peaks.push(block(0, 0, 4800));

    expect(frames).toHaveLength(2);
    expect(frames[0].peakDbfs).toBeCloseTo(20 * Math.log10(0.5), 9);
    expect(frames[0].durationMs).toBeCloseTo(100, 9);
    expect(frames[0].startFrame).toBe(0);
    expect(frames[1].peakDbfs).toBe(-240);
    expect(frames[1].startFrame).toBe(4800);
    expect(peaks.heardFrames()).toBe(9600);
  });
});
