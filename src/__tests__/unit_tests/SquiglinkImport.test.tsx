import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import {
  AutoEqFormat,
  FilterTypeEnum,
  getDefaultFilterWithId,
} from 'common/constants';
import SquiglinkImport from 'renderer/SquiglinkImport';
import {
  FluidEqProviderWrapper,
  IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

const mockImportEqText = jest.fn();
const mockClearGains = jest.fn();
const mockSetHeadphone = jest.fn();
const SQUIGLINK_TEXT_STORAGE_KEY = 'fluideq.squiglink-import.text';

jest.mock('renderer/utils/equalizerApi', () => ({
  clearGains: (...args: unknown[]) => mockClearGains(...args),
  importEqText: (...args: unknown[]) => mockImportEqText(...args),
  setHeadphone: (...args: unknown[]) => mockSetHeadphone(...args),
}));

describe('Squiglink import preview', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.localStorage.removeItem(SQUIGLINK_TEXT_STORAGE_KEY);
    mockImportEqText.mockResolvedValue('Imported');
    mockClearGains.mockResolvedValue(undefined);
    mockSetHeadphone.mockResolvedValue(undefined);
  });

  it('draws the applied EQ curve from refreshed state', () => {
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      eqImport: {
        source: 'squiglink',
        sourceUrl: 'https://squig.link/',
        label: 'Squiglink export',
        eqFormat: AutoEqFormat.PARAMETRIC,
        filterCount: Object.keys(defaultFluidEqContext.filters).length,
        text: 'Preamp: 0 dB\nFilter 1: ON PK Fc 1000 Hz Gain 2 dB Q 1',
      },
      eqFormat: AutoEqFormat.PARAMETRIC,
    };

    const { container } = render(
      <FluidEqProviderWrapper value={context}>
        <SquiglinkImport />
      </FluidEqProviderWrapper>,
    );

    expect(
      screen.getByRole('img', {
        name: 'Frequency response of the imported EQ',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue(
      'Preamp: 0 dB\nFilter 1: ON PK Fc 1000 Hz Gain 2 dB Q 1',
    );
    expect(container.querySelector('.squig-import__curve')).toHaveAttribute(
      'd',
      expect.stringContaining('M'),
    );
    expect(screen.getByText('Applied curve')).toBeInTheDocument();
    expect(container.querySelector('.squig-import__curve')).not.toHaveClass(
      'squig-import__curve--pending',
    );
  });

  it('updates from the text area and keeps the export after Apply', async () => {
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      eqImport: undefined,
      preAmp: 0,
      filters: {},
    };
    const { container } = render(
      <FluidEqProviderWrapper value={context}>
        <SquiglinkImport />
      </FluidEqProviderWrapper>,
    );
    const exportText =
      'Preamp: -2 dB\nFilter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1';
    const textarea = screen.getByRole('textbox');

    fireEvent.change(textarea, { target: { value: exportText } });

    expect(container.querySelector('.squig-import__curve')).toHaveAttribute(
      'd',
      expect.stringContaining('M'),
    );
    expect(screen.getByText('Not applied')).toBeInTheDocument();
    expect(container.querySelector('.squig-import__curve')).toHaveClass(
      'squig-import__curve--pending',
    );
    expect(textarea).toHaveValue(exportText);

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Apply as EQ' }));
      await Promise.resolve();
    });

    expect(mockImportEqText).toHaveBeenCalledWith(
      exportText,
      'Squiglink export',
      'eq',
    );
    expect(textarea).toHaveValue(exportText);
  });

  it.each(['eq', 'curve'] as const)(
    'reviews existing bands before importing into %s',
    async (destination) => {
      const refreshState = jest.fn().mockResolvedValue(undefined);
      render(
        <FluidEqProviderWrapper
          value={{ ...defaultFluidEqContext, preAmp: -3, refreshState }}
        >
          <SquiglinkImport />
        </FluidEqProviderWrapper>,
      );
      const text = 'Filter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1';
      fireEvent.change(screen.getByRole('textbox'), {
        target: { value: text },
      });
      fireEvent.click(screen.getByRole('button', { name: 'Apply as EQ' }));
      const dialog = screen.getByRole('alertdialog');
      expect(mockImportEqText).not.toHaveBeenCalled();
      expect(
        within(dialog).getByRole('button', { name: 'Apply as curve' }),
      ).toHaveFocus();
      await act(async () => {
        fireEvent.click(
          within(dialog).getByRole('button', {
            name: destination === 'eq' ? 'Replace EQ' : 'Apply as curve',
          }),
        );
      });
      expect(mockImportEqText).toHaveBeenCalledWith(
        text,
        'Squiglink export',
        destination,
      );
      expect(refreshState).toHaveBeenCalledWith({
        revealBands: destination === 'eq',
      });
      expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    },
  );

  it('cancels a replacement when the output changes, retaining the pasted text', () => {
    const context = {
      ...defaultFluidEqContext,
      preAmp: -3,
      activeDeviceId: 'first',
    };
    const { rerender } = render(
      <FluidEqProviderWrapper value={context}>
        <SquiglinkImport />
      </FluidEqProviderWrapper>,
    );
    const text = 'Filter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1';
    fireEvent.change(screen.getByRole('textbox'), { target: { value: text } });
    fireEvent.click(screen.getByRole('button', { name: 'Apply as EQ' }));
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Apply as EQ' }));
    rerender(
      <FluidEqProviderWrapper value={{ ...context, activeDeviceId: 'second' }}>
        <SquiglinkImport />
      </FluidEqProviderWrapper>,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(mockImportEqText).not.toHaveBeenCalled();
    expect(screen.getByRole('textbox')).toHaveValue(text);
  });

  it('removes an imported correction without clearing the independently edited EQ', async () => {
    render(
      <FluidEqProviderWrapper
        value={{
          ...defaultFluidEqContext,
          headphone: {
            filters: {},
            intensity: 1,
            eqImport: {
              source: 'squiglink',
              sourceUrl: 'https://squig.link/',
              label: 'Correction',
              eqFormat: AutoEqFormat.PARAMETRIC,
              filterCount: 1,
              text: 'Filter 1: ON PK Fc 1000 Hz Gain 4 dB Q 1',
            },
          },
        }}
      >
        <SquiglinkImport />
      </FluidEqProviderWrapper>,
    );
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove import' }));
    });
    expect(mockSetHeadphone).toHaveBeenCalledWith(undefined);
    expect(mockClearGains).not.toHaveBeenCalled();
    expect(screen.getByText('Flat preview')).toBeInTheDocument();
  });

  it('shows a flat 0 dB preview after removing the applied import', async () => {
    const customFilter = getDefaultFilterWithId();
    customFilter.type = FilterTypeEnum.PK;
    customFilter.frequency = 1000;
    customFilter.gain = 4;
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      customFx: {
        fileName: 'fluideq-0123456789ab-custom.txt',
        preAmp: -1,
        filters: { [customFilter.id]: customFilter },
      },
      eqImport: {
        source: 'squiglink',
        sourceUrl: 'https://squig.link/',
        label: 'Squiglink export',
        eqFormat: AutoEqFormat.PARAMETRIC,
        filterCount: Object.keys(defaultFluidEqContext.filters).length,
      },
      eqFormat: AutoEqFormat.PARAMETRIC,
    };
    const { container } = render(
      <FluidEqProviderWrapper value={context}>
        <SquiglinkImport />
      </FluidEqProviderWrapper>,
    );

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Remove import' }));
      await Promise.resolve();
    });

    expect(mockClearGains).toHaveBeenCalled();
    expect(screen.getByText('Flat preview')).toBeInTheDocument();
    expect(container.querySelector('.squig-import__curve')).toHaveAttribute(
      'd',
      expect.stringContaining('M'),
    );
    expect(
      container.querySelector('.squig-import__curve--custom'),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('textbox')).toHaveValue('');
  });

  it('restores a pasted draft from the previous session', () => {
    const exportText =
      'Preamp: -1 dB\nFilter 1: ON PK Fc 2500 Hz Gain 3 dB Q 1';
    window.localStorage.setItem(SQUIGLINK_TEXT_STORAGE_KEY, exportText);

    render(
      <FluidEqProviderWrapper value={defaultFluidEqContext}>
        <SquiglinkImport />
      </FluidEqProviderWrapper>,
    );

    expect(screen.getByRole('textbox')).toHaveValue(exportText);
  });

  it('draws the active custom config curve beside the import preview', () => {
    const customFilter = getDefaultFilterWithId();
    customFilter.type = FilterTypeEnum.PK;
    customFilter.frequency = 1000;
    customFilter.gain = 4;
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      customFx: {
        fileName: 'fluideq-0123456789ab-custom.txt',
        preAmp: -1,
        filters: { [customFilter.id]: customFilter },
      },
    };

    const { container } = render(
      <FluidEqProviderWrapper value={context}>
        <SquiglinkImport />
      </FluidEqProviderWrapper>,
    );

    expect(
      screen.getByText('fluideq-0123456789ab-custom.txt'),
    ).toBeInTheDocument();
    expect(
      container.querySelector('.squig-import__curve--custom'),
    ).toHaveAttribute('d', expect.stringContaining('M'));
    expect(screen.getAllByText('Custom FX')).toHaveLength(1);
  });

  it('combines GraphicEQ and explicit filters in the custom preview', () => {
    const customFilter = getDefaultFilterWithId();
    customFilter.type = FilterTypeEnum.PK;
    customFilter.frequency = 1000;
    customFilter.gain = 6;
    customFilter.quality = 1;
    const context: IFluidEqContext = {
      ...defaultFluidEqContext,
      customFx: {
        fileName: 'fluideq-0123456789ab-custom.txt',
        preAmp: 0,
        graphicEq: [
          { frequency: 20, gain: 0 },
          { frequency: 20000, gain: 0 },
        ],
        filters: { [customFilter.id]: customFilter },
      },
    };

    const { container } = render(
      <FluidEqProviderWrapper value={context}>
        <SquiglinkImport />
      </FluidEqProviderWrapper>,
    );

    const path = container
      .querySelector('.squig-import__curve--custom')
      ?.getAttribute('d');
    expect(path).toContain('M');
    const yCoordinates = new Set(
      path?.match(/,(\d+\.\d+)/g)?.map((value) => value.slice(1)),
    );
    expect(yCoordinates.size).toBeGreaterThan(1);
  });
});
