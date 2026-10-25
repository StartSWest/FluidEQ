/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */
import '@testing-library/jest-dom';
import {
  act,
  fireEvent,
  render,
  screen,
  within,
  waitFor,
} from '@testing-library/react';
import type { IMyCurve } from 'common/myCurves';
import MyCurvesPanel from 'renderer/eq/MyCurvesPanel';
import { forgetMyCurvesCache } from 'renderer/eq/myCurvesStore';
import {
  FluidEqProviderWrapper,
  type IFluidEqContext,
} from 'renderer/utils/FluidEqContext';
import defaultFluidEqContext from '__tests__/utils/mockFluidEqProvider';

const TEXT = 'Preamp: -4 dB\nFilter 1: ON LSC Fc 100 Hz Gain 4 dB Q 0.8';
const DRAFT_KEY = 'fluideq.squiglink-import.text';
let mainList: IMyCurve[] = [];
const mockImport = jest.fn();
const mockWrite = jest.fn(async (curves: IMyCurve[]) => {
  mainList = curves;
  return true;
});
jest.mock('renderer/utils/equalizerApi', () => ({
  readMyCurves: async () => mainList,
  writeMyCurves: (curves: IMyCurve[]) => mockWrite(curves),
  importEqText: (...args: unknown[]) => mockImport(...args),
}));
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
const open = async () => {
  await press(screen.getByRole('button', { name: 'Import from Squiglink' }));
  return screen.getByRole('dialog', { name: 'Add a curve' });
};
const enter = (text = TEXT) => {
  fireEvent.change(screen.getByRole('textbox', { name: 'EQ text' }), {
    target: { value: text },
  });
  fireEvent.change(screen.getByRole('textbox', { name: 'Name' }), {
    target: { value: 'Warm reference' },
  });
};
const advanced = async () => {
  const details = document.querySelector<HTMLDetailsElement>(
    '.my-curve-add__advanced',
  );
  if (!details) {
    throw new Error('Missing editable EQ options');
  }
  details.open = true;
  fireEvent(details, new Event('toggle'));
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save and replace EQ' }),
    ).toBeInTheDocument(),
  );
};
beforeEach(() => {
  mainList = [];
  jest.clearAllMocks();
  window.localStorage.clear();
  forgetMyCurvesCache();
  mockImport.mockResolvedValue('Imported');
});

it('keeps the Squiglink shortcut ahead of a growing saved list and opens the shared importer', async () => {
  mainList = Array.from({ length: 30 }, (_, i) => ({
    id: `curve-${i}`,
    name: `Curve ${i}`,
    text: TEXT,
    source: 'file',
    ears: 'both',
    addedAt: i,
  }));
  await show();
  const shortcut = screen.getByRole('button', {
    name: 'Import from Squiglink',
  });
  expect(
    shortcut.compareDocumentPosition(screen.getAllByRole('listitem')[0]),
  ).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
  let dialog = await open();
  expect(
    within(dialog).getByRole('link', { name: 'Open Squiglink' }),
  ).toHaveAttribute('href', 'https://squig.link/');
  await press(within(dialog).getByText('Cancel', { selector: 'button' }));
  await press(screen.getByRole('button', { name: 'Add curve' }));
  dialog = screen.getByRole('dialog', { name: 'Add a curve' });
  expect(
    within(dialog).getByRole('button', { name: 'Paste EQ text' }),
  ).toHaveAttribute('aria-pressed', 'true');
  expect(
    within(dialog).getByText('Your curve preview will appear here'),
  ).toBeInTheDocument();
  expect(mockImport).not.toHaveBeenCalled();
});

it('redraws a valid export as it is edited and clears its path for invalid text', async () => {
  await show();
  await open();
  enter();
  const graph = screen.getByRole('img', {
    name: 'The curve Warm reference, from 20 Hz to 20 kHz',
  });
  const first = graph.querySelector('path')?.getAttribute('d');
  expect(first).toMatch(/^M/);
  expect(first).not.toContain('NaN');
  enter(TEXT.replace('Gain 4', 'Gain -4'));
  expect(graph.querySelector('path')?.getAttribute('d')).not.toBe(first);
  enter('unreadable');
  expect(graph.querySelector('path')).toBeNull();
  expect(
    screen.getByText('Your curve preview will appear here'),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('button', { name: 'Save to My curves' }),
  ).toBeDisabled();
  expect(mockImport).not.toHaveBeenCalled();
});

it('retains the draft from the old Squiglink tab and keeps later edits across closing', async () => {
  localStorage.setItem(DRAFT_KEY, TEXT);
  await show();
  let dialog = await open();
  expect(screen.getByRole('textbox', { name: 'EQ text' })).toHaveValue(TEXT);
  const revised = TEXT.replace('Gain 4', 'Gain 3');
  enter(revised);
  await press(within(dialog).getByText('Cancel', { selector: 'button' }));
  dialog = await open();
  expect(within(dialog).getByRole('textbox', { name: 'EQ text' })).toHaveValue(
    revised,
  );
  expect(mainList).toEqual([]);
  expect(mockImport).not.toHaveBeenCalled();
});

