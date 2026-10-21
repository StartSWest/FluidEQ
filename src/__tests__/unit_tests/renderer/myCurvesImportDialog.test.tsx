/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { toCurveListFile, type IMyCurve } from 'common/myCurves';
import MyCurvesImportDialog from 'renderer/eq/MyCurvesImportDialog';
import {
  forgetMyCurvesCache,
  getMyCurves,
  retryMyCurves,
} from 'renderer/eq/myCurvesStore';
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

const WARM = 'Preamp: -4 dB\nFilter 1: ON LSC Fc 100 Hz Gain 4 dB Q 0.8';
const BRIGHT = 'Filter 1: ON HSC Fc 8000 Hz Gain 3 dB Q 0.7';

const kept = (id: string, name: string): IMyCurve => ({
  id,
  name,
  text: WARM,
  source: 'file',
  ears: 'both',
  addedAt: 1_790_000_000_000,
});

beforeEach(async () => {
  mainList = [];
  jest.clearAllMocks();
  forgetMyCurvesCache();
});

/** The dialog opens from a tab that has already read the list. */
const open = async (over: Partial<IFluidEqContext> = {}) => {
  await act(async () => {
    await retryMyCurves();
  });
  const onClose = jest.fn();
  render(
    <FluidEqProviderWrapper value={{ ...defaultFluidEqContext, ...over }}>
      <MyCurvesImportDialog onClose={onClose} />
    </FluidEqProviderWrapper>,
  );
  return onClose;
};

// The jsdom these tests run in has no `Blob.text()`, which every Chromium
// FluidEQ runs in has; each test file carries its own reader.
const textFile = (contents: string, name: string) => {
  const file = new File([contents], name);
  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve(contents),
  });
  return file;
};

const listFile = (entries: Array<{ name: string; text?: string }>) =>
  textFile(
    JSON.stringify({
      format: 'fluideq-curves',
      version: 1,
      curves: entries.map(({ name, text = BRIGHT }) => ({
        name,
        text,
        source: 'squiglink',
        ears: 'both',
      })),
    }),
    'From a friend.fqcurves',
  );

const choose = async (...files: File[]) => {
  const input = document.querySelector('input[type="file"]');
  if (!input) {
    throw new Error('no file input');
  }
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
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

it('shows every curve before adding any, and adds them on Import', async () => {
  const onClose = await open();
  await choose(
    textFile(
      toCurveListFile([
        { ...kept('1', 'One'), text: BRIGHT },
        { ...kept('2', 'Two'), text: BRIGHT },
      ]),
      'From a friend.fqcurves',
    ),
  );
  expect(mockWrite).not.toHaveBeenCalled();
  expect(screen.getByText('From From a friend.fqcurves')).toBeInTheDocument();
  // The keyboard lands on the next thing to press, not out of the dialog.
  expect(screen.getByRole('button', { name: 'Import (2)' })).toHaveFocus();
  await press(screen.getByRole('button', { name: 'Import (2)' }));
  expect(mainList.map((curve) => curve.name).sort()).toEqual(['One', 'Two']);
  expect(onClose).toHaveBeenCalled();
});

it('never overwrites a kept name quietly: keep both numbers it, replace swaps it, skip leaves it', async () => {
  mainList = [kept('w', 'Warm'), kept('n', 'Night'), kept('d', 'Day')];
  await open();
  await choose(
    listFile([
      { name: 'Warm' },
      { name: 'Night' },
      { name: 'Day' },
      { name: 'Fresh' },
    ]),
  );

  expect(rowOf('Fresh').getByText('New')).toBeInTheDocument();
  expect(
    rowOf('Warm').getByText('You already have a curve with this name'),
  ).toBeInTheDocument();
  // Keep both is what a clash starts as.
  expect(
    rowOf('Warm').getByRole('button', { name: 'Keep both' }),
  ).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(rowOf('Night').getByRole('button', { name: 'Replace' }));
  fireEvent.click(rowOf('Day').getByRole('button', { name: 'Skip' }));
  await press(screen.getByRole('button', { name: 'Import (3)' }));

  const byName = new Map(mainList.map((curve) => [curve.name, curve]));
  expect([...byName.keys()].sort()).toEqual([
    'Day',
    'Fresh',
    'Night',
    'Warm',
    'Warm (2)',
  ]);
  expect(byName.get('Warm')).toMatchObject({ id: 'w', text: WARM });
  expect(byName.get('Warm (2)')?.text).toBe(BRIGHT);
  expect(byName.get('Night')).toMatchObject({ id: 'n', text: BRIGHT });
  expect(byName.get('Day')?.text).toBe(WARM);
});

it('names every entry and file it leaves out, its place standing in for a missing name', async () => {
  await open();
  await choose(
    listFile([
      { name: 'Good' },
      { name: '', text: 'nothing' },
      { name: 'Broken', text: 'garbage' },
    ]),
    textFile(WARM, 'Aria warm.txt'),
    textFile('just words', 'notes.txt'),
  );
  expect(screen.getByText('Aria warm')).toBeInTheDocument();
  expect(
    screen.getByText('Left out, holding no curve: #2, Broken, notes.txt'),
  ).toBeInTheDocument();
  await press(screen.getByRole('button', { name: 'Import (2)' }));
  expect(mainList.find((curve) => curve.name === 'Aria warm')).toMatchObject({
    source: 'file',
    text: WARM,
  });
});

it('spells out six names of what was left out, and counts the rest', async () => {
  await open();
  await choose(
    listFile([
      { name: 'Kept' },
      ...['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((name) => ({
        name,
        text: 'none',
      })),
    ]),
  );
  expect(
    screen.getByText('Left out, holding no curve: A, B, C, D, E, F and 2 more'),
  ).toBeInTheDocument();
});

it('says how many fit when the list is nearly full, and imports only those', async () => {
  mainList = Array.from({ length: 499 }, (_, index) =>
    kept(`c${index}`, `Curve ${index}`),
  );
  await open();
  await choose(listFile([{ name: 'One' }, { name: 'Two' }, { name: 'Three' }]));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'My curves holds 500. There is room for 1 of these; the other 2 stay out.',
  );
  await press(screen.getByRole('button', { name: 'Import (1)' }));
  expect(mainList).toHaveLength(500);
});

it('keeps the dialog open and says why when main cannot keep the import', async () => {
  const setGlobalError = jest.fn();
  const onClose = await open({ setGlobalError });
  mockWrite.mockRejectedValueOnce(new Error('disk full'));
  await choose(listFile([{ name: 'One' }]));
  await press(screen.getByRole('button', { name: 'Import (1)' }));
  expect(setGlobalError).toHaveBeenCalledWith(new Error('disk full'));
  expect(onClose).not.toHaveBeenCalled();
  expect(getMyCurves()).toHaveLength(0);
});

it('says so, and imports nothing, when no chosen file holds a curve', async () => {
  await open();
  await choose(textFile('{}', 'empty.json'));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Those files hold no curve FluidEQ can read.',
  );
  expect(
    screen.getByText('Left out, holding no curve: empty.json'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Import (0)' })).toBeDisabled();
});
