/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The Config page's tree, drawn as soon as the files are read.
 *
 * The tree is local files and the output being played through is a
 * PowerShell enumeration, and the two were awaited together: every reading —
 * each visit, and each edit made anywhere while the page was open — drew
 * nothing until the enumeration came back. Only a reading that does not know
 * the output yet waits for it now, because the current output's card leads
 * the row and is the one selected, and drawing first would move both.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IApoConfigTree } from 'common/apoConfig';
import type { IAudioDevice } from 'common/constants';
import ConfigInspector from 'renderer/components/ConfigInspector';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { getApoConfigTree, getAudioDevices } from 'renderer/utils/equalizerApi';
import defaultContext from '__tests__/utils/mockFluidEqProvider';

jest.mock('renderer/utils/equalizerApi', () => ({
  getApoConfigTree: jest.fn(),
  getAudioDevices: jest.fn(),
  exportDeviceChain: jest.fn(),
  importDeviceChain: jest.fn(),
  writeApoConfigFile: jest.fn(),
}));

const TREE: IApoConfigTree = {
  configDirPath: 'C:/config',
  root: { fileName: 'fluideq.txt', lines: [], includes: [] },
  devices: [
    {
      devicePattern: '{SPEAKERS}',
      label: 'Speakers -> Room',
      filterCount: 1,
      layers: [],
    },
    {
      devicePattern: '{HEADPHONES}',
      label: 'Headphones -> Flat',
      filterCount: 2,
      layers: [],
    },
  ],
  isApplied: true,
  isIncludedByApo: true,
};

const HEADPHONES_PLAYING: IAudioDevice[] = [
  {
    id: 'headphones',
    name: 'Headphones',
    guid: '{HEADPHONES}',
    isDefault: true,
    isActive: true,
  },
];

/** An answer that arrives when the case says so, and not before. */
const later = <T,>() => {
  let answer: (value: T) => void = () => undefined;
  const promise = new Promise<T>((resolve) => {
    answer = resolve;
  });
  return { promise, answer };
};

const cards = () =>
  screen
    .queryAllByRole('tab')
    .map((tab) => tab.querySelector('.config-card__name')?.textContent);

it('draws the tree without waiting for the output, once the output is known', async () => {
  jest.mocked(getApoConfigTree).mockResolvedValue(TREE);
  const firstOutput = later<IAudioDevice[]>();
  jest.mocked(getAudioDevices).mockReturnValueOnce(firstOutput.promise);

  render(
    <FluidEqProviderWrapper value={defaultContext}>
      <ConfigInspector />
    </FluidEqProviderWrapper>,
  );

  // The first reading does not know the output: the files are read, and the
  // tree waits for the output rather than drawing the cards in an order it
  // would change a moment later.
  await act(async () => undefined);
  expect(cards()).toEqual([]);
  await act(async () => firstOutput.answer(HEADPHONES_PLAYING));
  expect(cards()).toEqual(['Headphones', 'Speakers']);

  // A later reading, with the enumeration still on its way: the tree is
  // drawn from the files alone, in the order the known output gives it.
  const secondOutput = later<IAudioDevice[]>();
  jest.mocked(getAudioDevices).mockReturnValueOnce(secondOutput.promise);
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Reload/ }));
  });
  expect(cards()).toEqual(['Headphones', 'Speakers']);
  await act(async () => secondOutput.answer(HEADPHONES_PLAYING));

  // The output moving is the one thing that makes the next reading wait
  // again: the card that leads would no longer be the one playing.
  const thirdOutput = later<IAudioDevice[]>();
  jest.mocked(getAudioDevices).mockReturnValueOnce(thirdOutput.promise);
  window.dispatchEvent(new Event('fluideq-output-changed'));
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: /Reload/ }));
  });
  expect(cards()).toEqual([]);
  await act(async () =>
    thirdOutput.answer([
      {
        id: 'speakers',
        name: 'Speakers',
        guid: '{SPEAKERS}',
        isDefault: true,
        isActive: true,
      },
    ]),
  );
  expect(cards()).toEqual(['Speakers', 'Headphones']);
});
