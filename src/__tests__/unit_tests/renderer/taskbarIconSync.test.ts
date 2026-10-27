/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The taskbar button in the window's colours (Ivan, 2026-10-26: "change the
 * color on the icon that is on the taskbar to match the app color"): which
 * icon a window gets, and how its changes reach main — once a frame at most,
 * one at a time, always ending on the latest colours.
 */

import type { TTaskbarIconRequest } from 'common/taskbarIcon';
import { LAGOON_SKY } from 'renderer/utils/rainbowPalette';
import type { ITaskbarIconColours } from 'renderer/utils/taskbarIconArt';
import {
  createTaskbarIconSync,
  isStockTaskbarIcon,
  taskbarIconReading,
  type ITaskbarIconReading,
} from 'renderer/utils/taskbarIconSync';
import { tintedLagoon } from 'renderer/utils/windowTint';
import { DEFAULT_SHADE } from 'renderer/utils/theme';

const PINK: ITaskbarIconColours = {
  tile: ['#2c2b3f', '#242335', '#1b172a'],
  logo: ['#f1b3ff', '#e9adff', '#e2a7ff', '#e99bd9', '#f08fb5'],
};
const GREEN: ITaskbarIconColours = {
  tile: ['#1c3326', '#13271d', '#0c1a13'],
  logo: ['#7ff0b4', '#6febaa', '#5fe39a', '#59d8b2', '#53cdca'],
};

describe('which icon the taskbar button wears', () => {
  it('is the installed one while the window wears the app’s own colours', () => {
    expect(isStockTaskbarIcon(LAGOON_SKY, DEFAULT_SHADE)).toBe(true);
  });

  it('is drawn once a Tint, a visualizer or Brightness changes them', () => {
    // A Tint lends Lagoon turned to its colour: another sky.
    expect(isStockTaskbarIcon(tintedLagoon(320), DEFAULT_SHADE)).toBe(false);
    // A scene look with Window colours off lends nothing.
    expect(isStockTaskbarIcon(undefined, DEFAULT_SHADE)).toBe(false);
    expect(isStockTaskbarIcon(LAGOON_SKY, DEFAULT_SHADE + 1)).toBe(false);
  });

  it('asks for the installed icon without reading or drawing anything', () => {
    const draw = jest.fn();
    const reading = taskbarIconReading(true, undefined, draw);
    expect(reading?.key).toBe('stock');
    expect(reading?.request()).toEqual({ kind: 'stock' });
    expect(draw).not.toHaveBeenCalled();
  });

  it('keys a drawn icon by its colours, and draws it only when asked', () => {
    const draw = jest.fn((): TTaskbarIconRequest => ({
      kind: 'drawn',
      images: [],
    }));
    const pink = taskbarIconReading(false, PINK, draw);
    expect(pink?.key).toBe(taskbarIconReading(false, PINK, draw)?.key);
    expect(pink?.key).not.toBe(taskbarIconReading(false, GREEN, draw)?.key);
    expect(draw).not.toHaveBeenCalled();
    pink?.request();
    expect(draw).toHaveBeenCalledWith(PINK);
  });

  it('asks for nothing when the colours cannot be read', () => {
    expect(taskbarIconReading(false, undefined, jest.fn())).toBeUndefined();
  });
});

/** A sync driven by hand: frames run when told, sends settle when told. */
const harness = () => {
  const frames: (() => void)[] = [];
  const sends: {
    request: TTaskbarIconRequest;
    resolve: () => void;
    reject: (error: Error) => void;
  }[] = [];
  let reading: ITaskbarIconReading | undefined;
  const readingFor = (colours: ITaskbarIconColours): ITaskbarIconReading => ({
    key: colours.logo.join(),
    request: () => ({
      kind: 'drawn',
      images: [{ size: 16, rgba: new Uint8Array([colours.logo.length]) }],
    }),
  });
  const onError = jest.fn();
  const sync = createTaskbarIconSync({
    read: () => reading,
    send: (request) =>
      new Promise<void>((resolve, reject) => {
        sends.push({ request, resolve, reject });
      }),
    schedule: (work) => {
      frames.push(work);
    },
    onError,
  });
  const runFrames = () => {
    frames.splice(0).forEach((work) => work());
  };
  const settle = async () => {
    // The send's own `.catch` and `.finally` are two turns of the queue.
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  };
  return {
    sync,
    frames,
    sends,
    onError,
    runFrames,
    settle,
    show: (colours: ITaskbarIconColours | 'stock') => {
      reading =
        colours === 'stock'
          ? { key: 'stock', request: () => ({ kind: 'stock' }) }
          : readingFor(colours);
    },
  };
};

describe('the taskbar icon following the window', () => {
  it('folds a burst of changes into one frame and one icon', () => {
    const run = harness();
    run.show(PINK);
    for (let step = 0; step < 30; step += 1) {
      run.sync.changed();
    }
    expect(run.frames).toHaveLength(1);
    run.runFrames();
    expect(run.sends).toHaveLength(1);
  });

  it('sends nothing for colours that give the icon already on the button', async () => {
    const run = harness();
    run.show(PINK);
    run.sync.changed();
    run.runFrames();
    run.sends[0].resolve();
    await run.settle();

    run.sync.changed();
    run.runFrames();
    expect(run.sends).toHaveLength(1);
  });

  it('sends one at a time, and ends on the latest colours', async () => {
    const run = harness();
    run.show(PINK);
    run.sync.changed();
    run.runFrames();
    expect(run.sends).toHaveLength(1);

    // Colours change twice while the first is still on its way.
    run.show(GREEN);
    run.sync.changed();
    run.runFrames();
    run.show('stock');
    run.sync.changed();
    run.runFrames();
    expect(run.sends).toHaveLength(1);

    run.sends[0].resolve();
    await run.settle();
    run.runFrames();
    expect(run.sends).toHaveLength(2);
    expect(run.sends[1].request).toEqual({ kind: 'stock' });
  });

  it('tries again on the next change when main could not set it', async () => {
    const run = harness();
    run.show(PINK);
    run.sync.changed();
    run.runFrames();
    run.sends[0].reject(new Error('disk full'));
    await run.settle();
    expect(run.onError).toHaveBeenCalledWith(expect.any(Error));

    run.sync.changed();
    run.runFrames();
    expect(run.sends).toHaveLength(2);
  });

  it('does nothing once stopped, a booked frame included', () => {
    const run = harness();
    run.show(PINK);
    run.sync.changed();
    run.sync.stop();
    run.runFrames();
    run.sync.changed();
    run.runFrames();
    expect(run.sends).toHaveLength(0);
  });
});
