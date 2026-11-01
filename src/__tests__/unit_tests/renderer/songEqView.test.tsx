/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's view of the Smart EQ song memory the core runs: it asks once
 * and is then told, draws only what is a status, sends each button as the
 * core reads it, and says time passed only while the core asks it to.
 */
import { act, renderHook } from '@testing-library/react';
import { SONG_EQ_CHANNEL } from 'common/songEqStatus';
import {
  endSongEqNotice,
  forgetCurrentSongEq,
  setSongEqSaveOn,
  undoSongEqLoan,
  useSongEqClock,
  useSongEqRecording,
} from 'renderer/audio/songEqSession';
import {
  resetTransportSource,
  setTransportSource,
} from 'renderer/audio/transportSource';
import installFakeIpcRenderer from '__tests__/utils/fakeIpcRenderer';

const STATUS = {
  isSaveOn: true,
  listenedMs: 61_000,
  title: 'Song',
  willSave: false,
  needsClock: false,
};

const report = (positionMs: number) =>
  act(() =>
    setTransportSource({
      owner: 'library',
      title: 'Playing',
      isPlaying: true,
      positionMs,
      durationMs: 200_000,
      toggle: () => undefined,
    }),
  );

const setUp = () => {
  const bridge = installFakeIpcRenderer();
  const view = renderHook(() => {
    useSongEqClock();
    return useSongEqRecording();
  });
  const sentOn = (channel: string) =>
    bridge.sent.filter((message) => message.channel === channel);
  return { bridge, view, sentOn };
};

beforeEach(() => resetTransportSource());

it('asks once, then draws what the core says, and only what is a status', () => {
  const { bridge, view, sentOn } = setUp();
  expect(sentOn(SONG_EQ_CHANNEL.ask)).toHaveLength(1);
  act(() => bridge.reply(SONG_EQ_CHANNEL.status, STATUS));
  expect(view.result.current).toEqual(STATUS);
  act(() =>
    bridge.reply(SONG_EQ_CHANNEL.status, { ...STATUS, isSaveOn: 'yes' }),
  );
  act(() => bridge.reply(SONG_EQ_CHANNEL.status, null));
  expect(view.result.current).toEqual(STATUS);
});

it('sends each button as the core reads it', () => {
  const { sentOn } = setUp();
  setSongEqSaveOn(true);
  undoSongEqLoan();
  forgetCurrentSongEq();
  endSongEqNotice(3);
  expect(sentOn(SONG_EQ_CHANNEL.action).map(({ args }) => args[0])).toEqual([
    { kind: 'setSaveOn', isSaveOn: true },
    { kind: 'undo' },
    { kind: 'forget' },
    { kind: 'endNotice', id: 3 },
  ]);
});

it('says time passed for the players only while the core asks', () => {
  const { bridge, sentOn } = setUp();
  act(() => bridge.reply(SONG_EQ_CHANNEL.status, STATUS));
  report(1000);
  report(2000);
  expect(sentOn(SONG_EQ_CHANNEL.tick)).toHaveLength(0);
  // POSITIVE CONTROL: asked, each position a player reports is time passing.
  act(() =>
    bridge.reply(SONG_EQ_CHANNEL.status, { ...STATUS, needsClock: true }),
  );
  const asked = sentOn(SONG_EQ_CHANNEL.tick).length;
  report(3000);
  report(4000);
  expect(sentOn(SONG_EQ_CHANNEL.tick).length - asked).toBe(2);
});
