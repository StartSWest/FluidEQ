/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The live capture on Linux opens the engine's "FluidEQ Monitor" input.
 *
 * Chromium on Linux has no loopback, so `getDisplayMedia` gave the window no
 * sound and every live display stood still; under Wayland it would also put
 * the desktop's screen picker up. These pin that Linux asks for the monitor
 * by its name, with Chromium's voice processing off, never for a display —
 * and, as the positive control, that Windows still does.
 */

import type { Translate } from 'common/i18n';
import { captureSystemOutput } from 'renderer/graph/liveSpectrumFrames';

const t: Translate = (key) => key;

const input = (label: string, deviceId: string) =>
  ({ kind: 'audioinput', label, deviceId, groupId: '' }) as MediaDeviceInfo;

const stream = {} as MediaStream;
let devices: MediaDeviceInfo[] = [];
const getUserMedia = jest.fn(async () => stream);
const getDisplayMedia = jest.fn(async () => stream);

const onPlatform = (platform: string) => {
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { platform },
  });
};

beforeEach(() => {
  devices = [
    input('Default', 'default'),
    input('Stereo Microphone', 'mic'),
    input('FluidEQ Monitor', 'monitor'),
  ];
  getUserMedia.mockClear();
  getDisplayMedia.mockClear();
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices: async () => devices,
      getUserMedia,
      getDisplayMedia,
    },
  });
});

afterAll(() => {
  Reflect.deleteProperty(window, 'electron');
  Reflect.deleteProperty(navigator, 'mediaDevices');
});

describe('captureSystemOutput on Linux', () => {
  beforeEach(() => onPlatform('linux'));

  it('opens the FluidEQ Monitor, unprocessed, and never a display', async () => {
    await expect(captureSystemOutput(t)).resolves.toBe(stream);
    expect(getDisplayMedia).not.toHaveBeenCalled();
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: {
        deviceId: { exact: 'monitor' },
        autoGainControl: false,
        echoCancellation: false,
        noiseSuppression: false,
      },
      video: false,
    });
  });

  it('says the engine is not running when there is no monitor', async () => {
    devices = devices.filter((device) => device.deviceId !== 'monitor');
    await expect(captureSystemOutput(t)).rejects.toThrow(
      'eq.smart.error.noMonitor',
    );
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(getDisplayMedia).not.toHaveBeenCalled();
  });
});

describe('captureSystemOutput on Windows', () => {
  beforeEach(() => onPlatform('win32'));

  it('still takes the loopback through a display capture', async () => {
    await expect(captureSystemOutput(t)).resolves.toBe(stream);
    expect(getDisplayMedia).toHaveBeenCalledTimes(1);
    expect(getUserMedia).not.toHaveBeenCalled();
  });
});
