/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AutoEqFormat, FilterTypeEnum, type IFilter } from 'common/constants';
import type { IMyCurve } from 'common/myCurves';
import MyCurvesPanel from 'renderer/eq/MyCurvesPanel';
import { forgetMyCurvesCache, getMyCurves } from 'renderer/eq/myCurvesStore';
import {
  FluidEqProviderWrapper,
  type IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

const mockImportEqText = jest.fn();
let mainList: IMyCurve[] = [];
const mockRead = jest.fn(async () => mainList);
const mockWrite = jest.fn(async (list: IMyCurve[]) => {
  mainList = list;
  return true;
});

jest.mock('renderer/utils/equalizerApi', () => ({
  importEqText: (...args: unknown[]) => mockImportEqText(...args),
  readMyCurves: () => mockRead(),
  writeMyCurves: (list: IMyCurve[]) => mockWrite(list),
  exportCurveList: jest.fn(),
  exportCurveFolder: jest.fn(),
}));

const WARM = 'Preamp: -4 dB\nFilter 1: ON LSC Fc 100 Hz Gain 4 dB Q 0.8';
const LEFT = 'Filter 1: ON PK Fc 1800 Hz Gain -2.5 dB Q 3';

const kept = (
  id: string,
  name: string,
  text: string,
  over: Partial<IMyCurve> = {},
): IMyCurve => ({
  id,
  name,
  text,
  source: 'file',
  ears: 'both',
  addedAt: 1_790_000_000_000,
  ...over,
});

// Main's list, newest first: Zeta was kept after Alpha.
const seed = () => {
  mainList = [
    kept('z', 'Zeta warm', WARM),
    kept('a', 'Alpha left', LEFT, { source: 'squiglink', ears: 'left' }),
  ];
};

const show = async (over: Partial<IFluidEqContext> = {}) => {
  const view = render(
    <FluidEqProviderWrapper value={{ ...defaultFluidEqContext, ...over }}>
      <MyCurvesPanel />
    </FluidEqProviderWrapper>,
  );
  await act(async () => undefined);
  return view;
};

const press = async (element: HTMLElement) => {
  await act(async () => {
    fireEvent.click(element);
  });
};

const rowOf = (name: string) => {
  const row = screen.getByText(name).closest('li');
  if (!row) {
    throw new Error(`no row for ${name}`);
  }
  return within(row);
};

beforeEach(() => {
  mainList = [];
  jest.clearAllMocks();
  window.localStorage.clear();
  forgetMyCurvesCache();
  mockImportEqText.mockResolvedValue('Imported');
});

it('says nothing until main has answered, then how to start when nothing is kept', async () => {
  let answer: (list: IMyCurve[]) => void = () => undefined;
  mockRead.mockImplementationOnce(
    () =>
      new Promise<IMyCurve[]>((resolve) => {
        answer = resolve;
      }),
  );
  render(
    <FluidEqProviderWrapper value={defaultFluidEqContext}>
      <MyCurvesPanel />
    </FluidEqProviderWrapper>,
  );
  expect(
    screen.queryByText('No curves of your own yet'),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add curve' })).toBeDisabled();
  await act(async () => answer([]));
  expect(screen.getByText('No curves of your own yet')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Export list' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Add curve' })).toBeEnabled();
});

it('says so when main cannot read the list, and reads it again on Try again', async () => {
  seed();
  mockRead.mockRejectedValueOnce(new Error('locked'));
  await show();
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Your curves could not be read',
  );
  expect(screen.getByRole('button', { name: 'Add curve' })).toBeDisabled();
  await press(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByText('Zeta warm')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
});

it('lists the newest first, A–Z on request, and finds by name', async () => {
  seed();
  await show();
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
  const search = screen.getByRole('searchbox', { name: 'Search your curves' });
  fireEvent.change(search, { target: { value: 'ZETA' } });
  expect(names()).toEqual(['Zeta warm']);
  fireEvent.change(search, { target: { value: 'nothing like it' } });
  expect(
    screen.getByText('No curve has that in its name.'),
  ).toBeInTheDocument();
});

it('plays a curve as the headphone correction, for both ears, under its own name', async () => {
  seed();
  const refreshState = jest.fn().mockResolvedValue(undefined);
  await show({ refreshState });
  await press(
    rowOf('Alpha left').getByRole('button', { name: 'Apply as curve' }),
  );
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
  await show({ refreshState });
  const row = rowOf('Alpha left');
  fireEvent.click(row.getByRole('button', { name: 'Apply as EQ' }));
  expect(mockImportEqText).not.toHaveBeenCalled();
  await press(row.getByRole('button', { name: 'Replace your bands?' }));
  expect(mockImportEqText).toHaveBeenCalledWith(
    LEFT,
    'Alpha left',
    'eq',
    'left',
  );
  expect(refreshState).toHaveBeenCalledWith({ revealBands: true });
});

