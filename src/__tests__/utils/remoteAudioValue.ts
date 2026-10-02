/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type {
  IRemoteAudioLink,
  IRemoteAudioValue,
} from '../../renderer/remoteAudio/remoteAudioState';

/** A linked computer as the page draws it: both switches on, both ways
 * announced, nothing arriving yet. */
export const remoteAudioLink = (
  overrides: Partial<IRemoteAudioLink> = {},
): IRemoteAudioLink => ({
  id: 'peer-1',
  name: 'SWEST-YOGA',
  address: '192.168.1.40',
  joined: false,
  theirs: { sends: true, plays: true },
  switches: { send: true, play: true },
  receiving: false,
  ...overrides,
});

/** Share Audio's value with no link and its code on screen, as the page
 * opens; every action a mock. */
export const remoteAudioValue = (
  overrides: Partial<IRemoteAudioValue> = {},
): IRemoteAudioValue => ({
  bothWays: true,
  deviceName: 'SWEST-GAMING',
  lanOptions: [],
  links: [],
  networkStats: [],
  phase: 'waiting',
  role: 'listener',
  sending: false,
  sendingFailed: false,
  showCode: jest.fn(() => Promise.resolve()),
  link: jest.fn(() => Promise.resolve()),
  unlink: jest.fn(() => Promise.resolve()),
  setSwitches: jest.fn(() => Promise.resolve()),
  resumePlayback: jest.fn(() => Promise.resolve()),
  subscribeMeter: jest.fn(() => jest.fn()),
  ...overrides,
});
