/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The second output's list follows main on Windows, never Chromium.
 *
 * Merely listening for `devicechange` starts Chromium's audio service and its
 * 66 MB video capture service and keeps them running, and on Windows the
 * mirror plays through the native helper and main pushes every output change
 * itself. Elsewhere the mirror plays through Chromium's own outputs, and that
 * listener is how a headset plugged in reaches it: the control.
 */
import { renderHook } from '@testing-library/react';
import useOutputMirror from 'renderer/audio/useOutputMirror';

jest.mock('renderer/utils/equalizerApi', () => ({
  getAudioDevices: () => Promise.resolve([]),
  readKnownAudioDevices: () => Promise.resolve([]),
  getDeviceProfileSettings: () => Promise.resolve(undefined),
  subscribeAudioDevices: () => () => undefined,
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: () => undefined,
  useLiveAudioControl: () => ({ capture: undefined }),
}));
jest.mock('renderer/audio/useMirrorPlayback', () => ({
  useMirrorPlayback: () => ({ runningGuids: [], delays: {}, delayKinds: {} }),
}));
jest.mock('renderer/utils/I18nContext', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const devices = Object.assign(new EventTarget(), {
  enumerateDevices: () => Promise.resolve([]),
});

beforeAll(() => {
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: devices,
  });
});

afterAll(() => {
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

const deviceChangeListenersOn = (platform: string) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { platform },
  });
  const added = jest.spyOn(devices, 'addEventListener');
  try {
    const { unmount } = renderHook(() => useOutputMirror());
    const count = added.mock.calls.filter(
      ([type]) => type === 'devicechange',
    ).length;
    unmount();
    return count;
  } finally {
    added.mockRestore();
    Reflect.deleteProperty(window, 'electron');
  }
};

it('never listens for Chromium’s device changes on Windows', () => {
  expect(deviceChangeListenersOn('win32')).toBe(0);
  expect(deviceChangeListenersOn('linux')).toBe(1);
});
