import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import BandLayoutMenu from 'renderer/components/BandLayoutMenu';
import ClearEqButton from 'renderer/components/ClearEqButton';
import {
  FluidEqProviderWrapper,
  type IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultContext from '__tests__/utils/mockFluidEqProvider';
import {
  FilterTypeEnum,
  getDefaultFilters,
  FixedBandSizeEnum,
} from 'common/constants';
import {
  applyBandDesign,
  deleteBandDesign,
  getBandDesigns,
  saveBandDesign,
} from 'renderer/utils/bandDesignApi';
import {
  clearGains,
  setEqCut,
  setFixedBand,
  setFilterValues,
  setTone,
} from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/bandDesignApi', () => ({
  getBandDesigns: jest.fn(),
  applyBandDesign: jest.fn(),
  saveBandDesign: jest.fn(),
  deleteBandDesign: jest.fn(),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  clearGains: jest.fn(),
  setEqCut: jest.fn(),
  setFixedBand: jest.fn(),
  setFilterValues: jest.fn(),
  setTone: jest.fn(),
}));
jest.mock('renderer/utils/logger', () => ({ reportError: jest.fn() }));

const design = {
  id: 'saved',
  name: 'My layout',
  bands: [{ frequency: 71, quality: 2.3 }],
};
const refreshState = jest.fn();
const context = { ...defaultContext, refreshState, eqBandDesign: design };
const mount = (value: IFluidEqContext = context) =>
  render(
    <FluidEqProviderWrapper value={value}>
      <BandLayoutMenu />
      <ClearEqButton />
    </FluidEqProviderWrapper>,
  );
const confirmClear = async () => {
  fireEvent.click(screen.getByRole('button', { name: 'Clear EQ' }));
  await act(async () => {
    fireEvent.click(
      within(screen.getByRole('alertdialog')).getByRole('button', {
        name: 'Clear EQ',
      }),
    );
  });
};
const openMenu = async () => {
  await act(async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Quick layouts' }));
  });
};

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getBandDesigns).mockResolvedValue([design]);
  jest.mocked(saveBandDesign).mockResolvedValue(design);
  jest.mocked(applyBandDesign).mockResolvedValue(design);
  jest.mocked(deleteBandDesign).mockResolvedValue(true);
  refreshState.mockResolvedValue(undefined);
});

