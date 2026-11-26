/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * Edit a copy (Ivan, 2026-11-26: "I want users to create a copy of default
 * presets and edit them, not the original but the copy"): a factory preset
 * copied into Yours carries its rack AND its curve, under "{name} (copy)",
 * numbered when that name is taken, and editing the copy leaves the factory
 * preset exactly as it was.
 *
 * Main's list is an array the two requests read and write, and every test
 * starts from a fresh copy of the window's store, as `userDspPresets.test.ts`
 * does.
 */
import type { IEqSettings } from 'common/dsp/chain';
import { DSP_PRESETS } from 'common/dsp/presets';
import { translate, type TranslationKey } from 'common/i18n';

let mockMain: unknown[] = [];
jest.mock('renderer/utils/equalizerApi', () => ({
  ...jest.requireActual('renderer/utils/equalizerApi'),
  readUserPresets: jest.fn(async () => mockMain),
  writeUserPresets: jest.fn(async (presets: unknown[]) => {
    mockMain = JSON.parse(JSON.stringify(presets));
    return true;
  }),
}));

const t = (key: TranslationKey, vars?: Record<string, string | number>) =>
  translate('en', key, vars);

type TStore = typeof import('renderer/dsp/userDspPresets');
type TCatalog = typeof import('renderer/dsp/dspPresetCatalog');
type TCopy = typeof import('renderer/eq/ownPresets/factoryPresetCopy');

const fresh = async () => {
  let store: TStore | undefined;
  let catalog: TCatalog | undefined;
  let copy: TCopy | undefined;
  await jest.isolateModulesAsync(async () => {
    store = await import('renderer/dsp/userDspPresets');
    catalog = await import('renderer/dsp/dspPresetCatalog');
    copy = await import('renderer/eq/ownPresets/factoryPresetCopy');
  });
  if (!store || !catalog || !copy) {
    throw new Error('The store did not load');
  }
  return { store, catalog, addCopy: copy.default };
};

const pop = DSP_PRESETS.find((preset) => preset.id === 'pop');

/** A curve with its first band raised by `db`: an edit of the copy. */
const raised = (curve: IEqSettings, db: number): IEqSettings => ({
  ...curve,
  bands: curve.bands.map((band, index) =>
    index === 0 ? { ...band, gainDb: band.gainDb + db } : band,
  ),
});

beforeEach(() => {
  localStorage.clear();
  mockMain = [];
});

describe('a copy of a factory preset', () => {
  it('carries the rack and the curve, under its name with (copy)', async () => {
    if (!pop?.curve) {
      throw new Error('Pop has no curve');
    }
    const { store, addCopy } = await fresh();
    const copy = await addCopy('pop', t);
    expect(copy?.name).toBe('Pop (copy)');
    const [kept] = store.readUserDspPresets();
    expect(kept.id).toBe(copy?.id);
    expect(kept.id).not.toBe('pop');
    // The rack: every stage Pop runs, as Pop runs it.
    expect(kept.settings.maximizer).toEqual(pop.settings.maximizer);
    expect(kept.settings.deEsser).toEqual(pop.settings.deEsser);
    expect(kept.settings.bassPunch).toEqual(pop.settings.bassPunch);
    expect(kept.settings.dimension).toEqual(pop.settings.dimension);
    expect(kept.settings.exciter.enabled).toBe(pop.settings.exciter.enabled);
    // The curve: Pop's tone, band for band.
    expect(kept.curve?.bands).toEqual(pop.curve.bands);
    // And it is main's to keep, not only the window's.
    expect(mockMain).toHaveLength(1);
  });

  it('leaves the factory preset as it was when the copy is edited', async () => {
    if (!pop?.curve) {
      throw new Error('Pop has no curve');
    }
    const before = JSON.stringify(pop);
    const { store, catalog, addCopy } = await fresh();
    const copy = await addCopy('pop', t);
    if (!copy?.curve) {
      throw new Error('The copy has no curve');
    }
    const rack = {
      ...copy.settings,
      maximizer: { ...copy.settings.maximizer, driveDb: 4 },
    };
    await store.updateUserDspPreset(copy.id, rack, raised(copy.curve, 6));
    // POSITIVE CONTROL: the edit landed on the copy.
    const [edited] = store.readUserDspPresets();
    expect(edited.settings.maximizer.driveDb).toBe(4);
    expect(edited.curve?.bands[0].gainDb).toBeCloseTo(
      pop.curve.bands[0].gainDb + 6,
    );
    // Pop itself: the same object, the same curve a pick of it plays.
    expect(JSON.stringify(pop)).toBe(before);
    expect(catalog.resolveDspPresetCurve('pop')?.bands).toEqual(
      pop.curve.bands,
    );
    expect(
      catalog.resolveDspPreset('pop', pop.settings)?.maximizer.driveDb,
    ).toBe(pop.settings.maximizer.driveDb);
  });

  it('is numbered when its name is taken, never written over', async () => {
    const { store, addCopy } = await fresh();
    const first = await addCopy('pop', t);
    const second = await addCopy('pop', t);
    // POSITIVE CONTROL: the first copy takes the name as it is.
    expect(first?.name).toBe('Pop (copy)');
    expect(second?.name).toBe('Pop (copy) (2)');
    expect(second?.id).not.toBe(first?.id);
    expect(store.readUserDspPresets().map((preset) => preset.name)).toEqual([
      'Pop (copy) (2)',
      'Pop (copy)',
    ]);
  });

  it('is not made from an id that is no factory preset', async () => {
    const { store, addCopy } = await fresh();
    await expect(addCopy('not-a-preset', t)).resolves.toBeUndefined();
    expect(store.readUserDspPresets()).toHaveLength(0);
  });
});
