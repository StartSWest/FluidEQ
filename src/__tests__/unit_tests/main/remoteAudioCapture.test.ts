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
import {
  startRemoteAudioCapture,
  startNativeOutputMirror,
} from '../../../main/remoteAudioCapture';

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
    stdin: EventEmitter & { write: jest.Mock; writableLength: number };
    stdout: EventEmitter;
  };
  child.kill = jest.fn();
  child.stderr = new EventEmitter();
  child.stdin = Object.assign(new EventEmitter(), {
    write: jest.fn(),
    writableLength: 0,
  });
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

  it('reports the native activation deadline when the helper cannot become ready', async () => {
    const child = fakeChild();
    mockSpawn.mockReturnValue(child);
    const starting = startRemoteAudioCapture('source-pc', jest.fn(), jest.fn());
    // The helper owns the WASAPI activation deadline; its failure must reach
    // the caller even though no ready frame was ever written.
    child.stderr.emit('data', Buffer.from('WASAPI activation timed out'));
    child.emit('close', 1);

    await expect(starting).rejects.toThrow('timed out');
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('shares one excluded process across LAN listeners and releases only the closing listener', async () => {
    const child = fakeChild();
    mockSpawn.mockReturnValue(child);
    const firstAudio = jest.fn();
    const secondAudio = jest.fn();
    const first = startRemoteAudioCapture('first', firstAudio, jest.fn());
    const second = startRemoteAudioCapture('second', secondAudio, jest.fn());
    child.stdout.emit('data', frame(1, Buffer.alloc(0)));
    const [a, b] = await Promise.all([first, second]);
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const pcm = Buffer.from(new Float32Array([0.25, -0.5]).buffer);
    child.stdout.emit('data', frame(2, pcm));
    expect(firstAudio.mock.calls[0][0].peerId).toBe('first');
    expect(secondAudio.mock.calls[0][0].peerId).toBe('second');
    a.close();
    expect(child.kill).not.toHaveBeenCalled();
    child.stdout.emit('data', frame(2, pcm));
    expect(firstAudio).toHaveBeenCalledTimes(1);
    expect(secondAudio).toHaveBeenCalledTimes(2);
    b.close();
    b.close();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it('starts, updates and stops a GUID mirror without stopping the shared LAN capture', async () => {
    const child = fakeChild();
    mockSpawn.mockReturnValue(child);
    const lanStart = startRemoteAudioCapture('source', jest.fn(), jest.fn());
    child.stdout.emit('data', frame(1, Buffer.alloc(0)));
    const lan = await lanStart;
    const guid = '{12345678-1234-1234-1234-123456789abc}';
    const acknowledge = async (verb: string) => {
      await Promise.resolve();
      const { calls } = child.stdin.write.mock;
      const command = calls[calls.length - 1]?.[0] as string;
      const [kind, requestId] = command.trim().split(' ');
      expect(kind).toBe(verb);
      child.stdout.emit(
        'data',
        frame(3, Buffer.alloc(0), Number(requestId), 0, 0, 0),
      );
      return command;
    };
    const starting = startNativeOutputMirror(guid, 'video', 0.7, jest.fn());
    expect(await acknowledge('start')).toContain(`${guid} video 0.7`);
    const mirror = await starting;
    expect(mockSpawn).toHaveBeenCalledTimes(1);
    const changing = mirror.setVolume(0.4);
    expect(await acknowledge('volume')).toMatch(/ 0.4\n$/);
    await changing;
    const stopping = mirror.close();
    expect(mirror.close()).toBe(stopping);
    await acknowledge('stop');
    await stopping;
    expect(child.kill).not.toHaveBeenCalled();
    lan.close();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });
});