it('saves before applying as a correction and leaves the editable EQ alone', async () => {
  const refreshState = jest.fn();
  await show({ refreshState });
  await open();
  enter();
  await press(screen.getByRole('button', { name: 'Save and apply' }));
  expect(mainList[0]).toMatchObject({
    name: 'Warm reference',
    text: TEXT,
    source: 'squiglink',
  });
  expect(mockImport).toHaveBeenCalledWith(
    TEXT,
    'Warm reference',
    'curve',
    'both',
  );
  expect(mockWrite.mock.invocationCallOrder[0]).toBeLessThan(
    mockImport.mock.invocationCallOrder[0],
  );
  expect(refreshState).toHaveBeenCalledWith({ revealBands: false });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('restores the pasted draft after trying another curve source', async () => {
  localStorage.setItem(DRAFT_KEY, TEXT);
  await show({ preAmp: -2 });
  await open();
  await press(screen.getByRole('button', { name: 'Current EQ' }));
  expect(screen.getByRole('textbox', { name: 'EQ text' })).not.toHaveValue(
    TEXT,
  );
  await press(screen.getByRole('button', { name: 'Paste EQ text' }));
  expect(screen.getByRole('textbox', { name: 'EQ text' })).toHaveValue(TEXT);
  expect(localStorage.getItem(DRAFT_KEY)).toBe(TEXT);
  expect(mockImport).not.toHaveBeenCalled();
});

it('requires confirmation before replacing existing EQ and sends only the chosen ear', async () => {
  await show({ preAmp: -2 });
  await open();
  enter();
  await advanced();
  await press(screen.getByRole('button', { name: 'Left ear' }));
  await press(screen.getByRole('button', { name: 'Save and replace EQ' }));
  expect(mockWrite).not.toHaveBeenCalled();
  expect(mockImport).not.toHaveBeenCalled();
  await press(screen.getByRole('button', { name: 'Replace your bands?' }));
  expect(mockImport).toHaveBeenCalledWith(TEXT, 'Warm reference', 'eq', 'left');
  expect(mainList[0].ears).toBe('left');
});

it('disarms replacement when the input changes', async () => {
  await show({ preAmp: -2 });
  await open();
  enter();
  await advanced();
  await press(screen.getByRole('button', { name: 'Save and replace EQ' }));
  expect(
    screen.getByRole('button', { name: 'Replace your bands?' }),
  ).toBeInTheDocument();
  enter(TEXT.replace('Gain 4', 'Gain 2'));
  await press(screen.getByRole('button', { name: 'Save and replace EQ' }));
  expect(mockImport).not.toHaveBeenCalled();
  expect(mockWrite).not.toHaveBeenCalled();
});

it('uses the same preview and save path for a GraphicEQ file, without playing it', async () => {
  await show();
  await open();
  const graphic =
    'Preamp: -2 dB\nGraphicEQ: 20 3; 100 2; 1000 0; 10000 -2; 20000 -3';
  const file = Object.assign(
    new File([graphic], 'My headphone.txt', { type: 'text/plain' }),
    { text: async () => graphic },
  );
  const input = document.querySelector<HTMLInputElement>('input[type="file"]');
  if (!input) {
    throw new Error('Missing file input');
  }
  await act(async () => {
    fireEvent.change(input, { target: { files: [file] } });
  });
  expect(screen.getByText('GraphicEQ')).toBeInTheDocument();
  expect(
    screen
      .getByRole('img', { name: /The curve My headphone/ })
      .querySelector('path'),
  ).toHaveAttribute('d', expect.stringMatching(/^M/));
  await press(screen.getByRole('button', { name: 'Save to My curves' }));
  expect(mainList[0]).toMatchObject({
    name: 'My headphone',
    text: graphic,
    source: 'file',
  });
  expect(mockImport).not.toHaveBeenCalled();
});

it('does not apply when saving fails and preserves the input for retry', async () => {
  const setGlobalError = jest.fn();
  await show({ setGlobalError });
  await open();
  enter();
  mockWrite.mockRejectedValueOnce(new Error('Disk full'));
  await press(screen.getByRole('button', { name: 'Save and apply' }));
  expect(mockImport).not.toHaveBeenCalled();
  expect(mainList).toEqual([]);
  expect(screen.getByRole('textbox', { name: 'EQ text' })).toHaveValue(TEXT);
  expect(setGlobalError).toHaveBeenCalledWith(new Error('Disk full'));
});
