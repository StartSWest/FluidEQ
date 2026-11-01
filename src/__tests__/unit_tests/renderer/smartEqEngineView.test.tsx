/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The window's Smart EQ host, which measures nothing: it hands the core the
 * settings it measures by and the button, and draws what the core says — a
 * one-shot's answer climbing onto the graph from where the layer was, a
 * running mode's refinement lighting what it moved and kept by the song
 * recorder as its own.
 */
import { act, render, renderHook } from '@testing-library/react';
import type { ISmartEqSettings } from 'common/constants';
import { type ISmartEqWrote, SMART_EQ_CHANNEL } from 'common/smartEqCore';
import SmartEqEngine from 'renderer/SmartEqEngine';
import { noteSmartEqWrite } from 'renderer/audio/songEqSession';
import { flashCorrection } from 'renderer/utils/correctionFlash';
import { planBandReveal } from 'renderer/utils/bandReveal';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import { setSmartEqMode } from 'renderer/utils/smartEqMode';
import { setContinuousEq } from 'renderer/utils/continuousEq';
import {
  cancelSmartEq,
  runSmartEq,
  setSmartEqListening,
  setSmartEqRunning,
  useSmartEqRun,
} from 'renderer/utils/smartEqRun';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import installFakeIpcRenderer from '__tests__/utils/fakeIpcRenderer';

jest.mock('renderer/audio/songEqSession', () => ({
  noteSmartEqWrite: jest.fn(),
}));
jest.mock('renderer/utils/correctionFlash', () => ({
  flashCorrection: jest.fn(),
}));
jest.mock('renderer/utils/bandReveal', () => ({
  planBandReveal: jest.fn(),
  // Every step at once: the pacing is the reveal's own suite.
  revealBands: jest.fn(
    async (
      steps: { id: string; gain: number }[][],
      onStep: (bands: { id: string; gain: number }[]) => void,
    ) => {
      steps.forEach(onStep);
      return true;
    },
  ),
}));

const band = (gain: number) => ({
  id: 'b1',
  frequency: 1000,
  gain,
  quality: 1,
  type: 'PK',
});
const FROM = { filters: { b1: band(0) } } as unknown as ISmartEqSettings;
const LAYER = { filters: { b1: band(4) } } as unknown as ISmartEqSettings;

const setUp = () => {
  const bridge = installFakeIpcRenderer();
  const setSmartEq = jest.fn();
  render(
    <FluidEqProviderWrapper
      value={{
        ...defaultFluidEqContext,
        setSmartEq,
        getBandSetGeneration: () => 1,
      }}
    >
      <SmartEqEngine />
    </FluidEqProviderWrapper>,
  );
  const sentOn = (channel: string) =>
    bridge.sent.filter((message) => message.channel === channel);
  const lastSettings = () => {
    const settings = sentOn(SMART_EQ_CHANNEL.settings);
    return settings[settings.length - 1]?.args[0];
  };
  const push = (channel: string, payload: unknown) =>
    act(async () => {
      bridge.reply(channel, payload);
    });
  return { bridge, setSmartEq, sentOn, lastSettings, push };
};

beforeEach(() => {
  jest.clearAllMocks();
  setSmartEqMode('smart');
  setContinuousEq(false);
  setSmartEqRunning(false);
  setSmartEqListening('');
});

it('hands the core its settings, and asks what is running', () => {
  const { sentOn, lastSettings } = setUp();
  expect(sentOn(SMART_EQ_CHANNEL.ask)).toHaveLength(1);
  expect(lastSettings()).toMatchObject({
    mode: 'smart',
    continuous: false,
  });
  act(() => setSmartEqMode('balance'));
  expect(lastSettings()).toMatchObject({
    mode: 'balance',
    continuous: true,
  });
  // A running mode chosen runs by its switch; nothing is asked to run.
  expect(sentOn(SMART_EQ_CHANNEL.run)).toHaveLength(0);
});

it('runs the one-shot the moment it is chosen, and sends the button', () => {
  setSmartEqMode('detail');
  const { sentOn } = setUp();
  act(() => setSmartEqMode('smart'));
  expect(sentOn(SMART_EQ_CHANNEL.run)).toHaveLength(1);
  runSmartEq();
  cancelSmartEq();
  expect(sentOn(SMART_EQ_CHANNEL.run)).toHaveLength(2);
  expect(sentOn(SMART_EQ_CHANNEL.cancel)).toHaveLength(1);
});

it('reveals a one-shot’s answer from where the layer was', async () => {
  const { setSmartEq, push } = setUp();
  jest.mocked(planBandReveal).mockReturnValue({
    initial: { b1: band(0) } as unknown as ISmartEqSettings['filters'],
    steps: [[{ id: 'b1', gain: 4 }]] as never,
  });
  const wrote: ISmartEqWrote = {
    kind: 'measured',
    layer: LAYER,
    from: FROM,
    moved: [],
  };
  await push(SMART_EQ_CHANNEL.wrote, wrote);
  expect(planBandReveal).toHaveBeenCalledWith(LAYER.filters, {
    from: FROM.filters,
  });
  const drawn = setSmartEq.mock.calls.map(
    ([layer]) => (layer as ISmartEqSettings).filters?.b1?.gain,
  );
  expect(drawn).toEqual([0, 4, 4]);
  expect(setSmartEq).toHaveBeenLastCalledWith(LAYER);
  expect(noteSmartEqWrite).not.toHaveBeenCalled();
});

it('shows a refinement at once, lights what moved, and keeps the song’s loan', async () => {
  const { setSmartEq, push } = setUp();
  const moved = [{ label: 'bass' }] as unknown as ISmartEqWrote['moved'];
  await push(SMART_EQ_CHANNEL.wrote, {
    kind: 'refined',
    layer: LAYER,
    from: FROM,
    moved,
  });
  expect(noteSmartEqWrite).toHaveBeenCalledWith(LAYER);
  expect(setSmartEq).toHaveBeenCalledTimes(1);
  expect(setSmartEq).toHaveBeenCalledWith(LAYER);
  expect(flashCorrection).toHaveBeenCalledWith(moved);
  expect(planBandReveal).not.toHaveBeenCalled();
});

it('ignores anything from the core that is not one of its messages', async () => {
  const { setSmartEq, push } = setUp();
  const run = renderHook(() => useSmartEqRun());
  await push(SMART_EQ_CHANNEL.wrote, {
    kind: 'other',
    layer: LAYER,
    moved: [],
  });
  await push(SMART_EQ_CHANNEL.wrote, { kind: 'refined', layer: LAYER });
  await push(SMART_EQ_CHANNEL.state, { isRunning: 'yes', listeningFor: '' });
  expect(setSmartEq).not.toHaveBeenCalled();
  expect(run.result.current).toEqual({ listeningFor: '', isRunning: false });
  // POSITIVE CONTROL: the same messages, well formed, are taken.
  await push(SMART_EQ_CHANNEL.state, { isRunning: true, listeningFor: 'x' });
  expect(run.result.current).toEqual({ listeningFor: 'x', isRunning: true });
  await push(SMART_EQ_CHANNEL.wrote, {
    kind: 'refined',
    layer: LAYER,
    moved: [],
  });
  expect(setSmartEq).toHaveBeenCalledWith(LAYER);
});
