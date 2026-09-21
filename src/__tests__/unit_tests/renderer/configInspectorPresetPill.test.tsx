/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Config page calls the Preset layer `preset`, as the EQ page does.
 *
 * Its pill says the word in the file's own name, and that word was `voicing`
 * — beside a chip on the EQ page that says Preset, for a layer a preset fills.
 * The file is `-preset.txt` now; a config the previous version wrote, still
 * naming it `-voicing.txt` until the next write, reads as the same layer with
 * the same word.
 */
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import type { IApoConfigTree } from 'common/apoConfig';
import ConfigInspector from 'renderer/components/ConfigInspector';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { getApoConfigTree } from 'renderer/utils/equalizerApi';
import defaultContext from '__tests__/utils/mockFluidEqProvider';

jest.mock('renderer/utils/equalizerApi', () => ({
  getApoConfigTree: jest.fn(),
  getAudioDevices: jest.fn().mockResolvedValue([]),
  exportDeviceChain: jest.fn(),
  importDeviceChain: jest.fn(),
  writeApoConfigFile: jest.fn(),
}));

const SLUG = '0123456789ab';

const treeWith = (presetFile: string): IApoConfigTree => ({
  configDirPath: 'C:/config',
  root: { fileName: 'fluideq.txt', lines: [], includes: [] },
  devices: [
    {
      devicePattern: '{1234-ABCD}',
      label: 'USB Headphones -> Layered',
      filterCount: 2,
      preAmp: 'Preamp: -3 dB',
      layers: [
        { feature: 'eq', isApplied: true },
        { feature: 'voicing', isApplied: true },
      ],
      file: {
        fileName: `fluideq-device-${SLUG}.txt`,
        lines: ['Preamp: -3 dB'],
        includes: [
          {
            fileName: `fluideq-${SLUG}-eq.txt`,
            lines: ['Filter 1: ON PK Fc 80 Hz Gain 3 dB Q 0.8'],
            includes: [],
          },
          {
            fileName: presetFile,
            lines: ['Filter 1: ON PK Fc 5000 Hz Gain 3.3 dB Q 2.23'],
            includes: [],
          },
        ],
      },
    },
  ],
  isApplied: true,
  isIncludedByApo: true,
});

it.each([
  ['its own name', `fluideq-${SLUG}-preset.txt`],
  ['the name it had before', `fluideq-${SLUG}-voicing.txt`],
])('calls the Preset layer preset, read under %s', async (_how, fileName) => {
  jest.mocked(getApoConfigTree).mockResolvedValue(treeWith(fileName));
  render(
    <FluidEqProviderWrapper value={defaultContext}>
      <ConfigInspector />
    </FluidEqProviderWrapper>,
  );
  await screen.findByText(fileName);
  const pills = Array.from(
    document.querySelectorAll('.config-layer__name'),
  ).map((pill) => pill.textContent);
  expect(pills).toContain('preset');
  expect(pills).not.toContain('voicing');
  // The control: every other layer keeps the word its file has always had.
  expect(pills).toContain('eq');
});
