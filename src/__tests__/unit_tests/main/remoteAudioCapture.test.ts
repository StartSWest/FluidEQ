/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

import { EventEmitter } from 'events';

const mockSpawn = jest.fn();

jest.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
}));
jest.mock('../../../main/remoteAudioCapturePath', () => ({
  findRemoteAudioCaptureExecutable: () => 'FluidEQ-LAN-Capture.exe',
}));

// eslint-disable-next-line import/first
import { startRemoteAudioCapture } from '../../../main/remoteAudioCapture';

const MAGIC = 0x314e414c;

const frame = (
  kind: number,
  payload: Buffer,
  sequence = 0,
  sampleRate = 48_000,
  channels = 2,
  frames = payload.byteLength / channels / 4,
) => {
  const header = Buffer.alloc(24);
  header.writeUInt32LE(MAGIC, 0);
  header.writeUInt32LE(kind, 4);
  header.writeUInt32LE(sequence, 8);
  header.writeUInt32LE(sampleRate, 12);
  header.writeUInt16LE(channels, 16);
  header.writeUInt16LE(frames, 18);
  header.writeUInt32LE(payload.byteLength, 20);
  return Buffer.concat([header, payload]);
};

const fakeChild = () => {
  const child = new EventEmitter() as EventEmitter & {
    kill: jest.Mock;
    stderr: EventEmitter;
    stdin: { end: jest.Mock };
    stdout: EventEmitter;
  };
  child.kill = jest.fn();
  child.stderr = new EventEmitter();
  child.stdin = { end: jest.fn() };
  child.stdout = new EventEmitter();
  return child;
};

describe('native lossless LAN capture bridge', () => {
  beforeEach(() => mockSpawn.mockReset());

  it('forwards framed Float32 samples without changing any byte', async () => {
    const child = fakeChild();
    mockSpawn.mockReturnValue(child);
    const onAudio = jest.fn();
    const starting = startRemoteAudioCapture('source-pc', onAudio, jest.fn());
    child.stdout.emit('data', frame(1, Buffer.alloc(0)));
    const capture = await starting;

    const pcm = Buffer.from(new Float32Array([0, -0, 0.5, -0.25]).buffer);
    const audio = frame(2, pcm, 42);
    child.stdout.emit('data', audio.subarray(0, 29));
    child.stdout.emit('data', audio.subarray(29));

    expect(onAudio).toHaveBeenCalledTimes(1);
    expect(onAudio.mock.calls[0][0]).toMatchObject({
      channels: 2,
      frames: 2,
      peerId: 'source-pc',
      sampleRate: 48_000,
      sequence: 42,
    });
    expect(Buffer.from(onAudio.mock.calls[0][0].pcm)).toEqual(pcm);
    capture.close();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('refuses malformed helper frames before the session starts', async () => {
    const child = fakeChild();
    mockSpawn.mockReturnValue(child);
    const starting = startRemoteAudioCapture('source-pc', jest.fn(), jest.fn());
    const malformed = frame(1, Buffer.alloc(0));
    malformed.writeUInt32LE(0, 0);
    child.stdout.emit('data', malformed);

    await expect(starting).rejects.toThrow('invalid frame');
    expect(child.kill).toHaveBeenCalledTimes(1);
  });
});
