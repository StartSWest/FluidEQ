/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import '@testing-library/jest-dom';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { toCurveListFile } from 'common/myCurves';
import MyCurvesImportDialog from 'renderer/eq/MyCurvesImportDialog';
import {
  addMyCurve,
  forgetMyCurvesCache,
  getMyCurves,
} from 'renderer/eq/myCurvesStore';

const WARM = 'Preamp: -4 dB\nFilter 1: ON LSC Fc 100 Hz Gain 4 dB Q 0.8';
const BRIGHT = 'Filter 1: ON HSC Fc 8000 Hz Gain 3 dB Q 0.7';

beforeEach(() => {
  window.localStorage.clear();
  forgetMyCurvesCache();
});

// The jsdom these tests run in has no `Blob.text()`, which every Chromium
// FluidEQ runs in has; each test file carries its own reader.
const textFile = (contents: string, name: string) => {
  const file = new File([contents], name);
  Object.defineProperty(file, 'text', {
    value: () => Promise.resolve(contents),
  });
  return file;
};

const listFile = (names: string[], text = BRIGHT) =>
  textFile(
    toCurveListFile(
      names.map((name, index) => ({
        id: String(index),
        name,
        text,
        source: 'squiglink',
        ears: 'both',
        addedAt: 1_790_000_000_000,
      })),
    ),
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

const rowOf = (name: string) => {
  const row = screen.getByText(name).closest('li');
  if (!row) {
    throw new Error(`no row for ${name}`);
  }
  return within(row);
};

it('shows every curve before adding any, and adds them on Import', async () => {
  const onClose = jest.fn();
  render(<MyCurvesImportDialog onClose={onClose} />);
  await choose(listFile(['One', 'Two']));
  expect(getMyCurves()).toHaveLength(0);
  expect(screen.getByText('From From a friend.fqcurves')).toBeInTheDocument();
  // The keyboard lands on the next thing to press, not out of the dialog.
  expect(screen.getByRole('button', { name: 'Import (2)' })).toHaveFocus();
  fireEvent.click(screen.getByRole('button', { name: 'Import (2)' }));
  expect(
    getMyCurves()
      .map((curve) => curve.name)
      .sort(),
  ).toEqual(['One', 'Two']);
  expect(onClose).toHaveBeenCalled();
});

it('never overwrites a kept name quietly: keep both numbers it, replace swaps it, skip leaves it', async () => {
  const kept = addMyCurve({
    name: 'Warm',
    text: WARM,
    source: 'file',
    ears: 'both',
  });
  addMyCurve({ name: 'Night', text: WARM, source: 'file', ears: 'both' });
  addMyCurve({ name: 'Day', text: WARM, source: 'file', ears: 'both' });
  render(<MyCurvesImportDialog onClose={jest.fn()} />);
  await choose(listFile(['Warm', 'Night', 'Day', 'Fresh']));

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
  fireEvent.click(screen.getByRole('button', { name: 'Import (3)' }));

  const byName = new Map(getMyCurves().map((curve) => [curve.name, curve]));
  expect([...byName.keys()].sort()).toEqual([
    'Day',
    'Fresh',
    'Night',
    'Warm',
    'Warm (2)',
  ]);
  expect(byName.get('Warm')).toMatchObject({ id: kept?.id, text: WARM });
  expect(byName.get('Warm (2)')?.text).toBe(BRIGHT);
  expect(byName.get('Night')?.text).toBe(BRIGHT);
  expect(byName.get('Day')?.text).toBe(WARM);
});

it('reads a ParametricEQ .txt as one curve named after its file, and counts what holds none', async () => {
  render(<MyCurvesImportDialog onClose={jest.fn()} />);
  await choose(
    textFile(WARM, 'Aria warm.txt'),
    textFile('just words', 'notes.txt'),
  );
  expect(screen.getByText('Aria warm')).toBeInTheDocument();
  expect(
    screen.getByText('Entries left out because they held no curve: 1'),
  ).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Import (1)' }));
  expect(getMyCurves()[0]).toMatchObject({
    name: 'Aria warm',
    source: 'file',
    text: WARM,
  });
});

it('says so, and imports nothing, when no chosen file holds a curve', async () => {
  render(<MyCurvesImportDialog onClose={jest.fn()} />);
  await choose(textFile('{}', 'empty.json'));
  expect(screen.getByRole('alert')).toHaveTextContent(
    'Those files hold no curve FluidEQ can read.',
  );
  expect(screen.getByRole('button', { name: 'Import (0)' })).toBeDisabled();
});
