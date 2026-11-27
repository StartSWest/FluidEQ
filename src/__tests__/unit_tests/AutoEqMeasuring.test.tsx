/* FluidEQ — GPL-3.0-or-later */
import '@testing-library/jest-dom';
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from '@testing-library/react';
import { getDefaultFilterWithId } from 'common/constants';
import { translate } from 'common/i18n';
import SmartEqEngine from 'renderer/SmartEqEngine';
import {
  measureSource,
  type IMeasurementOptions,
} from 'renderer/audio/smartEqMeasurement';
import AutoEqMeasureOnce from 'renderer/eq/autoEq/AutoEqMeasureOnce';
import AutoEqSmartPart from 'renderer/eq/autoEq/AutoEqSmartPart';
import useAutoEqButton from 'renderer/eq/autoEq/useAutoEqButton';
import type { IBalanceResult } from 'renderer/utils/autoBalanceCapture';
import { setContinuousEq } from 'renderer/utils/continuousEq';
import { setSmartEq as writeSmartEq } from 'renderer/utils/equalizerApi';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import {
  getSmartEqMode,
  setSmartEqMode,
  type TSmartEqMode,
} from 'renderer/utils/smartEqMode';
import { setSmartEqRunning } from 'renderer/utils/smartEqRun';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

/**
 * Smart EQ's measurements, now in Auto EQ's panel (2026-11-20): the Smart
 * correction part starts and stops the continuous modes, and Measure once in
 * the panel's foot runs the one-shot. Driven against the real engine, with
 * the measurement itself stood in for, as the toolbar's suite this replaces
 * was.
 */

jest.mock('renderer/audio/smartEqMeasurement', () => ({
  measureSource: jest.fn(),
}));
jest.mock('renderer/audio/nowPlayingIdentity', () => ({
  useNowPlayingIdentity: () => ({ identity: undefined, isPlaying: true }),
}));
jest.mock('renderer/audio/LiveAudioContext', () => ({
  useLiveAudioCapture: () => undefined,
  useLiveAudioFrame: () => ({ graphPoints: [] }),
  useLiveAudioFrameListener: () => undefined,
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  setSmartEq: jest.fn(() => Promise.resolve()),
}));

const en = (key: Parameters<typeof translate>[1]) => translate('en', key);
const mockMeasureSource = jest.mocked(measureSource);
const measurements: {
  options: IMeasurementOptions;
  fail: (reason: Error) => void;
}[] = [];

/** The panel's Smart correction part and its foot's Measure once. */
const Panel = () => {
  const button = useAutoEqButton();
  return (
    <>
      <AutoEqSmartPart button={button} />
      <AutoEqMeasureOnce isBalancing={button.isBalancing} />
    </>
  );
};

const renderPanel = (bypassed: 'smart'[] = []) => {
  const band = { ...getDefaultFilterWithId(), gain: -3 };
  return render(
    <FluidEqProviderWrapper
      value={{
        ...defaultFluidEqContext,
        filters: {},
        bypassed,
        smartEq: { filters: { [band.id]: band } },
      }}
    >
      <SmartEqEngine />
      <Panel />
    </FluidEqProviderWrapper>,
  );
};

const measureOnce = () =>
  screen.getByRole('button', { name: en('autoEq.smart.once') });
const smartSwitch = () =>
  screen.getByRole('checkbox', { name: en('autoEq.smart.title') });
const press = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

beforeEach(() => {
  setSmartEqMode('smart');
  setContinuousEq(false);
  setSmartEqRunning(false);
  jest.clearAllMocks();
  measurements.length = 0;
  mockMeasureSource.mockImplementation((options) => ({
    done: new Promise<IBalanceResult>((_resolve, reject) => {
      measurements.push({ options, fail: reject });
      options.signal?.addEventListener(
        'abort',
        () => reject(new DOMException('Stopped', 'AbortError')),
        { once: true },
      );
    }),
    setSilent: jest.fn(),
    restart: jest.fn(),
    hold: jest.fn(),
  }));
});

afterEach(async () => {
  await act(async () => {
    cleanup();
    setContinuousEq(false);
    setSmartEqMode('smart');
    setSmartEqRunning(false);
  });
});

it('measures nothing until asked', () => {
  renderPanel();
  expect(mockMeasureSource).not.toHaveBeenCalled();
  expect(smartSwitch()).not.toBeChecked();
});

it('runs one measurement from Measure once, and offers it again once that one ends', async () => {
  renderPanel();
  await press(measureOnce());
  expect(mockMeasureSource).toHaveBeenCalledTimes(1);
  expect(measurements[0].options.isContinuous).not.toBe(true);
  // One at a time: the button waits while it measures.
  expect(measureOnce()).toBeDisabled();

  await act(async () => {
    measurements[0].fail(new Error('The source is unavailable'));
  });
  expect(measureOnce()).toBeEnabled();
  await press(measureOnce());
  expect(mockMeasureSource).toHaveBeenCalledTimes(2);
  expect(measurements[1].options.signal?.aborted).toBe(false);
});

it('runs one measurement from Measure once after a continuous mode was stopped', async () => {
  setSmartEqMode('detail');
  setContinuousEq(false);
  renderPanel();
  await press(measureOnce());
  expect(getSmartEqMode()).toBe('smart');
  expect(mockMeasureSource).toHaveBeenCalledTimes(1);
  expect(measurements[0].options.isContinuous).not.toBe(true);
});

it('starts a continuous measurement with Smart correction, stops it, and starts afresh', async () => {
  renderPanel();
  await press(smartSwitch());
  expect(mockMeasureSource).toHaveBeenCalledTimes(1);
  expect(measurements[0].options.isContinuous).toBe(true);

  // Starting writes nothing of its own: nothing is held yet.
  expect(writeSmartEq).not.toHaveBeenCalled();

  await press(smartSwitch());
  expect(measurements[0].options.signal?.aborted).toBe(true);
  // Stopping takes the correction off what is heard (Ivan, 2026-11-20:
  // "when smart correction is turned off, the curves need to disappear
  // too"): one write, of no layer at all.
  expect(writeSmartEq).toHaveBeenCalledTimes(1);
  expect(writeSmartEq).toHaveBeenLastCalledWith(undefined);

  await press(smartSwitch());
  expect(mockMeasureSource).toHaveBeenCalledTimes(2);
  expect(measurements[1].options.signal?.aborted).toBe(false);
  // And starting afresh on a song never held writes nothing more.
  expect(writeSmartEq).toHaveBeenCalledTimes(1);
});

it.each<[TSmartEqMode, string]>([
  ['detail', 'eq.smart.mode.detail'],
  ['balance', 'eq.smart.mode.balance'],
  ['target', 'eq.smart.mode.target'],
])('measures continuously in %s when it is picked', async (mode, name) => {
  setSmartEqMode('balance');
  renderPanel();
  expect(smartSwitch()).toBeChecked();
  await press(
    screen.getByRole('radio', {
      name: en(name as Parameters<typeof translate>[1]),
    }),
  );
  expect(getSmartEqMode()).toBe(mode);
  const latest = measurements[measurements.length - 1];
  expect(latest?.options.isContinuous).toBe(true);
  expect(latest?.options.signal?.aborted).toBe(false);
});

it('can be switched off while its layer is bypassed', async () => {
  setSmartEqMode('detail');
  renderPanel(['smart']);
  // Nothing measures over a bypassed layer...
  expect(mockMeasureSource).not.toHaveBeenCalled();
  expect(smartSwitch()).toBeChecked();
  // ...and the switch still turns the mode off.
  await press(smartSwitch());
  expect(smartSwitch()).not.toBeChecked();
});
