/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import type { IMyCurve } from 'common/myCurves';
import {
  addMyCurve,
  duplicateMyCurve,
  forgetMyCurvesCache,
  getMyCurves,
  importMyCurves,
  removeMyCurve,
  renameMyCurve,
  retryMyCurves,
  updateMyCurve,
} from 'renderer/eq/myCurvesStore';

// Main, as far as the store can tell: the list it keeps, and whether it
// manages to keep the next one.
let mainList: IMyCurve[] = [];
const mockRead = jest.fn(async () => mainList);
const mockWrite = jest.fn(async (list: IMyCurve[]) => {
  mainList = list;
  return true;
});

jest.mock('renderer/utils/equalizerApi', () => ({
  readMyCurves: () => mockRead(),
  writeMyCurves: (list: IMyCurve[]) => mockWrite(list),
}));

const LEFT_IN_WINDOW = 'fluideq.myCurves.v1';
const TEXT = 'Preamp: -3 dB\nFilter 1: ON PK Fc 100 Hz Gain 3 dB Q 1';
const OTHER = 'Filter 1: ON PK Fc 5000 Hz Gain -2 dB Q 2';

beforeEach(() => {
  mainList = [];
  jest.clearAllMocks();
  window.localStorage.clear();
  forgetMyCurvesCache();
});

const draft = (name: string, text = TEXT) => ({
  name,
  text,
  source: 'squiglink' as const,
  ears: 'both' as const,
});

const names = () => getMyCurves().map((curve) => curve.name);

it('keeps a curve at the top, written to main whole', async () => {
  await addMyCurve(draft('First'));
  await addMyCurve(draft('Second'));
  expect(names()).toEqual(['Second', 'First']);
  expect(mainList.map((curve) => curve.name)).toEqual(['Second', 'First']);
  forgetMyCurvesCache();
  await addMyCurve(draft('Third'));
  expect(names()).toEqual(['Third', 'Second', 'First']);
});

it('keeps nothing, and writes nothing, for text that holds no curve', async () => {
  expect(await addMyCurve(draft('Nothing', 'hello'))).toBeUndefined();
  expect(getMyCurves()).toHaveLength(0);
  expect(mockWrite).not.toHaveBeenCalled();
});

it('numbers a name already taken instead of refusing it', async () => {
  await addMyCurve(draft('HD 600'));
  await addMyCurve(draft('hd 600'));
  expect(names()).toEqual(['hd 600 (2)', 'HD 600']);
});

it('runs quick changes one after another, each from the list the one before left', async () => {
  await Promise.all([
    addMyCurve(draft('One')),
    addMyCurve(draft('Two')),
    addMyCurve(draft('Three')),
  ]);
  expect(names()).toEqual(['Three', 'Two', 'One']);
  expect(mainList).toHaveLength(3);
});

it('takes a change back, and says why, when main cannot keep it', async () => {
  await addMyCurve(draft('Kept'));
  mockWrite.mockRejectedValueOnce(new Error('disk full'));
  await expect(addMyCurve(draft('Lost'))).rejects.toThrow('disk full');
  expect(names()).toEqual(['Kept']);
  await addMyCurve(draft('Next'));
  expect(names()).toEqual(['Next', 'Kept']);
});

it('changes nothing while main cannot read the list, and reads it again on a retry', async () => {
  mainList = [
    {
      id: 'a',
      name: 'On disk',
      text: TEXT,
      source: 'file',
      ears: 'both',
      addedAt: 1,
    },
  ];
  mockRead.mockRejectedValueOnce(new Error('locked'));
  await expect(addMyCurve(draft('Too soon'))).rejects.toThrow('locked');
  expect(mockWrite).not.toHaveBeenCalled();
  await retryMyCurves();
  expect(names()).toEqual(['On disk']);
});

