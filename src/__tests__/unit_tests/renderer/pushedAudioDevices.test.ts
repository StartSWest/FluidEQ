/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The output list main pushes when Windows says the outputs moved
 * (`outputWatch.ts`). It is what the output panel used to poll for, so the
 * window's kept list takes it as it takes a list it asked for: every page
 * that names an output then reads it without asking main again.
 */

import ChannelEnum from 'common/channels';
import { ErrorCode } from 'common/errors';
import type { IAudioDevice } from 'common/constants';
import installFakeIpcRenderer from '__tests__/utils/fakeIpcRenderer';
import {
  readKnownAudioDevices,
  subscribeAudioDevices,
} from 'renderer/utils/equalizerApi';

const speakers: IAudioDevice = {
  id: 'speakers',
  name: 'Speakers',
  guid: '{aaaa}',
  isDefault: true,
  isActive: true,
};
const headset: IAudioDevice = { ...speakers, id: 'headset', guid: '{bbbb}' };

it('hands the pushed list on, and keeps it for every reader after', async () => {
  const ipc = installFakeIpcRenderer();
  const readings: Promise<IAudioDevice[]>[] = [];
  const stop = subscribeAudioDevices((reading) => readings.push(reading));

  ipc.reply(ChannelEnum.AUDIO_DEVICES_CHANGED, { result: [headset] });

  expect(readings).toHaveLength(1);
  await expect(readings[0]).resolves.toEqual([headset]);
  await expect(readKnownAudioDevices()).resolves.toEqual([headset]);
  expect(ipc.sentOn(ChannelEnum.GET_AUDIO_DEVICES)).toHaveLength(0);
  stop();
});

it('passes a refusal on as the error a request would have had, keeping the old list', async () => {
  const ipc = installFakeIpcRenderer();
  const readings: Promise<IAudioDevice[]>[] = [];
  const stop = subscribeAudioDevices((reading) => readings.push(reading));
  ipc.reply(ChannelEnum.AUDIO_DEVICES_CHANGED, { result: [speakers] });
  await readings[0];

  ipc.reply(ChannelEnum.AUDIO_DEVICES_CHANGED, {
    errorCode: ErrorCode.FAILURE,
    detail: 'cannot adopt',
  });

  await expect(readings[1]).rejects.toMatchObject({
    shortError: 'cannot adopt',
    code: ErrorCode.FAILURE,
  });
  await expect(readKnownAudioDevices()).resolves.toEqual([speakers]);
  stop();
});

it('ignores what is not an answer about the outputs, and stops when told', () => {
  const ipc = installFakeIpcRenderer();
  const listener = jest.fn();
  const stop = subscribeAudioDevices(listener);

  ipc.reply(ChannelEnum.AUDIO_DEVICES_CHANGED, { result: 'speakers' });
  ipc.reply(ChannelEnum.AUDIO_DEVICES_CHANGED, undefined);
  expect(listener).not.toHaveBeenCalled();

  // Positive control: a real answer reaches it, until it stops listening.
  ipc.reply(ChannelEnum.AUDIO_DEVICES_CHANGED, { result: [speakers] });
  expect(listener).toHaveBeenCalledTimes(1);
  stop();
  ipc.reply(ChannelEnum.AUDIO_DEVICES_CHANGED, { result: [speakers] });
  expect(listener).toHaveBeenCalledTimes(1);
  expect(ipc.listenerCount(ChannelEnum.AUDIO_DEVICES_CHANGED)).toBe(0);
});
