/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Every page that names an output used to ask main for the whole list each
 * time it opened — one more PowerShell run per visit, for the list the output
 * panel had just read. `readKnownAudioDevices` hands out the list the window
 * already holds and asks again only after something says the outputs may
 * have moved. Each case below has its control: the same read without the
 * event goes to the kept list, and with it goes to main.
 */

import type { IAudioDevice } from 'common/constants';

const mockSend = jest.fn();
jest.mock('renderer/utils/ipcRequest', () => ({
  ...jest.requireActual('renderer/utils/ipcRequest'),
  sendRequest: () => mockSend(),
}));

// eslint-disable-next-line import/first
import {
  getAudioDevices,
  readKnownAudioDevices,
} from 'renderer/utils/equalizerApi';

const speakers: IAudioDevice = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{aaaa}',
  isDefault: true,
  isActive: true,
  isEqualizerApoAttached: false,
};

beforeEach(async () => {
  mockSend.mockReset();
  mockSend.mockResolvedValue([speakers]);
  // Every case starts from a list read fresh, and from a clean count.
  await getAudioDevices();
  mockSend.mockClear();
});

it('hands out the list the window already holds', async () => {
  await expect(readKnownAudioDevices()).resolves.toEqual([speakers]);
  await expect(readKnownAudioDevices()).resolves.toEqual([speakers]);

  expect(mockSend).not.toHaveBeenCalled();
});

it.each([
  [
    'an output change is announced',
    () => window.dispatchEvent(new CustomEvent('fluideq-output-changed')),
  ],
  [
    'the window is come back to',
    () => window.dispatchEvent(new Event('focus')),
  ],
  [
    'the window is shown again',
    () => document.dispatchEvent(new Event('visibilitychange')),
  ],
])('asks main again once %s', async (_when, happen) => {
  await readKnownAudioDevices();
  expect(mockSend).not.toHaveBeenCalled();

  happen();
  await readKnownAudioDevices();

  expect(mockSend).toHaveBeenCalledTimes(1);
});

it('keeps what the output panel read last', async () => {
  const headphones = { ...speakers, id: 'headphones', guid: '{bbbb}' };
  mockSend.mockResolvedValue([headphones]);

  await getAudioDevices();

  await expect(readKnownAudioDevices()).resolves.toEqual([headphones]);
  expect(mockSend).toHaveBeenCalledTimes(1);
});