it('renames, numbering a name another curve holds, and ignores an empty one', async () => {
  const first = await addMyCurve(draft('A'));
  await addMyCurve(draft('B'));
  await renameMyCurve(first?.id ?? '', 'B');
  expect(getMyCurves().find((curve) => curve.id === first?.id)?.name).toBe(
    'B (2)',
  );
  mockWrite.mockClear();
  await renameMyCurve(first?.id ?? '', '   ');
  expect(mockWrite).not.toHaveBeenCalled();
});

it('edits a curve in place: name, bands and ears, its place and source kept', async () => {
  const kept = await addMyCurve(draft('Warm'));
  await addMyCurve(draft('Top'));
  await updateMyCurve(kept?.id ?? '', {
    name: 'Warmer',
    text: OTHER,
    ears: 'left',
  });
  expect(getMyCurves()[1]).toMatchObject({
    id: kept?.id,
    name: 'Warmer',
    text: OTHER,
    ears: 'left',
    source: 'squiglink',
  });
  expect(
    await updateMyCurve(kept?.id ?? '', {
      name: 'x',
      text: 'no curve',
      ears: 'both',
    }),
  ).toBeUndefined();
});

it('duplicates right under the curve, and removes', async () => {
  const kept = await addMyCurve(draft('Warm'));
  await addMyCurve(draft('Top'));
  const copy = await duplicateMyCurve(kept?.id ?? '');
  expect(names()).toEqual(['Top', 'Warm', 'Warm (2)']);
  await removeMyCurve(copy?.id ?? '');
  expect(names()).toEqual(['Top', 'Warm']);
});

it('imports at once: a replaced curve keeps its place and name, the rest come in numbered on top', async () => {
  const kept = await addMyCurve(draft('Warm'));
  const outcome = await importMyCurves([
    { curve: draft('Warm', OTHER), replaces: kept?.id },
    { curve: draft('Warm', OTHER) },
    { curve: draft('Broken', 'nothing') },
  ]);
  expect(outcome).toEqual({ added: 1, replaced: 1, refused: 0 });
  expect(names()).toEqual(['Warm (2)', 'Warm']);
  expect(getMyCurves()[1]).toMatchObject({ id: kept?.id, text: OTHER });
});

it('says how many did not fit in a full list instead of dropping them quietly', async () => {
  mainList = Array.from({ length: 499 }, (_, index) => ({
    id: `c${index}`,
    name: `Curve ${index}`,
    text: TEXT,
    source: 'file' as const,
    ears: 'both' as const,
    addedAt: index,
  }));
  const outcome = await importMyCurves([
    { curve: draft('Fits') },
    { curve: draft('Does not') },
    { curve: draft('Nor this') },
  ]);
  expect(outcome).toEqual({ added: 1, replaced: 0, refused: 2 });
  expect(getMyCurves()).toHaveLength(500);
  expect(await addMyCurve(draft('Full'))).toBeUndefined();
});

it('hands main a list the first 2.1 builds left in the window, once, then forgets it', async () => {
  window.localStorage.setItem(
    LEFT_IN_WINDOW,
    JSON.stringify([
      { id: 'a', name: 'Good', text: TEXT, source: 'file', ears: 'left' },
      { id: 'b', name: 'Bad', text: 'nope' },
      7,
    ]),
  );
  await addMyCurve(draft('New'));
  expect(names()).toEqual(['New', 'Good']);
  expect(mainList.map((curve) => curve.name)).toEqual(['New', 'Good']);
  expect(window.localStorage.getItem(LEFT_IN_WINDOW)).toBeNull();
});

it('keeps main’s own list over one left in the window', async () => {
  mainList = [
    {
      id: 'm',
      name: 'From main',
      text: TEXT,
      source: 'file',
      ears: 'both',
      addedAt: 1,
    },
  ];
  window.localStorage.setItem(
    LEFT_IN_WINDOW,
    JSON.stringify([{ id: 'a', name: 'Old', text: TEXT }]),
  );
  await retryMyCurves();
  expect(names()).toEqual(['From main']);
  expect(window.localStorage.getItem(LEFT_IN_WINDOW)).toBeNull();
});
