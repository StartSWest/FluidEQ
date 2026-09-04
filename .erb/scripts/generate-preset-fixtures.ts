/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/** Test the shipped catalogue through its real wire decoder, without a device. */
import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { encodeChainSettings } from '../../src/common/dsp/chainWire';
import { DSP_PRESETS } from '../../src/common/dsp/presets';
import { filterPresetCases } from './dsp-preset-cases';

const cases = [
  ...DSP_PRESETS.map((preset) => ({ ...preset, family: 'chain' })),
  ...filterPresetCases(),
];
const directory = path.resolve(__dirname, '../../native/.build');
mkdirSync(directory, { recursive: true });
writeFileSync(
  path.join(directory, 'preset-fixtures.txt'),
  cases
    .map(({ family, id, settings }) => {
      const parameters = encodeChainSettings(settings);
      return `${family} ${id} ${parameters.length} ${parameters.join(' ')}`;
    })
    .join('\n'),
);
process.stdout.write(`native presets: ${cases.length} catalogue fixtures\n`);
