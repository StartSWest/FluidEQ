import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import BandLayoutMenu from 'renderer/components/BandLayoutMenu';
import ClearEqButton from 'renderer/components/ClearEqButton';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import defaultContext from '__tests__/utils/mockFluidEqProvider';
import {
  applyBandDesign,
  deleteBandDesign,
  getBandDesigns,
  saveBandDesign,
} from 'renderer/utils/bandDesignApi';
import { clearGains, setFixedBand } from 'renderer/utils/equalizerApi';

jest.mock('renderer/utils/bandDesignApi', () => ({
  getBandDesigns: jest.fn(),
  applyBandDesign: jest.fn(),
  saveBandDesign: jest.fn(),
  deleteBandDesign: jest.fn(),
}));
jest.mock('renderer/utils/equalizerApi', () => ({
  clearGains: jest.fn(),
  setFixedBand: jest.fn(),
}));
jest.mock('renderer/utils/logger', () => ({ reportError: jest.fn() }));

const design = {
  id: 'saved',
  name: 'My layout',
  bands: [{ frequency: 71, quality: 2.3 }],
};
const refreshState = jest.fn();
const context = { ...defaultContext, refreshState, eqBandDesign: design };
const mount = () =>
  render(
    <FluidEqProviderWrapper value={context}>
      <BandLayoutMenu />
      <ClearEqButton />
    </FluidEqProviderWrapper>,
  );
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
    expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
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
    expect(refreshState).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(applyBandDesign).not.toHaveBeenCalled();
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
