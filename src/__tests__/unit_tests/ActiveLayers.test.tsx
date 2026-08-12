import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { FilterTypeEnum, getDefaultFilterWithId } from 'common/constants';
import ActiveLayers from 'renderer/components/ActiveLayers';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

const mockWriteApoConfigFile = jest.fn();
const mockClearGains = jest.fn();
const mockRefreshState = jest.fn();

jest.mock('renderer/utils/equalizerApi', () => ({
  clearConvolution: jest.fn(),
  clearGains: (...args: unknown[]) => mockClearGains(...args),
  setDriver: jest.fn(),
  setHeadphone: jest.fn(),
  setLayerBypass: jest.fn(),
  setSmartEq: jest.fn(),
  setVoicing: jest.fn(),
  writeApoConfigFile: (...args: unknown[]) => mockWriteApoConfigFile(...args),
}));

describe('Custom FX active layer', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockWriteApoConfigFile.mockResolvedValue(undefined);
    mockClearGains.mockResolvedValue(undefined);
    mockRefreshState.mockResolvedValue(undefined);
  });

  it('clears the user config filter file without clearing generated EQ', async () => {
    const fileName = 'fluideq-0123456789ab-custom.txt';
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      customFx: { fileName, preAmp: 0, filters: {} },
      refreshState: mockRefreshState,
    };

    render(
      <FluidEqProviderWrapper value={context}>
        <ActiveLayers />
      </FluidEqProviderWrapper>,
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Clear custom FX filters and text',
        }),
      );
      await Promise.resolve();
    });

    expect(mockWriteApoConfigFile).toHaveBeenCalledWith(fileName, '');
    expect(mockClearGains).not.toHaveBeenCalled();
    expect(mockRefreshState).toHaveBeenCalled();
  });

  it('clears the EQ bands chip without touching neighbouring layers', async () => {
    const filter = getDefaultFilterWithId();
    filter.gain = 4;
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      isFlat: false,
      filters: { [filter.id]: filter },
      refreshState: mockRefreshState,
    };

    render(
      <FluidEqProviderWrapper value={context}>
        <ActiveLayers />
      </FluidEqProviderWrapper>,
    );

    await act(async () => {
      fireEvent.click(
        screen.getByRole('button', {
          name: 'Reset every band to 0 dB',
        }),
      );
      await Promise.resolve();
    });

    expect(mockClearGains).toHaveBeenCalledTimes(1);
    expect(mockWriteApoConfigFile).not.toHaveBeenCalled();
    expect(mockRefreshState).toHaveBeenCalled();
  });

  it('keeps the Smart EQ chip and strength control visible at zero', () => {
    const filter = getDefaultFilterWithId();
    filter.type = FilterTypeEnum.PK;
    filter.frequency = 1000;
    filter.gain = 3;
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      smartEq: {
        filters: { [filter.id]: filter },
        intensity: 0,
      },
      refreshState: mockRefreshState,
    };

    render(
      <FluidEqProviderWrapper value={context}>
        <ActiveLayers />
      </FluidEqProviderWrapper>,
    );

    expect(screen.getAllByText('Smart EQ')).toHaveLength(2);
    expect(screen.getByRole('slider', { name: 'Strength' })).toHaveValue('0');
    expect(screen.getByText('0%')).toBeInTheDocument();
  });
});
