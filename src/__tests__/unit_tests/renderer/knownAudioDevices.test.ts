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

// jsdom has no media devices; the window's own is an event target that says
// `devicechange` when something is plugged in or pulled out.
Object.defineProperty(navigator, 'mediaDevices', {
  configurable: true,
  value: new EventTarget(),
});

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
  [
    'a device is plugged in or pulled out',
    () => navigator.mediaDevices.dispatchEvent(new Event('devicechange')),
  ],
])('asks main again once %s', async (_when, happen) => {
  await readKnownAudioDevices();
  expect(mockSend).not.toHaveBeenCalled();

  happen();
  await readKnownAudioDevices();

  expect(mockSend).toHaveBeenCalledTimes(1);
});

/*
 * Focus does not bubble, but a capturing listener on the window hears every
 * control that takes it: a tab pressed dropped the list, and the page it
 * opened asked main again. The window's own focus is the case above.
 */
it('keeps the list when a control inside the window takes focus', async () => {
  const tab = document.createElement('button');
  document.body.append(tab);
  await readKnownAudioDevices();

  tab.focus();
  await readKnownAudioDevices();

  expect(document.activeElement).toBe(tab);
  expect(mockSend).not.toHaveBeenCalled();
  tab.remove();
});

it('keeps what the output panel read last', async () => {
  const headphones = { ...speakers, id: 'headphones', guid: '{bbbb}' };
  mockSend.mockResolvedValue([headphones]);

  await getAudioDevices();

  await expect(readKnownAudioDevices()).resolves.toEqual([headphones]);
  expect(mockSend).toHaveBeenCalledTimes(1);
});

/*
 * Merely listening for Chromium's `devicechange` starts its audio service and
 * its 66 MB video capture service, and keeps them running. On Windows main
 * hears every output change itself and pushes the list, so the window never
 * listens; anywhere else it still does, and that copy is the control.
 */
describe('where main follows the outputs itself', () => {
  type TEqualizerApi = typeof import('renderer/utils/equalizerApi');

  const freshCopy = (platform: string): TEqualizerApi => {
    Object.defineProperty(window, 'electron', {
      configurable: true,
      value: { platform },
    });
    let api: TEqualizerApi | undefined;
    jest.isolateModules(() => {
      api = jest.requireActual<TEqualizerApi>('renderer/utils/equalizerApi');
    });
    if (!api) {
      throw new Error('equalizerApi did not load');
    }
    return api;
  };

  const deviceChangeListenersAdded = async (platform: string) => {
    const added = jest.spyOn(navigator.mediaDevices, 'addEventListener');
    try {
      const api = freshCopy(platform);
      await api.readKnownAudioDevices();
      return added.mock.calls.filter(([type]) => type === 'devicechange')
        .length;
    } finally {
      added.mockRestore();
      Reflect.deleteProperty(window, 'electron');
    }
  };

  it('never listens for Chromium’s device changes on Windows', async () => {
    await expect(deviceChangeListenersAdded('win32')).resolves.toBe(0);
    await expect(deviceChangeListenersAdded('linux')).resolves.toBe(1);
  });

  it('still asks main again when an output change is announced', async () => {
    const api = freshCopy('win32');
    try {
      await api.getAudioDevices();
      await api.readKnownAudioDevices();
      mockSend.mockClear();

      window.dispatchEvent(new CustomEvent('fluideq-output-changed'));
      await api.readKnownAudioDevices();

      expect(mockSend).toHaveBeenCalledTimes(1);
    } finally {
      Reflect.deleteProperty(window, 'electron');
    }
  });
});
