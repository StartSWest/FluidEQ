/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import presetLayerForRack from 'common/dsp/presetLayerForRack';
import { clampDspSettings, type IDspSettings } from 'common/dsp/chain';
import { dspPresetCurve, dspPresetSettings } from 'common/dsp/presets';
import { dspPresetVoicing, dspVoicingPresetId } from 'common/dsp/presetVoicing';

/**
 * Ivan, 2026-10-15: switching to the BlackShark showed Music on the preset
 * picker while the Curves list played Podcast — the one-time copy of the old
 * app-wide rack into each profile wrote the rack and left the profile's own
 * preset curve. The rack is what the picker names, so the curve follows it.
 */
const rackOf = (id: string): IDspSettings => {
  const rack = dspPresetSettings(id);
  if (!rack) {
    throw new Error(`no factory preset ${id}`);
  }
  return { ...rack, enabled: true };
};
const layerOf = (id: string, intensity = 1) => {
  const curve = dspPresetCurve(id);
  if (!curve) {
    throw new Error(`no curve for ${id}`);
  }
  return { ...dspPresetVoicing(id, curve), intensity };
};

it("replaces another preset's curve with the rack's own, at its strength", () => {
  const fixed = presetLayerForRack(layerOf('podcast', 0.6), rackOf('music'));
  expect(dspVoicingPresetId(fixed)).toBe('music');
  expect(fixed?.intensity).toBe(0.6);
  expect(fixed).toEqual(layerOf('music', 0.6));
});

it('keeps the layer when it already matches the rack', () => {
  const layer = layerOf('music');
  expect(presetLayerForRack(layer, rackOf('music'))).toBe(layer);
});

it('keeps the layer while the rack is off, or edited away from its preset', () => {
  const layer = layerOf('podcast');
  expect(
    presetLayerForRack(layer, { ...rackOf('music'), enabled: false }),
  ).toBe(layer);
  const edited = clampDspSettings({ ...rackOf('music'), presetId: undefined });
  expect(presetLayerForRack(layer, edited)).toBe(layer);
});

it('adds no layer where there is none, and leaves a voicing that is not a preset', () => {
  expect(presetLayerForRack(undefined, rackOf('music'))).toBeUndefined();
  const listener = { profileId: 'warm-vocals', intensity: 1 };
  expect(presetLayerForRack(listener, rackOf('music'))).toBe(listener);
});

it('takes the layer away when the rack names a preset with no curve', () => {
  expect(dspPresetCurve('reference')).toBeUndefined();
  expect(
    presetLayerForRack(layerOf('podcast'), rackOf('reference')),
  ).toBeUndefined();
});
