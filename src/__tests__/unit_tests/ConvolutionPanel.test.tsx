import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import ConvolutionPanel from 'renderer/ConvolutionPanel';
import {
  addConvolutionSearchToHistory,
  clearConvolutionSearchHistory,
  getConvolutionSearchHistory,
} from 'renderer/utils/convolutionSearchHistory';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';
import { getConvolutionCatalog } from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/equalizerApi', () => ({
  clearConvolution: jest.fn(),
  downloadConvolution: jest.fn(),
  getConvolutionCatalog: jest.fn(),
  importConvolutionFile: jest.fn(),
}));

const mockGetCatalog = getConvolutionCatalog as jest.Mock;

describe('Convolution search history UI', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    clearConvolutionSearchHistory();
    mockGetCatalog.mockResolvedValue([]);
  });

  afterEach(() => jest.useRealTimers());

  const renderPanel = () => {
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      isEnabled: true,
    };
    return render(
      <FluidEqProviderWrapper value={context}>
        <ConvolutionPanel />
      </FluidEqProviderWrapper>,
    );
  };

  it('offers recent queries and reruns one when selected', () => {
    addConvolutionSearchToHistory('HD 650');
    renderPanel();
    const search = screen.getByRole('searchbox', {
      name: 'Search headphone models',
    });

    fireEvent.focus(search);
    expect(screen.getByText('Recent searches')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'HD 650' }));
    expect(search).toHaveValue('HD 650');
  });

  it('records a query when the debounced catalogue search runs', async () => {
    renderPanel();
    const search = screen.getByRole('searchbox', {
      name: 'Search headphone models',
    });
    fireEvent.change(search, { target: { value: 'Sundara' } });

    await act(async () => {
      jest.advanceTimersByTime(220);
      await Promise.resolve();
    });

    expect(mockGetCatalog).toHaveBeenCalledWith('Sundara');
    expect(getConvolutionSearchHistory()[0]).toBe('Sundara');
  });
});
