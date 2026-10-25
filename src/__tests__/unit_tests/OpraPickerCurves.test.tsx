/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The OPRA picker and My curves as one thing (Ivan, 2026-10-25): every
 * measurement drawn beside its name so they are told apart by eye, Save to
 * My curves there as soon as a curve is picked, applied or not, and the
 * same curve "Applied" here when My curves played it.
 */
import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { AutoEqFormat, type IHeadphoneSettings } from 'common/constants';
import OpraPicker from 'renderer/OpraPicker';
import { resetOpraProducts } from 'renderer/opraProducts';
import {
  FluidEqProviderWrapper,
  type IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import { getOpraCurves, getOpraProductList } from 'renderer/utils/equalizerApi';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

const mockAdd = jest.fn((_curve: unknown) => Promise.resolve(undefined));

jest.mock('renderer/utils/equalizerApi', () => ({
  getOpraProductList: jest.fn(),
  getOpraCurves: jest.fn(),
  loadOpraPreset: jest.fn(),
  checkOpraUpdate: jest.fn(() => Promise.reject(new Error('offline'))),
  clearHeadset: jest.fn(),
  updateOpraDatabase: jest.fn(),
}));
jest.mock('renderer/eq/myCurvesStore', () => ({
  useMyCurvesState: () => ({ curves: [], isLoaded: true, isFailed: false }),
  isMyCurvesFull: () => false,
  addMyCurve: (curve: unknown) => mockAdd(curve),
}));

const PRODUCT_ID = 'razer::kraken_v3_pro';
const CRINACLE = 'razer:kraken_v3_pro::autoeq_crinacle';
const FILK = 'razer:kraken_v3_pro::autoeq_filk';
const PRODUCT = {
  id: PRODUCT_ID,
  vendor: 'Razer',
  name: 'Kraken V3 Pro',
  subtype: 'over_the_ear',
  curves: [
    { id: CRINACLE, author: 'AutoEQ', details: 'Measured by crinacle' },
    { id: FILK, author: 'AutoEQ', details: 'Measured by Filk' },
  ],
};
const TEXTS = {
  [CRINACLE]:
    'Preamp: 0 dB\nFilter 1: ON LSC Fc 105 Hz Gain 1.8 dB Q 0.7\nFilter 2: ON PK Fc 332 Hz Gain 5.5 dB Q 1.25',
  [FILK]:
    'Preamp: 0 dB\nFilter 1: ON PK Fc 186 Hz Gain -8.6 dB Q 0.25\nFilter 2: ON PK Fc 318 Hz Gain 11.1 dB Q 0.98',
};

const settle = () =>
  act(async () => {
    for (let level = 0; level < 10; level += 1) {
      // eslint-disable-next-line no-await-in-loop
      await Promise.resolve();
    }
  });

const renderPicker = async (overrides: Partial<IFluidEqContext> = {}) => {
  await act(async () => {
    render(
      <FluidEqProviderWrapper
        value={{ ...defaultFluidEqContext, ...overrides }}
      >
        <OpraPicker />
      </FluidEqProviderWrapper>,
    );
  });
  await settle();
};

/** Picks the headphone as somebody would: its list, then its row. */
const pickHeadphone = async () => {
  const model = screen.getByRole('menu', { name: 'Audio device' });
  fireEvent.click(model);
  fireEvent.click(screen.getByRole('menuitem', { name: /Kraken V3 Pro/ }));
  await settle();
};

beforeEach(() => {
  jest.clearAllMocks();
  resetOpraProducts();
  (getOpraProductList as jest.Mock).mockResolvedValue([PRODUCT]);
  (getOpraCurves as jest.Mock).mockResolvedValue(TEXTS);
  Object.defineProperty(window, 'electron', {
    configurable: true,
    get: () => ({
      ipcRenderer: {
        sendMessage: () => {},
        on: () => () => {},
        removeListener: () => {},
      },
    }),
  });
});

describe('the OPRA picker with My curves', () => {
  it('draws every measurement of the headphone picked, read once for all of them', async () => {
    await renderPicker();
    await pickHeadphone();
    expect(getOpraCurves).toHaveBeenCalledTimes(1);
    expect(getOpraCurves).toHaveBeenCalledWith(PRODUCT_ID);
    const target = screen.getByRole('menu', {
      name: 'Target frequency response',
    });
    fireEvent.click(target);
    const rows = screen.getAllByRole('menuitem', { name: /Measured by/ });
    expect(rows).toHaveLength(2);
    rows.forEach((row) => {
      expect(
        row.querySelector('svg.my-curve__spark path.my-curve__line'),
      ).not.toBeNull();
    });
  });

  it('offers Save to My curves beside Apply before anything is applied', async () => {
    await renderPicker();
    await pickHeadphone();
    const save = screen.getByRole('button', { name: /Save to My curves/ });
    // One row with Apply.
    expect(save.closest('.autoeq-actions')).toBe(
      screen
        .getByRole('button', { name: /headset EQ/i })
        .closest('.autoeq-actions'),
    );
    fireEvent.click(save);
    // The save answers after the press; let it, inside the case.
    await settle();
    expect(mockAdd).toHaveBeenCalledWith({
      text: TEXTS[CRINACLE],
      name: 'Razer Kraken V3 Pro · Measured by crinacle',
      source: 'opra',
      ears: 'both',
    });
  });

  it('says Applied for the curve My curves is playing, and only for it', async () => {
    const fromMyCurves: IHeadphoneSettings = {
      filters: {},
      intensity: 1,
      eqImport: {
        source: 'squiglink',
        sourceUrl: 'https://squig.link/',
        label: 'My Kraken',
        eqFormat: AutoEqFormat.PARAMETRIC,
        filterCount: 2,
        text: TEXTS[CRINACLE],
      },
    };
    await renderPicker({ headphone: fromMyCurves });
    await pickHeadphone();
    // The first measurement is picked with the headphone: the one playing.
    expect(
      screen.getByRole('button', { name: /headset EQ/i }),
    ).toHaveTextContent('Applied');
    // The control: the other measurement is not.
    const target = screen.getByRole('menu', {
      name: 'Target frequency response',
    });
    fireEvent.click(target);
    fireEvent.click(screen.getByRole('menuitem', { name: /Measured by Filk/ }));
    await settle();
    expect(
      screen.getByRole('button', { name: /headset EQ/i }),
    ).not.toHaveTextContent('Applied');
  });
});
