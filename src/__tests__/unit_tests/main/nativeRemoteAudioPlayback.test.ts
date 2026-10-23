/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * How far behind another computer's sound plays here: what waits in this
 * end's buffer AND what the output device holds. The buffer alone read a
 * few tens of milliseconds short of what anybody could hear.
 */

const mockSend = jest.fn();
let mockReply: (reply: {
  kind: number;
  id: number;
  rate: number;
  frames: number;
  payload: Buffer;
}) => void = () => undefined;

jest.mock('../../../main/lanAudioHelper', () => ({
  leaseLanAudioHelper: (client: { reply: typeof mockReply }) => {
    mockReply = client.reply;
    return Promise.resolve({
      request: () => ({ id: 1, answered: Promise.resolve() }),
      send: (...args: unknown[]) => mockSend(...args),
      release: jest.fn(),
    });
  },
  findRemoteAudioPlaybackExecutable: () => 'FluidEQ-LAN-Playback.exe',
}));

// eslint-disable-next-line import/first
import { startNativeRemoteAudioPlayback } from '../../../main/nativeRemoteAudioPlayback';

const doubles = (...values: number[]) => {
  const payload = Buffer.alloc(values.length * 8);
  values.forEach((value, at) => payload.writeDoubleLE(value, at * 8));
  return payload;
};

const chunk = (peerId: string) => ({
  channels: 2,
  frames: 2,
  pcm: new Float32Array([0.1, 0.1, 0.2, 0.2]).buffer,
  peerId,
  sampleRate: 48_000,
  sequence: 1,
});

describe('the incoming delay', () => {
  it('is the playback buffer and the output device’s own together', async () => {
    const onMeter = jest.fn();
    const playback = await startNativeRemoteAudioPlayback(onMeter, jest.fn());
    playback.push(chunk('yoga'));
    // The device opened holding 20 ms (reply 6), then a meter for peer 1.
    mockReply({
      kind: 6,
      id: 0,
      rate: 48_000,
      frames: 0,
      payload: doubles(20),
    });
    mockReply({
      kind: 5,
      id: 1,
      rate: 48_000,
      frames: 0,
      payload: doubles(100, 0.5, 0.3),
    });
    expect(onMeter).toHaveBeenCalledWith(
      expect.objectContaining({ sourceId: 'yoga', bufferedMs: 120 }),
    );
  });

  it('is the buffer alone until the device has said what it holds', async () => {
    const onMeter = jest.fn();
    const playback = await startNativeRemoteAudioPlayback(onMeter, jest.fn());
    playback.push(chunk('yoga'));
    mockReply({
      kind: 5,
      id: 1,
      rate: 48_000,
      frames: 0,
      payload: doubles(100, 0.5, 0.3),
    });
    expect(onMeter).toHaveBeenCalledWith(
      expect.objectContaining({ bufferedMs: 100 }),
    );
  });

  it('ignores a device figure that is not a length of time', async () => {
    const onMeter = jest.fn();
    const playback = await startNativeRemoteAudioPlayback(onMeter, jest.fn());
    playback.push(chunk('yoga'));
    mockReply({
      kind: 6,
      id: 0,
      rate: 48_000,
      frames: 0,
      payload: doubles(-5),
    });
    mockReply({
      kind: 5,
      id: 1,
      rate: 48_000,
      frames: 0,
      payload: doubles(100, 0.5, 0.3),
    });
    expect(onMeter).toHaveBeenCalledWith(
      expect.objectContaining({ bufferedMs: 100 }),
    );
  });
});
