/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later

@jest-environment node
*/

/**
 * Share Audio's Smooth playback switch (shown as "Fluid"): kept across
 * launches, smooth for every link while it is on here, and for any link
 * whose other end said `music`; and the LAN helper told only when it can
 * hear it, since an unknown command ends it and every capture under it.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';

const mockSend = jest.fn();
let mockVersion: number | undefined = 2;

jest.mock('../../../main/lanAudioHelper', () => ({
  leaseLanAudioHelper: () =>
    Promise.resolve({
      request: () => ({ id: 1, answered: Promise.resolve() }),
      send: (...args: unknown[]) => mockSend(...args),
      release: jest.fn(),
      version: mockVersion,
    }),
  findRemoteAudioPlaybackExecutable: () => 'FluidEQ-LAN-Playback.exe',
}));

/* eslint-disable import/first */
import {
  createSmoothLinks,
  createSmoothSwitch,
} from '../../../main/remoteAudioSmooth';
import { startNativeRemoteAudioPlayback } from '../../../main/nativeRemoteAudioPlayback';
/* eslint-enable import/first */

describe('the switch', () => {
  let userDataDir = '';
  beforeEach(() => {
    userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-smooth-'));
  });
  afterEach(() => fs.rmSync(userDataDir, { recursive: true, force: true }));

  it('starts off and is remembered on the next launch', () => {
    expect(createSmoothSwitch(userDataDir).get()).toBe(false);
    createSmoothSwitch(userDataDir).set(true);
    expect(createSmoothSwitch(userDataDir).get()).toBe(true);
  });

  it('reads a file that is not its own as off', () => {
    fs.writeFileSync(
      path.join(userDataDir, 'remote-audio-smooth.json'),
      '{"smooth":"yes"}',
    );
    expect(createSmoothSwitch(userDataDir).get()).toBe(false);
  });
});

describe('which links play smooth', () => {
  it('is every link while it is on here, and only those asking otherwise', () => {
    const apply = jest.fn();
    const links = createSmoothLinks(apply);
    links.heard('yoga', 'video');
    links.heard('kitchen', 'music');
    expect(apply.mock.calls).toEqual([
      ['yoga', false],
      ['kitchen', true],
    ]);
    apply.mockClear();
    links.setLocal(true);
    expect(apply.mock.calls).toEqual([['yoga', true]]);
    expect(links.smooth('yoga')).toBe(true);
    apply.mockClear();
    links.setLocal(false);
    expect(apply.mock.calls).toEqual([['yoga', false]]);
    expect(links.smooth('kitchen')).toBe(true);
  });

  it('tells a link again only when its answer changes', () => {
    const apply = jest.fn();
    const links = createSmoothLinks(apply);
    links.heard('yoga', 'music');
    links.heard('yoga', 'music');
    links.setLocal(true);
    expect(apply).toHaveBeenCalledTimes(1);
    links.forget('yoga');
    links.heard('yoga', 'music');
    expect(apply).toHaveBeenCalledTimes(2);
  });
});

describe('the LAN helper', () => {
  const chunk = (peerId: string) => ({
    channels: 2,
    frames: 2,
    pcm: new Float32Array([0.1, 0.1, 0.2, 0.2]).buffer,
    peerId,
    sampleRate: 48_000,
    sequence: 1,
  });
  const smoothCommands = () =>
    mockSend.mock.calls
      .map(([packet]) => packet as Buffer)
      .filter((packet) => packet.readUInt32LE(4) === 9)
      .map((packet) => [packet.readUInt32LE(8), packet.readUInt32LE(12)]);

  beforeEach(() => {
    mockSend.mockClear();
    mockVersion = 2;
  });

  it('learns a peer is smooth before its first sound, and each change after', async () => {
    const playback = await startNativeRemoteAudioPlayback(jest.fn(), jest.fn());
    playback.setSmooth('yoga', true);
    expect(smoothCommands()).toEqual([]);
    playback.push(chunk('yoga'));
    expect(smoothCommands()).toEqual([[1, 1]]);
    playback.setSmooth('yoga', true);
    playback.setSmooth('yoga', false);
    expect(smoothCommands()).toEqual([
      [1, 1],
      [1, 0],
    ]);
    // The command goes before the sound it is for.
    const kinds = mockSend.mock.calls.map(([packet]) =>
      (packet as Buffer).readUInt32LE(4),
    );
    expect(kinds.indexOf(9)).toBeLessThan(kinds.indexOf(2));
  });

  it('is never sent to a helper from before smooth playback', async () => {
    mockVersion = 0;
    const playback = await startNativeRemoteAudioPlayback(jest.fn(), jest.fn());
    playback.setSmooth('yoga', true);
    playback.push(chunk('yoga'));
    playback.setSmooth('yoga', false);
    expect(smoothCommands()).toEqual([]);
    expect(mockSend).toHaveBeenCalled();
  });
});
