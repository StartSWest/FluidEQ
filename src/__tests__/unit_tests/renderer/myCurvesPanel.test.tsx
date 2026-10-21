/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AutoEqFormat } from 'common/constants';
import MyCurvesPanel from 'renderer/eq/MyCurvesPanel';
import {
  addMyCurve,
  forgetMyCurvesCache,
  getMyCurves,
} from 'renderer/eq/myCurvesStore';
import {
  FluidEqProviderWrapper,
  type IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

const mockImportEqText = jest.fn();

jest.mock('renderer/utils/equalizerApi', () => ({
  importEqText: (...args: unknown[]) => mockImportEqText(...args),
  exportCurveList: jest.fn(),
  exportCurveFolder: jest.fn(),
}));

const WARM = 'Preamp: -4 dB\nFilter 1: ON LSC Fc 100 Hz Gain 4 dB Q 0.8';
const LEFT = 'Filter 1: ON PK Fc 1800 Hz Gain -2.5 dB Q 3';

const seed = () => {
  addMyCurve({
    name: 'Alpha left',
    text: LEFT,
    source: 'squiglink',
    ears: 'left',
  });
  addMyCurve({ name: 'Zeta warm', text: WARM, source: 'file', ears: 'both' });
};

const show = (over: Partial<IFluidEqContext> = {}) =>
  render(
    <FluidEqProviderWrapper value={{ ...defaultFluidEqContext, ...over }}>
      <MyCurvesPanel />
    </FluidEqProviderWrapper>,
  );

const rowOf = (name: string) => {
  const row = screen.getByText(name).closest('li');
  if (!row) {
    throw new Error(`no row for ${name}`);
  }
  return within(row);
};

beforeEach(() => {
  jest.clearAllMocks();
  window.localStorage.clear();
  forgetMyCurvesCache();
  mockImportEqText.mockResolvedValue('Imported');
});

it('says how to start when there is nothing kept, and offers no export of nothing', () => {
  show();
  expect(screen.getByText('No curves of your own yet')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export list' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add curve' })).toBeEnabled();
});

it('lists the newest first, A–Z on request, and finds by name', () => {
  seed();
  show();
  const names = () =>
    screen
      .getAllByRole('listitem')
      .map((item) => item.querySelector('strong')?.textContent);
  expect(names()).toEqual(['Zeta warm', 'Alpha left']);
  fireEvent.click(screen.getByRole('button', { name: 'A–Z' }));
  expect(screen.getByRole('button', { name: 'A–Z' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  expect(names()).toEqual(['Alpha left', 'Zeta warm']);
  fireEvent.click(screen.getByRole('button', { name: 'Recent' }));
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search your curves' }),
    {
      target: { value: 'ZETA' },
    },
  );
  expect(names()).toEqual(['Zeta warm']);
  fireEvent.change(
    screen.getByRole('searchbox', { name: 'Search your curves' }),
    {
      target: { value: 'nothing like it' },
    },
  );
  expect(
    screen.getByText('No curve has that in its name.'),
  ).toBeInTheDocument();
});

it('plays a curve as the headphone correction, for both ears, under its own name', async () => {
  seed();
  const refreshState = jest.fn().mockResolvedValue(undefined);
  show({ refreshState });
  await act(async () => {
    fireEvent.click(
      rowOf('Alpha left').getByRole('button', { name: 'Apply as curve' }),
    );
  });
  expect(mockImportEqText).toHaveBeenCalledWith(
    LEFT,
    'Alpha left',
    'curve',
    'both',
  );
  expect(refreshState).toHaveBeenCalledWith({ revealBands: false });
});

it('replaces the bands only on a second press, into the ears the curve was kept for', async () => {
  seed();
  const refreshState = jest.fn().mockResolvedValue(undefined);
  show({ refreshState });
  const row = rowOf('Alpha left');
  fireEvent.click(row.getByRole('button', { name: 'Apply as EQ' }));
  expect(mockImportEqText).not.toHaveBeenCalled();
  await act(async () => {
    fireEvent.click(row.getByRole('button', { name: 'Replace your bands?' }));
  });
  expect(mockImportEqText).toHaveBeenCalledWith(
    LEFT,
    'Alpha left',
    'eq',
    'left',
  );
  expect(refreshState).toHaveBeenCalledWith({ revealBands: true });
});

it('forgets a first press once the person clicks elsewhere, or presses Escape', () => {
  seed();
  show();
  const row = rowOf('Alpha left');
  fireEvent.click(row.getByRole('button', { name: 'Apply as EQ' }));
  fireEvent.click(document.body);
  fireEvent.click(row.getByRole('button', { name: 'Apply as EQ' }));
  fireEvent.keyDown(row.getByRole('button', { name: 'Replace your bands?' }), {
    key: 'Escape',
  });
  expect(row.getByRole('button', { name: 'Apply as EQ' })).toBeInTheDocument();
  expect(mockImportEqText).not.toHaveBeenCalled();

  fireEvent.click(row.getByRole('button', { name: 'More for Alpha left' }));
  expect(screen.getByRole('menu')).toBeInTheDocument();
  fireEvent.click(document.body);
  expect(screen.queryByRole('menu')).not.toBeInTheDocument();
});

it('marks the curve the correction layer is playing, by its text', () => {
  seed();
  show({
    headphone: {
      filters: {},
      intensity: 1,
      eqImport: {
        source: 'squiglink',
        sourceUrl: '',
        label: 'renamed elsewhere',
        eqFormat: AutoEqFormat.PARAMETRIC,
        filterCount: 1,
        text: WARM,
      },
    },
  });
  expect(
    rowOf('Zeta warm').getByRole('button', { name: 'Playing' }),
  ).toBeDisabled();
  expect(
    rowOf('Alpha left').getByRole('button', { name: 'Apply as curve' }),
  ).toBeEnabled();
});

it('renames in place, duplicates, and deletes only on a second press', () => {
  seed();
  show();
  const openMenu = () =>
    fireEvent.click(screen.getByRole('button', { name: 'More for Zeta warm' }));

  openMenu();
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
  const field = screen.getByRole('textbox', { name: 'Rename' });
  fireEvent.change(field, { target: { value: 'Warm for nights' } });
  fireEvent.keyDown(field, { key: 'Enter' });
  expect(screen.getByText('Warm for nights')).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: 'More for Warm for nights' }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: 'Duplicate' }));
  expect(screen.getByText('Warm for nights (2)')).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: 'More for Warm for nights (2)' }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(getMyCurves()).toHaveLength(3);
  fireEvent.click(
    screen.getByRole('menuitem', { name: 'Press again to delete' }),
  );
  expect(screen.queryByText('Warm for nights (2)')).not.toBeInTheDocument();
  expect(getMyCurves()).toHaveLength(2);
});

it('keeps a pasted curve from Add, named, without playing it', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Add curve' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'ParametricEQ text' }), {
    target: { value: WARM },
  });
  expect(screen.getByText('Read: 1 bands, preamp -4.0 dB')).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Aria warm' },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Save to My curves' }));
  expect(mockImportEqText).not.toHaveBeenCalled();
  expect(screen.getByText('Aria warm')).toBeInTheDocument();
  expect(getMyCurves()[0]).toMatchObject({ name: 'Aria warm', text: WARM });
});

it('offers no save for text that holds no curve', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: 'Add curve' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'ParametricEQ text' }), {
    target: { value: 'hello' },
  });
  expect(
    screen.getByText(
      'No curve in this text yet. Paste a ParametricEQ or GraphicEQ export.',
    ),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Save to My curves' }),
  ).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Save and apply as curve' }),
  ).toBeDisabled();
});
