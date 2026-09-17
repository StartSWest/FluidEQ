/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import fs from 'fs';
import os from 'os';
import path from 'path';
import type { IWallpaperDisplay } from '../../../common/wallpaper';
import {
  createArrangementStore,
  matchSavedScreens,
  parseArrangement,
  savedMonitorOf,
  type ISavedScreen,
} from '../../../main/wallpaper/arrangement';

const display = (
  id: number,
  x: number,
  label = '',
  width = 2560,
  height = 1440,
): IWallpaperDisplay => ({
  id,
  label,
  x,
  y: 0,
  width,
  height,
  primary: x === 0,
});

const saved = (
  displayId: number,
  monitor: IWallpaperDisplay,
  lookId = 'premium:alpine',
): ISavedScreen => ({
  displayId,
  choice: { lookId, wave: { height: 1, position: 0 }, motion: 'music' },
  monitor: savedMonitorOf(monitor),
});

describe('reading back what each monitor was set to show', () => {
  const file = {
    version: 1,
    pauseOnBattery: false,
    screens: [
      {
        displayId: 782843922,
        lookId: 'premium:aurora',
        wave: { height: 0.4, position: 0.65 },
        motion: 'calm',
        monitor: {
          label: 'Odyssey G5',
          x: 2560,
          y: 0,
          width: 2560,
          height: 1440,
        },
      },
    ],
  };

  it('takes the file as this app writes it', () => {
    expect(parseArrangement(file)).toEqual({
      pauseOnBattery: false,
      // A file from before the choice existed means what a fresh install means.
      performance: {
        frameRate: 'display',
        resolution: 'auto',
        autoFloor: 0.35,
        upscaler: 'fsr',
        smoothing: 'fast',
      },
      screens: [
        {
          displayId: 782843922,
          choice: {
            lookId: 'premium:aurora',
            wave: { height: 0.4, position: 0.65 },
            motion: 'calm',
          },
          monitor: {
            label: 'Odyssey G5',
            x: 2560,
            y: 0,
            width: 2560,
            height: 1440,
          },
        },
      ],
    });
  });

  // Backgrounds set before waves and motions were kept were drawn with the
  // whole band, following the music, and come back that way.
  it('reads a file from before the wave and the motion as the whole band with the music', () => {
    const [screen] = file.screens;
    const { wave, motion, ...older } = screen;
    expect([wave.height, motion]).toEqual([0.4, 'calm']);
    expect(
      parseArrangement({ ...file, screens: [older] })?.screens[0].choice,
    ).toEqual({
      lookId: 'premium:aurora',
      wave: { height: 1, position: 0 },
      motion: 'music',
    });
  });

  it('ignores the whole file when any of it is not what this app writes', () => {
    const [screen] = file.screens;
    const broken: unknown[] = [
      { ...file, version: 2 },
      { ...file, pauseOnBattery: 'no' },
      { ...file, screens: [{ ...screen, lookId: 'C:/scene.frag' }] },
      { ...file, screens: [{ ...screen, motion: 'loud' }] },
      { ...file, screens: [{ ...screen, wave: { height: 3, position: 0 } }] },
      {
        ...file,
        screens: [{ ...screen, monitor: { ...screen.monitor, width: 0 } }],
      },
      { ...file, screens: [screen, { ...screen, lookId: 'premium:ember' }] },
      {
        ...file,
        screens: Array.from({ length: 17 }, (_, id) => ({
          ...screen,
          displayId: id,
        })),
      },
      [],
      null,
    ];
    broken.forEach((raw) => expect(parseArrangement(raw)).toBeUndefined());
  });
});

describe('the file on disk', () => {
  let folder: string;
  const warn = jest.fn();
  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-wallpaper-'));
    warn.mockClear();
  });
  afterEach(() => fs.rmSync(folder, { recursive: true, force: true }));

  it('is nothing to bring back before a background was ever set, and says nothing about it', () => {
    expect(createArrangementStore(folder, { warn }).read()).toEqual({
      pauseOnBattery: true,
      performance: {
        frameRate: 'display',
        resolution: 'auto',
        autoFloor: 0.35,
        upscaler: 'fsr',
        smoothing: 'fast',
      },
      screens: [],
    });
    expect(warn).not.toHaveBeenCalled();
  });

  it('gives back what was written, with each choice beside its monitor', () => {
    const store = createArrangementStore(folder, { warn });
    const right = display(782843922, 2560, 'Odyssey G5');
    const written = {
      pauseOnBattery: false,
      performance: {
        frameRate: 'sixty' as const,
        resolution: 'native' as const,
        autoFloor: 0.67 as const,
        upscaler: 'simple' as const,
        smoothing: 'best' as const,
      },
      screens: [
        {
          ...saved(right.id, right),
          choice: {
            lookId: 'premium:aurora',
            wave: { height: 0.35, position: 0.6 },
            motion: 'calm' as const,
          },
        },
      ],
    };
    store.write(written);
    expect(store.read()).toEqual(written);
    const onDisk = JSON.parse(
      fs.readFileSync(path.join(folder, 'desktop-backgrounds.json'), 'utf8'),
    );
    expect(onDisk.screens[0]).toEqual({
      displayId: right.id,
      lookId: 'premium:aurora',
      wave: { height: 0.35, position: 0.6 },
      motion: 'calm',
      monitor: {
        label: 'Odyssey G5',
        x: 2560,
        y: 0,
        width: 2560,
        height: 1440,
      },
    });
  });

  it('starts empty from a damaged file, and says why', () => {
    fs.writeFileSync(path.join(folder, 'desktop-backgrounds.json'), '{"vers');
    expect(createArrangementStore(folder, { warn }).read().screens).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

describe('finding each remembered monitor again', () => {
  const left = display(545559594, -2560, '', 2560, 1600);
  const middle = display(543719851, 0, 'Y27qf-30');
  const right = display(782843922, 2560, 'Odyssey G5');

  it('finds a monitor under the id it had', () => {
    const { matches, missing } = matchSavedScreens(
      [saved(right.id, right), saved(left.id, left, 'premium:aurora')],
      [left, middle, right],
    );
    expect(
      matches.map((match) => [match.saved.choice.lookId, match.display.id]),
    ).toEqual([
      ['premium:alpine', right.id],
      ['premium:aurora', left.id],
    ]);
    expect(missing).toEqual([]);
  });

  // A driver update, or a cable moved to another port, renumbers the outputs.
  it('finds a renumbered monitor by its name and resolution, nearest to where it stood', () => {
    const renumbered = { ...right, id: 1 };
    const twin = display(9, -5120, 'Odyssey G5');
    const { matches } = matchSavedScreens(
      [saved(right.id, right)],
      [twin, middle, renumbered],
    );
    expect(matches.map((match) => match.display.id)).toEqual([1]);
  });

  it('finds a nameless monitor only where it stood, at the same resolution', () => {
    const moved = { ...left, id: 12, x: -5120 };
    expect(
      matchSavedScreens([saved(left.id, left)], [moved]).missing,
    ).toHaveLength(1);
    const same = { ...left, id: 12 };
    expect(
      matchSavedScreens([saved(left.id, left)], [same]).matches,
    ).toHaveLength(1);
  });

  it('never puts two remembered backgrounds on one monitor', () => {
    const first = saved(100, right, 'premium:alpine');
    const second = saved(101, right, 'premium:aurora');
    const { matches, missing } = matchSavedScreens(
      [first, second],
      [{ ...right, id: 5 }],
    );
    expect(matches).toHaveLength(1);
    expect(missing).toHaveLength(1);
  });
});
