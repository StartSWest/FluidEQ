/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  AutoEqFormat,
  OPRA_SOURCE_ID,
  type IHeadphoneSettings,
  type IOpraProduct,
} from 'common/constants';
import type { IMyCurve } from 'common/myCurves';
import CorrectionQuickPick from 'renderer/components/eqMode/CorrectionQuickPick';
import { forgetMyCurvesCache } from 'renderer/eq/myCurvesStore';
import {
  FluidEqProviderWrapper,
  type IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

const mockImportEqText = jest.fn();
const mockLoadOpraPreset = jest.fn();
let mainList: IMyCurve[] = [];

jest.mock('renderer/utils/equalizerApi', () => ({
  importEqText: (...args: unknown[]) => mockImportEqText(...args),
  loadOpraPreset: (...args: unknown[]) => mockLoadOpraPreset(...args),
  readMyCurves: async () => mainList,
  writeMyCurves: async () => true,
}));

const HD600: IOpraProduct = {
  id: 'sennheiser::hd600',
  vendor: 'Sennheiser',
  name: 'HD 600',
  subtype: 'over_the_ear',
  curves: [
    { id: 'o1990', author: 'oratory1990', details: 'Harman target' },
    { id: 'rtings', author: 'Rtings/AutoEQ', details: 'Measured by Rtings' },
  ],
};
jest.mock('renderer/opraProducts', () => ({
  knownOpraProducts: () => [HD600],
  loadOpraProducts: async () => [HD600],
  opraProductLabel: (product: IOpraProduct) =>
    `${product.vendor} ${product.name}`,
}));

const WARM = 'Preamp: -4 dB\nFilter 1: ON LSC Fc 100 Hz Gain 4 dB Q 0.8';
const BRIGHT = 'Filter 1: ON HSC Fc 8000 Hz Gain 3 dB Q 0.7';
const kept = (id: string, name: string, text: string): IMyCurve => ({
  id,
  name,
  text,
  source: 'squiglink',
  ears: 'both',
  addedAt: 1,
});

const squigPlaying = (text: string): IHeadphoneSettings => ({
  filters: {},
  intensity: 1,
  eqImport: {
    source: 'squiglink',
    sourceUrl: '',
    label: 'whatever it was called',
    eqFormat: AutoEqFormat.PARAMETRIC,
    filterCount: 1,
    text,
  },
});

const show = async (over: Partial<IFluidEqContext> = {}) => {
  const refreshState = jest.fn().mockResolvedValue(undefined);
  render(
    <FluidEqProviderWrapper
      value={{ ...defaultFluidEqContext, refreshState, ...over }}
    >
      <CorrectionQuickPick />
    </FluidEqProviderWrapper>,
  );
  await act(async () => undefined);
  return refreshState;
};

const press = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

beforeEach(() => {
  mainList = [kept('w', 'Warm', WARM), kept('b', 'Bright', BRIGHT)];
  jest.clearAllMocks();
  forgetMyCurvesCache();
  mockImportEqText.mockResolvedValue('Imported');
  mockLoadOpraPreset.mockResolvedValue(undefined);
});

it('names the curve of yours playing, by its text, whatever it was called when played', async () => {
  await show({ headphone: squigPlaying(BRIGHT) });
  expect(screen.getByRole('button', { name: 'Correction' })).toHaveTextContent(
    'Bright',
  );
});

it('lists your curves first, then the OPRA curves of the headphone playing', async () => {
  await show({
    headset: HD600.id,
    headsetSource: OPRA_SOURCE_ID,
    headsetTarget: 'o1990',
    headphone: { filters: {}, intensity: 1 },
  });
  expect(screen.getByRole('button', { name: 'Correction' })).toHaveTextContent(
    'Harman target',
  );
  fireEvent.click(screen.getByRole('button', { name: 'Correction' }));
  expect(
    screen.getAllByRole('menuitemradio').map((item) => item.textContent),
  ).toEqual([
    'WarmSquiglink · Both ears',
    'BrightSquiglink · Both ears',
    'Harman targetPreset created by oratory1990',
    'Measured by RtingsPreset created by Rtings/AutoEQ',
  ]);
  expect(screen.getByText('OPRA · Sennheiser HD 600')).toBeInTheDocument();
});

it('plays a curve of yours as the correction when picked', async () => {
  const refreshState = await show();
  fireEvent.click(screen.getByRole('button', { name: 'Correction' }));
  await press(screen.getByRole('menuitemradio', { name: /^Bright/ }));
  expect(mockImportEqText).toHaveBeenCalledWith(
    BRIGHT,
    'Bright',
    'curve',
    'both',
  );
  expect(refreshState).toHaveBeenCalled();
});

it('steps from the curve playing to the next and back round, across both lists', async () => {
  await show({
    headset: HD600.id,
    headsetSource: OPRA_SOURCE_ID,
    headsetTarget: 'rtings',
    headphone: { filters: {}, intensity: 1 },
  });
  // The last entry steps round to the first.
  await press(screen.getByRole('button', { name: 'Next correction' }));
  expect(mockImportEqText).toHaveBeenCalledWith(WARM, 'Warm', 'curve', 'both');
  await press(screen.getByRole('button', { name: 'Previous correction' }));
  expect(mockLoadOpraPreset).toHaveBeenCalledWith(HD600.id, 'o1990');
});

it('starts from the first curve when none of these plays', async () => {
  await show();
  expect(screen.getByRole('button', { name: 'Correction' })).toHaveTextContent(
    'None playing',
  );
  await press(screen.getByRole('button', { name: 'Next correction' }));
  expect(mockImportEqText).toHaveBeenCalledWith(WARM, 'Warm', 'curve', 'both');
});

it('is not there at all with no curves of yours and no OPRA curve playing', async () => {
  mainList = [];
  await show();
  expect(
    screen.queryByRole('button', { name: 'Correction' }),
  ).not.toBeInTheDocument();
});
