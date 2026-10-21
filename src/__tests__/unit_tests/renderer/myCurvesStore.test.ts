/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import {
  addMyCurve,
  duplicateMyCurve,
  forgetMyCurvesCache,
  getMyCurves,
  importMyCurves,
  removeMyCurve,
  renameMyCurve,
} from 'renderer/eq/myCurvesStore';

const KEY = 'fluideq.myCurves.v1';
const TEXT = 'Preamp: -3 dB\nFilter 1: ON PK Fc 100 Hz Gain 3 dB Q 1';
const OTHER = 'Filter 1: ON PK Fc 5000 Hz Gain -2 dB Q 2';

beforeEach(() => {
  window.localStorage.clear();
  forgetMyCurvesCache();
});

const draft = (name: string, text = TEXT) => ({
  name,
  text,
  source: 'squiglink' as const,
  ears: 'both' as const,
});

it('keeps a curve at the top, and keeps it in storage for the next start', () => {
  addMyCurve(draft('First'));
  addMyCurve(draft('Second'));
  expect(getMyCurves().map((curve) => curve.name)).toEqual(['Second', 'First']);
  forgetMyCurvesCache();
  expect(getMyCurves().map((curve) => curve.name)).toEqual(['Second', 'First']);
});

it('keeps nothing for text that holds no curve', () => {
  expect(addMyCurve(draft('Nothing', 'hello'))).toBeUndefined();
  expect(getMyCurves()).toHaveLength(0);
  expect(window.localStorage.getItem(KEY)).toBeNull();
});

it('numbers a name already taken instead of refusing it', () => {
  addMyCurve(draft('HD 600'));
  addMyCurve(draft('hd 600'));
  expect(getMyCurves().map((curve) => curve.name)).toEqual([
    'hd 600 (2)',
    'HD 600',
  ]);
});

it('renames, numbering a name another curve holds, and ignores an empty one', () => {
  const first = addMyCurve(draft('A'));
  addMyCurve(draft('B'));
  renameMyCurve(first?.id ?? '', 'B');
  expect(getMyCurves().find((curve) => curve.id === first?.id)?.name).toBe(
    'B (2)',
  );
  renameMyCurve(first?.id ?? '', '   ');
  expect(getMyCurves().find((curve) => curve.id === first?.id)?.name).toBe(
    'B (2)',
  );
});

it('duplicates right under the curve, and removes', () => {
  const kept = addMyCurve(draft('Warm'));
  addMyCurve(draft('Top'));
  const copy = duplicateMyCurve(kept?.id ?? '');
  expect(getMyCurves().map((curve) => curve.name)).toEqual([
    'Top',
    'Warm',
    'Warm (2)',
  ]);
  removeMyCurve(copy?.id ?? '');
  expect(getMyCurves().map((curve) => curve.name)).toEqual(['Top', 'Warm']);
});

it('imports at once: a replaced curve keeps its place and name, the rest come in numbered on top', () => {
  const kept = addMyCurve(draft('Warm'));
  const count = importMyCurves([
    { curve: draft('Warm', OTHER), replaces: kept?.id },
    { curve: draft('Warm', OTHER) },
    { curve: draft('Broken', 'nothing') },
  ]);
  expect(count).toBe(2);
  const names = getMyCurves().map((curve) => curve.name);
  expect(names).toEqual(['Warm (2)', 'Warm']);
  expect(getMyCurves()[1]).toMatchObject({ id: kept?.id, text: OTHER });
});

it('drops a stored entry that holds no curve, and reads nonsense as an empty list', () => {
  window.localStorage.setItem(
    KEY,
    JSON.stringify([
      { id: 'a', name: 'Good', text: TEXT, source: 'file', ears: 'left' },
      { id: 'b', name: 'Bad', text: 'nope' },
      7,
    ]),
  );
  expect(getMyCurves().map((curve) => curve.name)).toEqual(['Good']);
  window.localStorage.setItem(KEY, '{broken');
  forgetMyCurvesCache();
  expect(getMyCurves()).toEqual([]);
});
