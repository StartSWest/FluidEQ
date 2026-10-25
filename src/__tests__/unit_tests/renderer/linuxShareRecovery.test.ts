/* FluidEQ — GPL-3.0-or-later */
import type { IAudioDevice } from '../../../common/constants';

let mockListener: ((reading: Promise<IAudioDevice[]>) => void) | undefined;
const mockStop = jest.fn();
const mockSubscribe = jest.fn((listener: typeof mockListener) => {
  mockListener = listener;
  return mockStop;
});
jest.mock('../../../renderer/utils/equalizerApi', () => ({
  subscribeAudioDevices: (listener: typeof mockListener) =>
    mockSubscribe(listener),
}));

// eslint-disable-next-line import/first -- install the native-device notification boundary first
import subscribeLinuxShareRecovery from '../../../renderer/remoteAudio/linuxShareRecovery';

const original = window.electron;
afterEach(() =>
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: original,
  }),
);
beforeEach(() => {
  jest.clearAllMocks();
  mockListener = undefined;
});
const platform = (value: string) =>
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: { platform: value },
  });

it('reopens Linux audio on a successful native device notification, and removes the subscription', async () => {
  platform('linux');
  const recover = jest.fn();
  const stop = subscribeLinuxShareRecovery(recover);
  mockListener?.(Promise.resolve([]));
  await Promise.resolve();
  expect(recover).toHaveBeenCalledTimes(1);
  stop();
  expect(mockStop).toHaveBeenCalledTimes(1);
});

it('drops a device reading resolved after unsubscribe', async () => {
  platform('linux');
  let answer: (value: IAudioDevice[]) => void = () => undefined;
  const reading = new Promise<IAudioDevice[]>((resolve) => {
    answer = resolve;
  });
  const recover = jest.fn();
  const stop = subscribeLinuxShareRecovery(recover);
  mockListener?.(reading);
  stop();
  answer([]);
  await reading;
  expect(recover).not.toHaveBeenCalled();
});

it('preserves the Windows recovery path without another device subscription', () => {
  platform('win32');
  const recover = jest.fn();
  subscribeLinuxShareRecovery(recover)();
  expect(mockSubscribe).not.toHaveBeenCalled();
  expect(recover).not.toHaveBeenCalled();
});
