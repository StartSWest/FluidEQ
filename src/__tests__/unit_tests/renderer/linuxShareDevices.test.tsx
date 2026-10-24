/* FluidEQ — GPL-3.0-or-later */
import { act, renderHook } from '@testing-library/react';
import { subscribeAudioDevices } from '../../../renderer/utils/equalizerApi';
import useLinuxShareDevices from '../../../renderer/remoteAudio/useLinuxShareDevices';
import type { IAudioDevice } from '../../../common/profileTypes';

jest.mock('../../../renderer/utils/equalizerApi', () => ({
  subscribeAudioDevices: jest.fn(),
}));

const originalBridge = Object.getOwnPropertyDescriptor(window, 'electron');
const originalMedia = Object.getOwnPropertyDescriptor(
  navigator,
  'mediaDevices',
);
afterEach(() => {
  if (originalBridge) {
    Object.defineProperty(window, 'electron', originalBridge);
  }
  if (originalMedia) {
    Object.defineProperty(navigator, 'mediaDevices', originalMedia);
  }
  jest.clearAllMocks();
});

it('discovers Linux share devices on the native notification without a Chromium devicechange', async () => {
  let devices: Partial<MediaDeviceInfo>[] = [];
  const enumerateDevices = jest.fn(async () => devices);
  const removeEventListener = jest.fn();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { platform: 'linux' },
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      enumerateDevices,
      addEventListener: jest.fn(),
      removeEventListener,
    },
  });
  let nativeChanged: ((reading: Promise<IAudioDevice[]>) => void) | undefined;
  const unsubscribe = jest.fn();
  (subscribeAudioDevices as jest.Mock).mockImplementation((listener) => {
    nativeChanged = listener;
    return unsubscribe;
  });
  const hook = renderHook(useLinuxShareDevices);
  await act(async () => {
    await Promise.resolve();
  });
  expect(hook.result.current).toEqual({});
  devices = [
    { kind: 'audioinput', label: 'FluidEQ Send', deviceId: 'send-device' },
    {
      kind: 'audiooutput',
      label: 'FluidEQ Share In',
      deviceId: 'share-device',
    },
  ];
  await act(async () => {
    nativeChanged?.(Promise.resolve([]));
  });
  expect(hook.result.current).toEqual({
    sendInputId: 'send-device',
    shareOutputId: 'share-device',
  });
  expect(enumerateDevices).toHaveBeenCalledTimes(2);
  hook.unmount();
  expect(unsubscribe).toHaveBeenCalledTimes(1);
  expect(removeEventListener).toHaveBeenCalledWith(
    'devicechange',
    expect.any(Function),
  );
});

it('does not start Linux device discovery on Windows', () => {
  const enumerateDevices = jest.fn();
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { platform: 'win32' },
  });
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: { enumerateDevices },
  });
  const hook = renderHook(useLinuxShareDevices);
  expect(hook.result.current).toEqual({});
  expect(enumerateDevices).not.toHaveBeenCalled();
  expect(subscribeAudioDevices).not.toHaveBeenCalled();
  hook.unmount();
});