describe('band layout menu', () => {
  // One button for frequencies and Q together since 2026-11-16 ("the same
  // button does everything"); it reset the Q alone.
  it('resets frequencies and bell Q in one batch, and keeps gains and the shelf’s Q out of the edit', async () => {
    const filters = getDefaultFilters(FixedBandSizeEnum.SIX);
    const bands = Object.values(filters);
    const home = bands[2].frequency;
    bands[0].type = FilterTypeEnum.LSC;
    bands.forEach((band) => {
      band.quality = 4;
      band.gain = 3;
    });
    bands[2].frequency = home + 100;
    // The built-in six's layout, not a saved design: its bells' Q is 0.35.
    mount({ ...context, filters, eqBandDesign: undefined });
    await openMenu();
    await act(async () =>
      fireEvent.click(
        screen.getByRole('button', { name: 'Reset frequencies and Q' }),
      ),
    );
    expect(setFilterValues).toHaveBeenCalledTimes(1);
    expect(setFilterValues).toHaveBeenCalledWith(
      bands
        .slice(1)
        .map((band, index) =>
          index === 1
            ? { id: band.id, frequency: home, quality: 0.35 }
            : { id: band.id, quality: 0.35 },
        ),
    );
    // Written to the engine, never to the bands in hand.
    expect(bands.every((band) => band.gain === 3 && band.quality === 4)).toBe(
      true,
    );
  });

  it('keeps cached rows without a temporary loading row when reopened, then receives fresh data', async () => {
    let finishRead: (entries: (typeof design)[]) => void = () => {};
    jest.mocked(getBandDesigns).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    mount();
    await openMenu();
    expect(screen.getByRole('status')).toHaveTextContent('Loading designs');
    await act(async () => {
      finishRead([design]);
    });
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    jest.mocked(getBandDesigns).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finishRead = resolve;
        }),
    );
    await openMenu();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'My layout 1 Band' }),
    ).toBeInTheDocument();
    await act(async () => {
      finishRead([{ ...design, name: 'Renamed' }]);
    });
    expect(
      screen.getByRole('button', { name: 'Renamed 1 Band' }),
    ).toBeInTheDocument();
  });

  it('saves a named design, prevents duplicate names and offers an explicit update', async () => {
    mount();
    await openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Save design…' }));
    fireEvent.change(screen.getByLabelText('Design name'), {
      target: { value: ' MY LAYOUT ' },
    });
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Design name'), {
      target: { value: 'Another' },
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    });
    expect(saveBandDesign).toHaveBeenCalledWith('Another');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Update saved' }));
    });
    expect(saveBandDesign).toHaveBeenLastCalledWith(design.name, design.id);
  });

  it('loads named and built-in layouts using their own commands', async () => {
    mount();
    await openMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'My layout 1 Band' }));
    });
    expect(applyBandDesign).toHaveBeenCalledWith(design.id);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await openMenu();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: '31 Band' }));
    });
    expect(setFixedBand).toHaveBeenCalledWith(31);
  });

  it('asks before deleting, lets Escape cancel, and deletes once on confirmation', async () => {
    mount();
    await openMenu();
    fireEvent.click(screen.getByRole('button', { name: 'Delete “My layout”' }));
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    expect(deleteBandDesign).not.toHaveBeenCalled();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(
      screen.queryByRole('button', { name: 'Delete design' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Delete “My layout”' }));
    await act(async () => {
      const button = screen.getByRole('button', { name: 'Delete design' });
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(deleteBandDesign).toHaveBeenCalledTimes(1);
    expect(deleteBandDesign).toHaveBeenCalledWith(design.id);
    expect(clearGains).not.toHaveBeenCalled();
  });
});

describe('Empty EQ confirmation', () => {
  it('cancels without changes and sends exactly one clear command after confirmation', async () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Clear EQ' }));
    expect(screen.getByRole('alertdialog')).toHaveTextContent(
      'Keep the current band count',
    );
    // The words, not the corner's cross, which carries the same name.
    const cancel = screen.getByText('Cancel', { selector: 'button' });
    expect(cancel).toHaveFocus();
    fireEvent.click(cancel);
    expect(clearGains).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Clear EQ' }));
    await act(async () => {
      const button = within(screen.getByRole('alertdialog')).getByRole(
        'button',
        { name: 'Clear EQ' },
      );
      fireEvent.click(button);
      fireEvent.click(button);
    });
    expect(clearGains).toHaveBeenCalledTimes(1);
    // The bands alone (Ivan, 2026-11-26): the Tone has Reset Tone.
    expect(setTone).not.toHaveBeenCalled();
    expect(setEqCut).not.toHaveBeenCalled();
    expect(refreshState).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(applyBandDesign).not.toHaveBeenCalled();
  });

  it('leaves the Tone tab as it is, cuts on included, and reads the state back', async () => {
    // The Tone tab - its dials and the cuts either side - is reset by Reset
    // Tone alone (Ivan, 2026-11-26: "Clear EQ cannot reset the tone").
    mount({ ...context, eqCuts: { low: 24, high: 12 } });
    await confirmClear();
    // POSITIVE CONTROL: Clear EQ ran - the bands were cleared and read back.
    expect(clearGains).toHaveBeenCalledTimes(1);
    expect(refreshState).toHaveBeenCalledTimes(1);
    expect(setTone).not.toHaveBeenCalled();
    expect(setEqCut).not.toHaveBeenCalled();
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('keeps errors visible for retry and closes when the output changes', async () => {
    jest.mocked(clearGains).mockRejectedValueOnce(new Error('write failed'));
    const { rerender } = mount();
    fireEvent.click(screen.getByRole('button', { name: 'Clear EQ' }));
    await act(async () => {
      fireEvent.click(
        within(screen.getByRole('alertdialog')).getByRole('button', {
          name: 'Clear EQ',
        }),
      );
    });
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
    rerender(
      <FluidEqProviderWrapper value={{ ...context, activeDeviceId: 'another' }}>
        <BandLayoutMenu />
        <ClearEqButton />
      </FluidEqProviderWrapper>,
    );
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });
});
