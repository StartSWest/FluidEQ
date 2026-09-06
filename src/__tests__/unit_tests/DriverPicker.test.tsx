/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026> <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import DriverPicker from '../../renderer/components/DriverPicker';
import { FluidEqProviderWrapper } from '../../renderer/utils/FluidEqContext';
import { setDriver } from '../../renderer/utils/equalizerApi';

jest.mock('../../renderer/utils/equalizerApi', () => ({
  setDriver: jest.fn(),
}));
const write = jest.mocked(setDriver);
const setup = () => {
  const preview = jest.fn();
  const error = jest.fn();
  render(
    <FluidEqProviderWrapper
      value={{
        ...defaultFluidEqContext,
        isEnabled: true,
        driver: { profileId: 'planar-headphone', intensity: 0.5 },
        setDriver: preview,
        setGlobalError: error,
      }}
    >
      <DriverPicker />
    </FluidEqProviderWrapper>,
  );
  const slider = screen.getByRole('slider');
  Object.defineProperty(slider, 'setPointerCapture', { value: jest.fn() });
  return { slider, preview, error };
};
beforeEach(() => {
  write.mockReset();
  write.mockResolvedValue();
});

it('previews fine pointer steps and writes once on release', async () => {
  const { slider, preview } = setup();
  expect(slider).toHaveAttribute('step', '1');
  fireEvent.pointerDown(slider, { pointerId: 1 });
  fireEvent.change(slider, { target: { value: '51' } });
  fireEvent.change(slider, { target: { value: '57' } });
  expect(preview).toHaveBeenLastCalledWith({
    profileId: 'planar-headphone',
    intensity: 0.57,
  });
  expect(write).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.pointerUp(slider);
  });
  await act(async () => {
    fireEvent.lostPointerCapture(slider);
    fireEvent.blur(slider);
  });
  expect(write).toHaveBeenCalledTimes(1);
  expect(write).toHaveBeenCalledWith('planar-headphone', 0.57);
});

it.each(['keyUp', 'blur', 'pointerCancel'] as const)(
  'commits the gesture on %s',
  async (end) => {
    const { slider } = setup();
    fireEvent.keyDown(slider, { key: 'ArrowRight' });
    fireEvent.change(slider, { target: { value: '61' } });
    expect(write).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent[end](slider, { key: 'ArrowRight' });
    });
    expect(write).toHaveBeenCalledWith('planar-headphone', 0.61);
  },
);

it('commits assistive changes without a pointer gesture', async () => {
  const { slider } = setup();
  await act(async () => {
    fireEvent.change(slider, { target: { value: '0' } });
  });
  expect(write).toHaveBeenCalledWith('planar-headphone', 0);
});

it('serializes writes so a reply cannot acknowledge a later adjustment', async () => {
  const resolvers: (() => void)[] = [];
  write.mockImplementation(
    () =>
      new Promise<void>((resolve) => {
        resolvers.push(resolve);
      }),
  );
  const { slider } = setup();
  await act(async () => {
    fireEvent.change(slider, { target: { value: '60' } });
  });
  await act(async () => {
    fireEvent.change(slider, { target: { value: '70' } });
  });
  expect(write).toHaveBeenCalledTimes(1);
  await act(async () => {
    resolvers[0]();
  });
  expect(write).toHaveBeenCalledTimes(2);
  expect(write).toHaveBeenLastCalledWith('planar-headphone', 0.7);
  await act(async () => {
    resolvers[1]();
  });
});

it('reports failed writes and accepts the next adjustment', async () => {
  const failure = { message: 'write failed' };
  write.mockRejectedValueOnce(failure);
  const { slider, error } = setup();
  await act(async () => {
    fireEvent.change(slider, { target: { value: '60' } });
  });
  expect(error).toHaveBeenCalledWith(failure);
  await act(async () => {
    fireEvent.change(slider, { target: { value: '70' } });
  });
  expect(write).toHaveBeenLastCalledWith('planar-headphone', 0.7);
});
