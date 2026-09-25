/** @jest-environment node */
/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The per-layout band memory is captured after every successful edit, and it
 * used to rewrite its file synchronously every time — each step of a drag,
 * every Auto normalize measurement, every health check.
 */

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  FixedBandSizeEnum,
  getDefaultFilters,
  IFiltersMap,
} from 'common/constants';
import { flushPendingWrites } from 'main/asyncWriter';
import { createLayoutSettingsStore } from 'main/layoutSettings';

const LAYOUT_FILE = 'layout-frequencies.json';

let userDataDir: string;
let renames: jest.SpyInstance;
let syncWrites: jest.SpyInstance;

/**
 * Fifteen default bands with the lowest one at `gain`: the band a snapshot,
 * which is sorted by frequency, holds first. Not the first key, because an id
 * made only of digits is ordered ahead of the others.
 */
const bandsAt = (gain: number): IFiltersMap => {
  const filters = getDefaultFilters();
  const lowest = Object.values(filters).reduce((low, band) =>
    band.frequency < low.frequency ? band : low,
  );
  filters[lowest.id] = { ...lowest, gain };
  return filters;
};

const layoutWrites = () =>
  renames.mock.calls.filter(
    ([, target]) => path.basename(String(target)) === LAYOUT_FILE,
  ).length;

beforeEach(() => {
  userDataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fluideq-layouts-'));
  renames = jest.spyOn(fs.promises, 'rename');
  syncWrites = jest.spyOn(fs, 'writeFileSync');
});

afterEach(async () => {
  await flushPendingWrites().catch(() => undefined);
  renames.mockRestore();
  syncWrites.mockRestore();
  fs.rmSync(userDataDir, { recursive: true, force: true });
});

it('writes a drag as a handful of writes of where it ended, off the main thread', async () => {
  const store = createLayoutSettingsStore(userDataDir);

  for (let step = 0; step < 50; step += 1) {
    store.capture('headphones', bandsAt(step / 5));
  }
  await flushPendingWrites();

  expect(syncWrites).not.toHaveBeenCalled();
  expect(layoutWrites()).toBeGreaterThanOrEqual(1);
  expect(layoutWrites()).toBeLessThanOrEqual(2);
  const saved = JSON.parse(
    fs.readFileSync(path.join(userDataDir, LAYOUT_FILE), 'utf8'),
  );
  expect(saved.devices.headphones[FixedBandSizeEnum.FIFTEEN][0].gain).toBe(9.8);
});

it('writes nothing for an edit that moved no band, and writes the next one that did', async () => {
  const store = createLayoutSettingsStore(userDataDir);
  store.capture('headphones', bandsAt(3));
  await flushPendingWrites();
  const afterFirst = layoutWrites();

  // A preamp step or a measurement: the bands are the ones already kept.
  store.capture('headphones', bandsAt(3));
  store.capture('headphones', bandsAt(3));
  await flushPendingWrites();
  expect(layoutWrites()).toBe(afterFirst);

  store.capture('headphones', bandsAt(4));
  await flushPendingWrites();
  expect(layoutWrites()).toBe(afterFirst + 1);
});

it('reads back what it kept, per output and band count, in a new session', async () => {
  const store = createLayoutSettingsStore(userDataDir);
  store.capture('headphones', bandsAt(-2));
  store.capture('speakers', bandsAt(5));
  store.clear('speakers');
  await flushPendingWrites();

  const next = createLayoutSettingsStore(userDataDir);
  expect(next.stored('headphones', FixedBandSizeEnum.FIFTEEN)?.[0].gain).toBe(
    -2,
  );
  expect(next.stored('speakers', FixedBandSizeEnum.FIFTEEN)).toBeUndefined();
  expect(next.stored('headphones', FixedBandSizeEnum.TEN)).toBeUndefined();
});
