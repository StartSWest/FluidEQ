/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen } from '@testing-library/react';
import {
  FilterTypeEnum,
  OPRA_SOURCE_ID,
  type IHeadphoneSettings,
} from 'common/constants';
import type { IMyCurve } from 'common/myCurves';
import SaveOpraToMyCurves from 'renderer/eq/SaveOpraToMyCurves';
import { forgetMyCurvesCache } from 'renderer/eq/myCurvesStore';
import { FluidEqProviderWrapper } from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

let mainList: IMyCurve[] = [];
const mockImportEqText = jest.fn();

jest.mock('renderer/utils/equalizerApi', () => ({
  importEqText: (...args: unknown[]) => mockImportEqText(...args),
  readMyCurves: async () => mainList,
  writeMyCurves: async (list: IMyCurve[]) => {
    mainList = list;
    return true;
  },
}));

const correction: IHeadphoneSettings = {
  filters: {
    a: {
      id: 'a',
      frequency: 105,
      gain: 5.5,
      quality: 0.7,
      type: FilterTypeEnum.LSC,
    },
    b: {
      id: 'b',
      frequency: 3100,
      gain: -4,
      quality: 2.1,
      type: FilterTypeEnum.PK,
    },
  },
  intensity: 0.5,
};

beforeEach(() => {
  mainList = [];
  jest.clearAllMocks();
  forgetMyCurvesCache();
});

it('keeps a copy of the OPRA correction playing, at full strength, under the library’s name', async () => {
  render(
    <FluidEqProviderWrapper
      value={{
        ...defaultFluidEqContext,
        headphone: correction,
        headset: 'sennheiser::hd600',
        headsetSource: OPRA_SOURCE_ID,
      }}
    >
      <SaveOpraToMyCurves
        headphone={correction}
        name="Sennheiser HD 600 · Harman target"
      />
    </FluidEqProviderWrapper>,
  );
  fireEvent.click(screen.getByRole('button', { name: 'Save to My curves' }));
  await act(async () => undefined);
  expect(
    screen.getByRole('textbox', { name: 'ParametricEQ text' }),
  ).toHaveValue(
    [
      'Preamp: 0 dB',
      'Filter 1: ON LSC Fc 105 Hz Gain 5.5 dB Q 0.7',
      'Filter 2: ON PK Fc 3100 Hz Gain -4 dB Q 2.1',
    ].join('\n'),
  );
  expect(screen.getByRole('textbox', { name: 'Name' })).toHaveValue(
    'Sennheiser HD 600 · Harman target',
  );
  expect(screen.getByRole('button', { name: /^From OPRA/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  const dialogSave = screen
    .getAllByRole('button', { name: 'Save to My curves' })
    .find((button) => button.closest('.my-curve-dialog'));
  if (!dialogSave) {
    throw new Error('no save in the dialog');
  }
  await act(async () => {
    fireEvent.click(dialogSave);
  });
  expect(mainList[0]).toMatchObject({
    name: 'Sennheiser HD 600 · Harman target',
    source: 'opra',
    ears: 'both',
  });
  expect(mockImportEqText).not.toHaveBeenCalled();
});
