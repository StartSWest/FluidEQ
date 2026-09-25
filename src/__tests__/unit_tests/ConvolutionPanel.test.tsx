import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react';
import type { IConvolutionCatalogEntry } from 'common/convolution';
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
    jest.clearAllMocks();
    clearConvolutionSearchHistory();
    mockGetCatalog.mockResolvedValue([]);
  });

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
    const search = screen.getByRole('textbox', {
      name: 'Search headphone models',
    });

    fireEvent.focus(search);
    expect(screen.getByText('Recent searches')).toBeInTheDocument();
    fireEvent.mouseDown(screen.getByRole('button', { name: 'HD 650' }));
    expect(search).toHaveValue('HD 650');
  });

  /*
   * Recorded when the search is finished with, not when typing pauses: the
   * pause was a timer, and every pause in the middle of a name went into the
   * history as a search of its own.
   */
  it('records a query when the field is left, and not while it is typed', async () => {
    renderPanel();
    const search = screen.getByRole('textbox', {
      name: 'Search headphone models',
    });
    fireEvent.focus(search);
    await act(async () => {
      fireEvent.change(search, { target: { value: 'Sund' } });
      fireEvent.change(search, { target: { value: 'Sundara' } });
    });

    expect(mockGetCatalog).toHaveBeenCalledWith('Sundara');
    expect(getConvolutionSearchHistory()).toEqual([]);

    fireEvent.blur(search);
    expect(getConvolutionSearchHistory()).toEqual(['Sundara']);
  });

  it('records a query on Enter', async () => {
    renderPanel();
    const search = screen.getByRole('textbox', {
      name: 'Search headphone models',
    });
    await act(async () => {
      fireEvent.change(search, { target: { value: 'HD 800' } });
    });
    fireEvent.keyDown(search, { key: 'Enter' });

    expect(getConvolutionSearchHistory()[0]).toBe('HD 800');
  });
});

/**
 * The catalogue as the page asks for it.
 *
 * A 220 ms timer stood in front of every ask, the first one included, so each
 * visit showed "Loading" for that long before anything was even asked — and
 * an older answer that came back late could still land over a newer one.
 */
describe('Convolution catalogue requests', () => {
  const entry = (name: string): IConvolutionCatalogEntry => ({
    id: name,
    name,
    provider: 'oratory1990',
    sourceId: 'autoeq',
    sourceUrl: `https://example.invalid/${name}`,
    downloadUrl: `https://example.invalid/${name}.wav`,
    format: 'wav',
    phase: 'minimum',
    sampleRate: 48000,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    clearConvolutionSearchHistory();
  });

  const renderPanel = () =>
    render(
      <FluidEqProviderWrapper
        value={{ ...defaultFluidEqContext, isEnabled: true }}
      >
        <ConvolutionPanel />
      </FluidEqProviderWrapper>,
    );

  it('asks the moment the page opens', async () => {
    mockGetCatalog.mockResolvedValue([entry('Sundara')]);
    renderPanel();

    // Asked in the render's own turn, before anything has been waited for.
    expect(mockGetCatalog).toHaveBeenCalledTimes(1);
    expect(mockGetCatalog).toHaveBeenCalledWith('');
    expect(await screen.findByText('Sundara')).toBeInTheDocument();
  });

  it('draws only the answer for what is typed now', async () => {
    let answerOlder: (entries: IConvolutionCatalogEntry[]) => void = () =>
      undefined;
    mockGetCatalog.mockResolvedValueOnce([entry('Sundara'), entry('HD 600')]);
    renderPanel();
    expect(await screen.findByText('HD 600')).toBeInTheDocument();

    const search = screen.getByRole('textbox', {
      name: 'Search headphone models',
    });
    mockGetCatalog.mockReturnValueOnce(
      new Promise((resolve) => {
        answerOlder = resolve;
      }),
    );
    fireEvent.change(search, { target: { value: 'S' } });
    mockGetCatalog.mockResolvedValueOnce([entry('Sundara')]);
    fireEvent.change(search, { target: { value: 'Sundara' } });
    await waitFor(() =>
      expect(screen.queryByText('HD 600')).not.toBeInTheDocument(),
    );

    // The answer for "S" arrives last, and is not the list for "Sundara".
    await act(async () => answerOlder([entry('Sundara'), entry('Susvara')]));
    expect(screen.queryByText('Susvara')).not.toBeInTheDocument();
    expect(screen.getByText('Sundara')).toBeInTheDocument();
  });
});
