/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { dynamicsPresetSettings } from '../../../common/dsp/dynamicsPresets';
import { clampDynamicsSettings } from '../../../common/dsp/dynamicsStage';
import dynamicsGainDb from '../../../renderer/dsp/dynamicsCurve';

it('offers six distinct, bounded music profiles with independent settings', () => {
  const ids = [
    'transparent',
    'punch',
    'acoustic',
    'vocal',
    'warm',
    'movie',
  ] as const;
  const signatures = ids.map((id) => {
    const settings = dynamicsPresetSettings(id, true);
    expect(clampDynamicsSettings(settings)).toEqual(settings);
    expect(settings.enabled).toBe(true);
    const bypassed = dynamicsPresetSettings(id, false);
    expect(bypassed.enabled).toBe(false);
    expect(settings.bands[0]).not.toBe(bypassed.bands[0]);
    return JSON.stringify(
      settings.bands.map((band) =>
        [-60, -40, -28, -18, -8].map(
          (db) => dynamicsGainDb(band, db) + settings.makeupDb,
        ),
      ),
    );
  });
  expect(new Set(signatures).size).toBe(ids.length);
});
