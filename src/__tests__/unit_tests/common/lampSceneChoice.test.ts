/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  readLampSceneChoice,
  type ILampSceneChoice,
} from 'common/lighting/lampSceneChoice';

/**
 * What the window says the desk lights play reaches main from a page, and is
 * kept on disk: main acts on it only when it is exactly a choice, with the
 * accent held to unit colour, so a page or a file that says something else
 * leaves the desk as it was.
 */

const choice: ILampSceneChoice = {
  scene: {
    lookId: 'member:abc:def',
    identity: 'member:abc:def@r2',
    swatch: ['#102030', '#405060'],
    guarded: true,
  },
  paused: true,
  daylight: { clock: false, value: 62.5 },
  accent: [0, 0.5, 1],
};

it('reads a choice as it was made, and one with no scene', () => {
  expect(readLampSceneChoice(choice)).toEqual(choice);
  expect(readLampSceneChoice(JSON.parse(JSON.stringify(choice)))).toEqual(
    choice,
  );
  expect(
    readLampSceneChoice({ ...choice, scene: null, daylight: { clock: true } }),
  ).toEqual({ ...choice, scene: null, daylight: { clock: true } });
});

it('holds the accent to unit colour', () => {
  expect(
    readLampSceneChoice({ ...choice, accent: [-1, 0.5, 9] })?.accent,
  ).toEqual([0, 0.5, 1]);
});

it('refuses what is not a choice', () => {
  const refused: unknown[] = [
    undefined,
    null,
    [],
    { ...choice, paused: 'yes' },
    { ...choice, accent: [0, 0.5] },
    { ...choice, accent: [0, Number.NaN, 1] },
    { ...choice, daylight: { clock: false } },
    { ...choice, daylight: { clock: false, value: Number.POSITIVE_INFINITY } },
    { ...choice, scene: { ...choice.scene, lookId: '' } },
    { ...choice, scene: { ...choice.scene, guarded: 1 } },
    { ...choice, scene: { ...choice.scene, swatch: [7] } },
    {
      ...choice,
      scene: {
        ...choice.scene,
        swatch: Array.from({ length: 65 }, () => '#fff'),
      },
    },
  ];
  refused.forEach((raw) => expect(readLampSceneChoice(raw)).toBeUndefined());
});
