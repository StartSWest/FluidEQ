/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.
*/

import '@testing-library/jest-dom';
import { ReactElement } from 'react';
import { act, render, screen, within } from '@testing-library/react';
import AutoEQ from 'renderer/AutoEQ';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import {
  getAutoEqDeviceList,
  getAutoEqResponseList,
  checkAutoEqUpdate,
} from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/equalizerApi', () => ({
  getAutoEqDeviceList: jest.fn(),
  getAutoEqResponseList: jest.fn(),
  loadAutoEqPreset: jest.fn(),
  checkAutoEqUpdate: jest.fn(),
  clearHeadset: jest.fn(),
  updateAutoEqDatabase: jest.fn(),
}));

const mockAutoEqDevices = getAutoEqDeviceList as jest.Mock;
const mockAutoEqResponses = getAutoEqResponseList as jest.Mock;
const mockCheckUpdate = checkAutoEqUpdate as jest.Mock;

const MODEL = 'HD 600';
const TARGET = 'HD 600 - ParametricEQ';

const settle = async () => {
  for (let level = 0; level < 8; level += 1) {
    // eslint-disable-next-line no-await-in-loop
    await Promise.resolve();
  }
};

const actAndSettle = (body: () => void) =>
  act(async () => {
    body();
    await settle();
  });

describe('AutoEQ', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockAutoEqDevices.mockResolvedValue([MODEL]);
    mockAutoEqResponses.mockResolvedValue([TARGET]);
    mockCheckUpdate.mockRejectedValue(new Error('offline'));

    Object.defineProperty(window, 'electron', {
      configurable: true,
      get: () => ({
        ipcRenderer: {
          sendMessage: () => {},
          on: () => () => {},
          once: () => {},
          removeListener: () => {},
        },
      }),
    });
  });

  const panelWith = (overrides: Partial<IFluidEqContext>): ReactElement => (
    <FluidEqProviderWrapper value={{ ...defaultFluidEqContext, ...overrides }}>
      <AutoEQ />
    </FluidEqProviderWrapper>
  );

  const renderPanel = async (overrides: Partial<IFluidEqContext>) => {
    let result!: ReturnType<typeof render>;
    await actAndSettle(() => {
      result = render(panelWith(overrides));
    });
    return result;
  };

  it('shows only the official AutoEq model and target pickers', async () => {
    await renderPanel({});

    expect(
      screen.getByRole('menu', { name: 'Audio device' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('menu', { name: 'Target frequency response' }),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Squiglink/i)).not.toBeInTheDocument();
    expect(screen.getByText('AutoEq official database')).toBeInTheDocument();
    expect(mockAutoEqDevices).toHaveBeenCalled();
  });

  it('restores an applied official reference into both pickers', async () => {
    await renderPanel({
      headset: MODEL,
      headsetTarget: TARGET,
      headsetSource: 'autoeq',
    });

    const modelMenu = screen.getByRole('menu', { name: 'Audio device' });
    const targetMenu = screen.getByRole('menu', {
      name: 'Target frequency response',
    });
    expect(within(modelMenu).getByText(MODEL)).toBeInTheDocument();
    expect(within(targetMenu).getByText(MODEL)).toBeInTheDocument();
    expect(screen.getByText(/Applied:/)).toBeInTheDocument();
    expect(mockAutoEqResponses).toHaveBeenCalledWith(MODEL);
  });
});
