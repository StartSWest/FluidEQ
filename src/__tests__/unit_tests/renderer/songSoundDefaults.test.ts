/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

/**
 * The window's view of the song memory, which the core runs
 * (`main/songMemory.ts`): its switch as the core says it, shown at once when
 * pressed, and the switch an older window kept handed over once.
 */
import { getInitialSongSoundState } from 'common/songSoundRecorder';
import { SONG_MEMORY_CHANNEL } from 'common/songMemoryStatus';
import {
  followSongMemory,
  isSongSoundOn,
  resetSongSoundSession,
  setSongSoundOn,
} from 'renderer/audio/songSoundSession';

type TListener = (...args: unknown[]) => void;
const sendMessage = jest.fn();
let pushes: Map<string, TListener>;

const bridge = (withCore = true) =>
  Object.defineProperty(window, 'electron', {
    configurable: true,
    value: withCore
      ? {
          ipcRenderer: {
            sendMessage,
            on: (channel: string, listener: TListener) => {
              pushes.set(channel, listener);
              return () => pushes.delete(channel);
            },
          },
        }
      : {},
  });

beforeEach(() => {
  localStorage.clear();
  sendMessage.mockClear();
  pushes = new Map();
  bridge();
  resetSongSoundSession();
});

afterEach(() => {
  Reflect.deleteProperty(window, 'electron');
  resetSongSoundSession();
});

const sent = (channel: string) =>
  sendMessage.mock.calls
    .filter(([name]) => name === channel)
    .map(([, args]) => args);

it('starts off until the core says otherwise', () => {
  expect(getInitialSongSoundState().isOn).toBe(false);
  expect(isSongSoundOn()).toBe(false);
});

it('shows the switch the core says, and asks for it once it follows', () => {
  const stop = followSongMemory();
  expect(sent(SONG_MEMORY_CHANNEL.ask)).toHaveLength(1);
  pushes.get(SONG_MEMORY_CHANNEL.status)?.({ isOn: true, needsClock: false });
  expect(isSongSoundOn()).toBe(true);
  stop();
});

it('shows a press at once and asks the core to keep it', () => {
  setSongSoundOn(true);
  expect(isSongSoundOn()).toBe(true);
  expect(sent(SONG_MEMORY_CHANNEL.action)).toEqual([
    [{ kind: 'setOn', isOn: true }],
  ]);
});

it.each(['true', 'false'])(
  'hands the switch an older window kept (%s) to the core once, and forgets it',
  (saved) => {
    localStorage.setItem('fluideq.songSound', saved);
    followSongMemory()();
    expect(sent(SONG_MEMORY_CHANNEL.handOver)).toEqual([[saved === 'true']]);
    expect(localStorage.getItem('fluideq.songSound')).toBeNull();
    followSongMemory()();
    expect(sent(SONG_MEMORY_CHANNEL.handOver)).toHaveLength(1);
  },
);

it('keeps the old switch where there is no core to take it', () => {
  localStorage.setItem('fluideq.songSound', 'true');
  bridge(false);
  followSongMemory()();
  expect(localStorage.getItem('fluideq.songSound')).toBe('true');
});
