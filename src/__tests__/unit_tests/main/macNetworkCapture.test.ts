/** @jest-environment node */
import { startMacNetworkCapture } from 'main/macEngine/macNetworkCapture';
import { leaseLanAudioHelper, type ILanAudioClient } from 'main/lanAudioHelper';

jest.mock('main/lanAudioHelper', () => ({ leaseLanAudioHelper: jest.fn() }));
jest.mock('electron-log', () => ({ warn: jest.fn() }));

let client: ILanAudioClient;
const request = jest.fn();
const release = jest.fn();
beforeEach(() => {
  jest.clearAllMocks();
  request.mockReset().mockImplementation(() => ({
    id: 7,
    answered: Promise.resolve(),
  }));
  jest.mocked(leaseLanAudioHelper).mockImplementation(async (listener) => {
    client = listener;
    return { request, release, send: jest.fn(), version: 0 };
  });
});

it('sends bounded native PCM, ignoring playback meters and other control replies', async () => {
  const audio = jest.fn();
  const failed = jest.fn();
  const capture = await startMacNetworkCapture(audio, failed);
  expect(request).toHaveBeenCalledWith(8, Buffer.from('lan'));
  const pcm = Buffer.alloc(8);
  pcm.writeFloatLE(0.25);
  pcm.writeFloatLE(-0.5, 4);
  client.reply?.({
    kind: 10,
    id: 42,
    rate: 48_000,
    channels: 2,
    frames: 1,
    payload: pcm,
  });
  expect(audio).toHaveBeenCalledWith({
    channels: 2,
    frames: 1,
    sampleRate: 48_000,
    sequence: 42,
    peerId: '',
    pcm: Uint8Array.from(pcm).buffer,
  });
  client.reply?.({
    kind: 5,
    id: 1,
    rate: 48_000,
    frames: 0,
    payload: Buffer.alloc(24),
  });
  expect(audio).toHaveBeenCalledTimes(1);
  expect(failed).not.toHaveBeenCalled();
  capture.close();
  await Promise.resolve();
  await Promise.resolve();
  expect(request).toHaveBeenLastCalledWith(9);
  expect(release).toHaveBeenCalledTimes(1);
  capture.close();
  client.reply?.({
    kind: 10,
    id: 43,
    rate: 48_000,
    channels: 2,
    frames: 1,
    payload: pcm,
  });
  expect(audio).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
});

it('refuses an unopened tap and releases its helper lease', async () => {
  request.mockReturnValueOnce({
    id: 7,
    answered: Promise.reject(new Error('permission refused')),
  });
  const failed = jest.fn();
  await expect(startMacNetworkCapture(jest.fn(), failed)).rejects.toThrow(
    'permission refused',
  );
  expect(release).toHaveBeenCalledTimes(1);
  expect(failed).not.toHaveBeenCalled();
});

it('reports only its own capture ending, without closing a live playback lease', async () => {
  const failed = jest.fn();
  const capture = await startMacNetworkCapture(jest.fn(), failed);
  client.reply?.({
    kind: 9,
    id: 8,
    rate: 0,
    frames: 0,
    payload: Buffer.alloc(0),
  });
  expect(failed).not.toHaveBeenCalled();
  client.reply?.({
    kind: 9,
    id: 7,
    rate: 0,
    frames: 0,
    payload: Buffer.alloc(0),
  });
  expect(failed).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
  capture.close();
  client.stopped(new Error('pipe closed'));
  expect(failed).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
});

it('reports a helper crash once and leaves reopening to the shared session owner', async () => {
  const failed = jest.fn();
  await startMacNetworkCapture(jest.fn(), failed);
  client.stopped(new Error('pipe closed'));
  client.stopped(new Error('late close'));
  expect(failed).toHaveBeenCalledTimes(1);
  expect(release).toHaveBeenCalledTimes(1);
});

it('rejects a helper that stops before its capture request answers', async () => {
  let answer: () => void = () => undefined;
  request.mockReturnValueOnce({
    id: 7,
    answered: new Promise<void>((resolve) => {
      answer = resolve;
    }),
  });
  const starting = startMacNetworkCapture(jest.fn(), jest.fn());
  await Promise.resolve();
  client.stopped(new Error('pipe closed'));
  answer();
  await expect(starting).rejects.toThrow('stopped while opening');
  expect(release).toHaveBeenCalled();
});
