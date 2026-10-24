/* FluidEQ — GPL-3.0-or-later */
import { act, renderHook } from '@testing-library/react';
import type { ILanRemoteAudioChunk } from 'common/remoteAudio';
import type { ICaptureGraph } from 'renderer/graph/useLiveOutputSpectrum';
import useRemoteAudioPcmSender from 'renderer/remoteAudio/useRemoteAudioPcmSender';

const mockCaptureState = {
  capture: undefined as ICaptureGraph | undefined,
  error: '',
};
const mockClose = jest.fn();
const mockCreateSender = jest.fn();
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioControl: () => mockCaptureState,
  useLiveAudioCapture: () => undefined,
}));
jest.mock('renderer/remoteAudio/pcmSender', () => ({
  createPcmSender: (...args: unknown[]) => mockCreateSender(...args),
}));

const onSending = jest.fn();
const onFailure = jest.fn();
const publishMeter = jest.fn();
const sendRemoteAudioLanAudio = jest.fn();
const chunk: Omit<ILanRemoteAudioChunk, 'peerId'> = {
  channels: 2,
  frames: 1,
  pcm: new Float32Array([0.1, -0.1]).buffer,
  sequence: 0,
  sampleRate: 48000,
};
const props = { peerIds: ['desk'], onSending, onFailure, publishMeter };
const settle = () => act(async () => undefined);

beforeEach(() => {
  jest.clearAllMocks();
  mockCaptureState.capture = undefined;
  mockCaptureState.error = '';
  mockCreateSender.mockResolvedValue({ close: mockClose });
  Object.assign(window, {
    electron: { platform: 'linux', ipcRenderer: { sendRemoteAudioLanAudio } },
  });
});

it('reports a refused live capture on Share Audio instead of waiting silently', () => {
  mockCaptureState.error = 'System capture was refused';
  renderHook(() => useRemoteAudioPcmSender(props));
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(mockCreateSender).not.toHaveBeenCalled();
  expect(onSending).not.toHaveBeenCalledWith(true);
});

it('reports actual sending, keeps one capture as peers change, and stops on release', async () => {
  mockCaptureState.capture = {} as ICaptureGraph;
  const { rerender, unmount } = renderHook(
    (peerIds) => useRemoteAudioPcmSender({ ...props, peerIds }),
    { initialProps: ['desk'] },
  );
  await settle();
  const send = mockCreateSender.mock.calls[0][1] as (
    value: typeof chunk,
  ) => void;
  expect(onSending).not.toHaveBeenCalledWith(true);
  act(() => send(chunk));
  expect(onSending).toHaveBeenCalledWith(true);
  expect(sendRemoteAudioLanAudio).toHaveBeenLastCalledWith({
    peerId: 'desk',
    ...chunk,
  });
  rerender(['laptop']);
  act(() => send(chunk));
  expect(mockCreateSender).toHaveBeenCalledTimes(1);
  expect(sendRemoteAudioLanAudio).toHaveBeenLastCalledWith({
    peerId: 'laptop',
    ...chunk,
  });
  expect(
    onSending.mock.calls.filter(([active]) => active === true),
  ).toHaveLength(1);
  unmount();
  expect(mockClose).toHaveBeenCalledTimes(1);
  expect(onSending).toHaveBeenLastCalledWith(false);
  sendRemoteAudioLanAudio.mockClear();
  send(chunk);
  expect(sendRemoteAudioLanAudio).not.toHaveBeenCalled();
});

it('reports a worklet start failure without leaving the sending state on', async () => {
  mockCaptureState.capture = {} as ICaptureGraph;
  mockCreateSender.mockRejectedValue(new Error('worklet failed'));
  renderHook(() => useRemoteAudioPcmSender(props));
  await settle();
  expect(onFailure).toHaveBeenCalledTimes(1);
  expect(onSending).toHaveBeenLastCalledWith(false);
});
