/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Test the shipped catalogue through its real wire decoder, without a device.
 *
 * A chain goes on the wire as the app sends it: its rack, then its preset's
 * curve as the Preset layer writes it (`presetToneOf`, Your EQ at Normal and
 * Precise), so `preset_safety_test.cpp` renders the rack told its curve and
 * plays the curve after it, as the main EQ does — which is where a preset's
 * loudest peaks are heard. `native/.build` unless a directory is named.
 */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import {
  appendPresetTone,
  encodeChainSettings,
} from '../../src/common/dsp/chainWire';
import { DSP_PRESETS, IDspPreset } from '../../src/common/dsp/presets';
import { presetToneOf } from '../../src/common/dsp/presetTone';
import { dspPresetVoicing } from '../../src/common/dsp/presetVoicing';
import { filterPresetCases } from './dsp-preset-cases';

const toneOf = (preset: IDspPreset) =>
  preset.curve === undefined
    ? undefined
    : presetToneOf(
        {
          isEnabled: true,
          voicing: dspPresetVoicing(preset.id, preset.curve),
          bypassed: [],
          eqMode: 'normal',
          curveEqMode: 'normal',
          isEqDoubleOn: false,
          eqBandQ: undefined,
          curveBandQ: undefined,
        },
        { eq: true, curves: true },
      );

const chains = DSP_PRESETS.map((preset) => ({
  family: 'chain',
  id: preset.id,
  parameters: appendPresetTone(
    encodeChainSettings(preset.settings),
    toneOf(preset),
  ),
}));
const locals = filterPresetCases().map(({ family, id, settings }) => ({
  family,
  id,
  parameters: encodeChainSettings(settings),
}));
const directory = path.resolve(
  process.argv[2] ?? path.join(__dirname, '../../native/.build'),
);
mkdirSync(directory, { recursive: true });
writeFileSync(
  path.join(directory, 'preset-fixtures.txt'),
  [...chains, ...locals]
    .map(
      ({ family, id, parameters }) =>
        `${family} ${id} ${parameters.length} ${parameters.join(' ')}`,
    )
    .join('\n'),
);
process.stdout.write(
  `native presets: ${chains.length + locals.length} catalogue fixtures\n`,
);
