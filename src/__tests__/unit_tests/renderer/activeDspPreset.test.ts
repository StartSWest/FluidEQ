/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Which preset is on now, as the equaliser's picker and a game's sound both
 * ask it.
 *
 * The rack names it while it runs. While it is off — which under Equalizer
 * APO is always — the Preset layer does. A game's sound reading the rack
 * alone put back nothing under APO when the game ended, and took the curve
 * away with it.
 */
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { activeDspPresetId } from 'renderer/dsp/dspPresetCatalog';

const rack = (enabled: boolean) => ({
  ...DSP_DEFAULTS,
  enabled,
  presetId: 'gaming',
});

it('names the rack’s preset while the rack runs, whatever the curve', () => {
  expect(
    activeDspPresetId(rack(true), { profileId: 'dsp:metal', intensity: 1 }),
  ).toBe('gaming');
});

it('names the Preset layer’s preset while the rack is off', () => {
  expect(
    activeDspPresetId(rack(false), { profileId: 'dsp:metal', intensity: 1 }),
  ).toBe('metal');
});

it('names nothing when neither says a preset is on', () => {
  expect(activeDspPresetId(rack(false), undefined)).toBeUndefined();
  expect(
    activeDspPresetId(rack(false), { profileId: 'music', intensity: 1 }),
  ).toBeUndefined();
});
