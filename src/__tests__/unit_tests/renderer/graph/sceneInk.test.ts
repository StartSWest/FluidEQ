/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which ink words standing on a picture wear (Ivan, 2026-11-17: "detect when
 * the scene is very bright and put them the other way round"): light over
 * most pictures, dark over a bright one, decided from the mean relative
 * luminance behind them, with a band between the two turns so a picture
 * pulsing with the beat stays on one side of it. Plain figures on a standard
 * look carry no shadow and turn sooner (`PLAIN_TEXT_INK_TURNS`).
 */

import {
  PLAIN_TEXT_INK_TURNS,
  SCENE_INK_DARK_ABOVE,
  SCENE_INK_LIGHT_BELOW,
  createSceneInkFollower,
  meanRelativeLuminance,
} from '../../../../renderer/graph/sceneInk';

/** `count` pixels of one sRGB grey, as WebGL reads them back. */
const grey = (value: number, count = 4) =>
  new Uint8Array(
    Array.from({ length: count }, () => [value, value, value, 255]).flat(),
  );

/** A follower that has heard `level` long enough to have settled on it. */
const settled = (
  follower: ReturnType<typeof createSceneInkFollower>,
  level: number,
) => {
  let ink = follower.hear(level);
  for (let read = 0; read < 60; read += 1) {
    ink = follower.hear(level);
  }
  return ink;
};

describe('the light behind the words', () => {
  it('is measured in linear light, as the eye judges it', () => {
    expect(meanRelativeLuminance(grey(0))).toBe(0);
    expect(meanRelativeLuminance(grey(255))).toBeCloseTo(1, 6);
    // Half white and half black is half the light, not the 0.21 of an
    // average taken in sRGB bytes (mid-grey's luminance).
    const half = new Uint8Array([...grey(255, 2), ...grey(0, 2)]);
    expect(meanRelativeLuminance(half)).toBeCloseTo(0.5, 6);
    expect(meanRelativeLuminance(grey(128))).toBeCloseTo(0.216, 2);
    expect(meanRelativeLuminance(new Uint8Array())).toBe(0);
  });
});

describe('the ink over a scene', () => {
  it('turns dark past 0.45 and back to light only under 0.34', () => {
    expect(SCENE_INK_DARK_ABOVE).toBe(0.45);
    expect(SCENE_INK_LIGHT_BELOW).toBe(0.34);
    const follower = createSceneInkFollower();
    // The first reading is taken as it is.
    expect(follower.hear(0.5)).toBe('dark');
    // Inside the band it stays where it was, however long it is heard.
    expect(settled(follower, 0.4)).toBe('dark');
    expect(settled(follower, 0.35)).toBe('dark');
    expect(settled(follower, 0.3)).toBe('light');
    // And the other way: in the band from below, it stays light.
    expect(settled(follower, 0.44)).toBe('light');
    expect(settled(follower, 0.46)).toBe('dark');
  });

  it('starts light, over a picture in the band', () => {
    expect(createSceneInkFollower().hear(0.4)).toBe('light');
  });

  it('rides out one bright frame rather than turning on it', () => {
    const follower = createSceneInkFollower();
    settled(follower, 0.2);
    // A flash: a quarter of the way there, still light.
    expect(follower.hear(1)).toBe('light');
    // Positive control: kept up, the picture is bright and the ink turns.
    expect(settled(follower, 1)).toBe('dark');
  });

  it('ignores a reading that is not a number, and forgets the picture on reset', () => {
    const follower = createSceneInkFollower();
    expect(follower.hear(0.9)).toBe('dark');
    expect(follower.hear(Number.NaN)).toBe('dark');
    follower.reset();
    // Taken as it is again, not eased from the old picture.
    expect(follower.hear(0.1)).toBe('light');
  });
});

describe('the ink of plain figures on a standard look', () => {
  it('turns sooner: dark past 0.30, light again under 0.22', () => {
    expect(PLAIN_TEXT_INK_TURNS).toEqual({ darkAbove: 0.3, lightBelow: 0.22 });
    const plain = createSceneInkFollower(PLAIN_TEXT_INK_TURNS);
    // "-60 dB" over a pale-blue bar top at 0.44, read under the scene's
    // turns, stayed light and unread; the plain turns take it dark.
    expect(plain.hear(0.35)).toBe('dark');
    expect(createSceneInkFollower().hear(0.35)).toBe('light');
    expect(settled(plain, 0.25)).toBe('dark');
    expect(settled(plain, 0.2)).toBe('light');
  });
});
