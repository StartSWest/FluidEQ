/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import type { IMyCurve } from 'common/myCurves';
import SaveToMyCurves from 'renderer/eq/SaveToMyCurves';
import { forgetMyCurvesCache, type INewCurve } from 'renderer/eq/myCurvesStore';
import {
  FluidEqProviderWrapper,
  type IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

let mainList: IMyCurve[] = [];
const mockWrite = jest.fn(async (list: IMyCurve[]) => {
  mainList = list;
  return true;
});

jest.mock('renderer/utils/equalizerApi', () => ({
  readMyCurves: async () => mainList,
  writeMyCurves: (list: IMyCurve[]) => mockWrite(list),
}));

const TEXT = 'Preamp: -5 dB\nFilter 1: ON LSC Fc 105 Hz Gain 4.5 dB Q 0.7';
const curve: INewCurve = {
  text: TEXT,
  name: 'Sennheiser HD 600 · Harman target',
  source: 'opra',
  ears: 'both',
};

const kept = (id: string, name: string, text = TEXT): IMyCurve => ({
  id,
  name,
  text,
  source: 'file',
  ears: 'both',
  addedAt: 1,
});

const show = async (
  draft: INewCurve | undefined = curve,
  over: Partial<IFluidEqContext> = {},
) => {
  render(
    <FluidEqProviderWrapper value={{ ...defaultFluidEqContext, ...over }}>
      <SaveToMyCurves curve={draft} />
    </FluidEqProviderWrapper>,
  );
  await act(async () => undefined);
};

const press = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

beforeEach(() => {
  mainList = [];
  jest.clearAllMocks();
  forgetMyCurvesCache();
});

it('keeps the curve in one press, under its own name, and then says where it is', async () => {
  await show();
  await press(screen.getByRole('button', { name: 'Save to My curves' }));
  expect(mainList).toHaveLength(1);
  expect(mainList[0]).toMatchObject({
    name: 'Sennheiser HD 600 · Harman target',
    source: 'opra',
    text: TEXT,
  });
  expect(screen.getByRole('status')).toHaveTextContent(
    'In My curves as “Sennheiser HD 600 · Harman target”',
  );
  expect(
    screen.queryByRole('button', { name: 'Save to My curves' }),
  ).not.toBeInTheDocument();
});

it('offers no second copy of a curve already kept, whatever it is called there', async () => {
  mainList = [kept('a', 'My HD 600', `${TEXT}\n`)];
  await show();
  expect(screen.getByRole('status')).toHaveTextContent(
    'In My curves as “My HD 600”',
  );
  expect(mockWrite).not.toHaveBeenCalled();
});

it('offers no save with no curve to keep', async () => {
  render(
    <FluidEqProviderWrapper value={defaultFluidEqContext}>
      <SaveToMyCurves curve={undefined} />
    </FluidEqProviderWrapper>,
  );
  await act(async () => undefined);
  expect(
    screen.getByRole('button', { name: 'Save to My curves' }),
  ).toBeDisabled();
});

it('offers no save in a full list', async () => {
  mainList = Array.from({ length: 500 }, (_, index) =>
    kept(
      `c${index}`,
      `Curve ${index}`,
      `Filter 1: ON PK Fc ${100 + index} Hz Gain 1 dB Q 1`,
    ),
  );
  await show();
  expect(
    screen.getByRole('button', { name: 'Save to My curves' }),
  ).toBeDisabled();
});

it('says why, and stays a button, when main cannot keep the curve', async () => {
  const setGlobalError = jest.fn();
  await show(curve, { setGlobalError });
  mockWrite.mockRejectedValueOnce(new Error('disk full'));
  await press(screen.getByRole('button', { name: 'Save to My curves' }));
  expect(setGlobalError).toHaveBeenCalledWith(new Error('disk full'));
  expect(
    screen.getByRole('button', { name: 'Save to My curves' }),
  ).toBeEnabled();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
