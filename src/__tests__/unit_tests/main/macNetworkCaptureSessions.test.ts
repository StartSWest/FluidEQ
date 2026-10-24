/** @jest-environment node */
import type { ILanRemoteAudioChunk } from 'common/remoteAudio';
import { startMacNetworkCapture } from 'main/macEngine/macNetworkCapture';
import { startNetworkCapture } from 'main/remoteAudioCapture';
import { startNativeCaptureProcess } from 'main/nativeCaptureProcess';

jest.mock('main/macEngine/macNetworkCapture', () => ({
  startMacNetworkCapture: jest.fn(),
}));
jest.mock('main/nativeCaptureProcess', () => ({
  startNativeCaptureProcess: jest.fn(),
}));

const originalPlatform = process.platform;
beforeAll(() =>
  Object.defineProperty(process, 'platform', { value: 'darwin' }),
);
afterAll(() =>
  Object.defineProperty(process, 'platform', { value: originalPlatform }),
);

it('opens one Mac tap for concurrent links, relays to both, and releases it with the last link', async () => {
  let opened: (process: {
    close: () => void;
    command: () => void;
  }) => void = () => undefined;
  jest.mocked(startMacNetworkCapture).mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        opened = resolve;
      }),
  );
  const firstAudio = jest.fn();
  const secondAudio = jest.fn();
  const firstFailure = jest.fn();
  const secondFailure = jest.fn();
  const first = startNetworkCapture(firstAudio, firstFailure);
  const second = startNetworkCapture(secondAudio, secondFailure);
  expect(startMacNetworkCapture).toHaveBeenCalledTimes(1);
  expect(startNativeCaptureProcess).not.toHaveBeenCalled();
  const close = jest.fn();
  opened({ close, command: jest.fn() });
  const [a, b] = await Promise.all([first, second]);
  const [audio, failed] = jest.mocked(startMacNetworkCapture).mock.calls[0];
  const chunk: ILanRemoteAudioChunk = {
    channels: 2,
    frames: 1,
    pcm: new Float32Array([0.25, -0.5]).buffer,
    peerId: '',
    sampleRate: 48_000,
    sequence: 1,
  };
  audio(chunk);
  expect(firstAudio).toHaveBeenCalledWith(chunk);
  expect(secondAudio).toHaveBeenCalledWith(chunk);
  a.close();
  expect(close).not.toHaveBeenCalled();
  audio({ ...chunk, sequence: 2 });
  expect(firstAudio).toHaveBeenCalledTimes(1);
  expect(secondAudio).toHaveBeenCalledTimes(2);
  failed();
  expect(firstFailure).not.toHaveBeenCalled();
  expect(secondFailure).toHaveBeenCalledTimes(1);
  expect(close).toHaveBeenCalledTimes(1);
  b.close();

  jest
    .mocked(startMacNetworkCapture)
    .mockResolvedValueOnce({ close, command: jest.fn() });
  const reopened = await startNetworkCapture(jest.fn(), jest.fn());
  expect(startMacNetworkCapture).toHaveBeenCalledTimes(2);
  reopened.close();
});