it('forgets a first press once the person clicks elsewhere, or presses Escape', async () => {
  seed();
  await show();
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

it('marks the curve the correction layer is playing, by its text', async () => {
  seed();
  await show({
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

it('renames in place, duplicates, and deletes only on a second press', async () => {
  seed();
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'More for Zeta warm' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Rename' }));
  const field = screen.getByRole('textbox', { name: 'Rename' });
  fireEvent.change(field, { target: { value: 'Warm for nights' } });
  await act(async () => {
    fireEvent.keyDown(field, { key: 'Enter' });
  });
  expect(screen.getByText('Warm for nights')).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: 'More for Warm for nights' }),
  );
  await press(screen.getByRole('menuitem', { name: 'Duplicate' }));
  expect(screen.getByText('Warm for nights (2)')).toBeInTheDocument();

  fireEvent.click(
    screen.getByRole('button', { name: 'More for Warm for nights (2)' }),
  );
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  expect(getMyCurves()).toHaveLength(3);
  await press(screen.getByRole('menuitem', { name: 'Press again to delete' }));
  expect(screen.queryByText('Warm for nights (2)')).not.toBeInTheDocument();
  expect(mainList).toHaveLength(2);
});

it('puts a deleted curve back, and says why, when main cannot keep the change', async () => {
  seed();
  const setGlobalError = jest.fn();
  await show({ setGlobalError });
  mockWrite.mockRejectedValueOnce(new Error('disk full'));
  fireEvent.click(screen.getByRole('button', { name: 'More for Zeta warm' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Delete' }));
  await press(screen.getByRole('menuitem', { name: 'Press again to delete' }));
  expect(setGlobalError).toHaveBeenCalledWith(new Error('disk full'));
  expect(screen.getByText('Zeta warm')).toBeInTheDocument();
});

it('edits a curve’s bands, name and ears from its menu', async () => {
  seed();
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'More for Zeta warm' }));
  fireEvent.click(screen.getByRole('menuitem', { name: 'Edit bands' }));
  const text = screen.getByRole('textbox', { name: 'ParametricEQ text' });
  expect(text).toHaveValue(WARM);
  fireEvent.change(text, { target: { value: LEFT } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Zeta, edited' },
  });
  await press(screen.getByRole('button', { name: 'Save changes' }));
  expect(mainList[0]).toMatchObject({
    id: 'z',
    name: 'Zeta, edited',
    text: LEFT,
    source: 'file',
  });
  expect(screen.getByText('Zeta, edited')).toBeInTheDocument();
});

it('keeps a pasted curve from Add, named, without playing it, and names the lines it could not read', async () => {
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'Add curve' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'ParametricEQ text' }), {
    target: { value: `${WARM}\nChannel: L\nFilter 2: ON XYZ Fc 9 Hz Q 1` },
  });
  expect(screen.getByText('Read: 1 bands, preamp -4.0 dB')).toBeInTheDocument();
  expect(
    screen.getByText('Lines not read, so not in the curve: 3, 4'),
  ).toBeInTheDocument();
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Aria warm' },
  });
  await press(screen.getByRole('button', { name: 'Save to My curves' }));
  expect(mockImportEqText).not.toHaveBeenCalled();
  expect(screen.getByText('Aria warm')).toBeInTheDocument();
  expect(mainList[0]).toMatchObject({ name: 'Aria warm', source: 'squiglink' });
});

it('takes My EQ as it plays: the bands on both ears, flat ones and one-ear ones left out and said', async () => {
  const band = (id: string, over: Partial<IFilter>): IFilter => ({
    id,
    frequency: 1000,
    gain: 0,
    quality: 1,
    type: FilterTypeEnum.PK,
    ...over,
  });
  await show({
    preAmp: -2,
    filters: {
      a: band('a', { frequency: 100, gain: 3 }),
      b: band('b', { frequency: 1000, gain: 0 }),
      c: band('c', { frequency: 4000, gain: -2, channel: 'left' }),
    },
  });
  fireEvent.click(screen.getByRole('button', { name: 'Add curve' }));
  fireEvent.click(screen.getByRole('button', { name: /^My EQ now/ }));
  const text = screen.getByRole('textbox', { name: 'ParametricEQ text' });
  expect(text).toHaveValue(
    'Preamp: -2 dB\nFilter 1: ON PK Fc 100 Hz Gain 3 dB Q 1',
  );
  expect(text).toHaveAttribute('readonly');
  expect(
    screen.getByText(
      'Bands kept to one ear are left out: 1. Choose Left ear or Right ear to keep them.',
    ),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Left ear' }));
  expect(text).toHaveValue(
    'Preamp: -2 dB\nFilter 1: ON PK Fc 100 Hz Gain 3 dB Q 1\nFilter 2: ON PK Fc 4000 Hz Gain -2 dB Q 1',
  );
  await press(screen.getByRole('button', { name: 'Save to My curves' }));
  expect(mainList[0]).toMatchObject({ source: 'eq', ears: 'left' });
  expect(mainList[0].name).toMatch(/^My EQ, /);
});

it('offers no save for text that holds no curve', async () => {
  await show();
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

it('says the list is full, and offers no save, at the limit', async () => {
  mainList = Array.from({ length: 500 }, (_, index) =>
    kept(`c${index}`, `Curve ${index}`, WARM),
  );
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'Add curve' }));
  fireEvent.change(screen.getByRole('textbox', { name: 'ParametricEQ text' }), {
    target: { value: WARM },
  });
  expect(screen.getByRole('alert')).toHaveTextContent(
    'My curves holds up to 500 curves and is full.',
  );
  expect(
    screen.getByRole('button', { name: 'Save to My curves' }),
  ).toBeDisabled();
});

it('cannot take a copy from OPRA while none of its corrections plays', async () => {
  await show();
  fireEvent.click(screen.getByRole('button', { name: 'Add curve' }));
  expect(screen.getByRole('button', { name: /^From OPRA/ })).toBeDisabled();
});
