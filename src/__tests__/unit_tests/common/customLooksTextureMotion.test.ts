/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Whether a look's texture moves with the music is kept with the look
 * (Ivan, 2026-11-27: "user can toggle on/off that feature"), and every look
 * saved before the switch opens with its texture still, as it always drew.
 */

import {
  getDefaultTuning,
  normalizeCustomLook,
  type ICustomLook,
} from 'common/customLooks';

const saved = (tuning: Record<string, unknown>): ICustomLook | null =>
  normalizeCustomLook({
    id: 'custom:dots',
    name: 'Dots',
    style: 'analyzer',
    palette: 'auto',
    tuning: { filled: true, texture: 'dots', ...tuning },
    colours: [],
  });

describe("a look's moving texture", () => {
  it('keeps the switch through a save and a load', () => {
    const moving = saved({ textureMotion: true });
    expect(moving?.tuning.textureMotion).toBe(true);
    const reloaded = normalizeCustomLook(JSON.parse(JSON.stringify(moving)));
    expect(reloaded?.tuning.textureMotion).toBe(true);
  });

  it('opens a look saved before the switch with its texture still', () => {
    expect(saved({})?.tuning.textureMotion).toBe(false);
    // The control: a stored false is read as false, and a stored true as
    // true above, so the default is the reading of an absent field.
    expect(saved({ textureMotion: false })?.tuning.textureMotion).toBe(false);
  });

  it('reads anything but a yes or a no as still', () => {
    expect(saved({ textureMotion: 'yes' })?.tuning.textureMotion).toBe(false);
    expect(saved({ textureMotion: 1 })?.tuning.textureMotion).toBe(false);
  });

  it('is off on every new look, whatever its form', () => {
    expect(getDefaultTuning('analyzer').textureMotion).toBe(false);
    expect(getDefaultTuning('ledbars').textureMotion).toBe(false);
  });
});
