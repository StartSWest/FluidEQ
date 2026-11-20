/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * A chain the listener saves keeps the tone that was playing with it.
 *
 * A preset's tone is its Preset layer in the main EQ now (`presetCurve.ts`),
 * not a stage of the rack, so a chain saved from Metal and stored as its rack
 * alone would come back without Metal's tone.
 *
 * The list is main's (`user-presets.json`, `main/ipc/userPresets.ts`); here
 * main is an array the two requests read and write, and every test starts
 * from a fresh copy of the window's store, so what one test kept is not
 * what the next reads first.
 */
import { DSP_DEFAULTS } from 'common/dsp/chain';
import { DSP_PRESETS } from 'common/dsp/presets';

let mockMain: unknown[] = [];
jest.mock('renderer/utils/equalizerApi', () => ({
  readUserPresets: jest.fn(async () => mockMain),
  writeUserPresets: jest.fn(async (presets: unknown[]) => {
    mockMain = JSON.parse(JSON.stringify(presets));
    return true;
  }),
}));

const LEFT_IN_WINDOW_KEY = 'fluideq.dsp.userChainPresets.v1';

const metal = DSP_PRESETS.find((preset) => preset.id === 'metal');

type TStore = typeof import('renderer/dsp/userDspPresets');
type TCatalog = typeof import('renderer/dsp/dspPresetCatalog');

/** The store and the catalogue that reads it, fresh, as a new window has them. */
const fresh = async (): Promise<{ store: TStore; catalog: TCatalog }> => {
  let store: TStore | undefined;
  let catalog: TCatalog | undefined;
  await jest.isolateModulesAsync(async () => {
    store = await import('renderer/dsp/userDspPresets');
    catalog = await import('renderer/dsp/dspPresetCatalog');
  });
  if (!store || !catalog) {
    throw new Error('The store did not load');
  }
  return { store, catalog };
};

beforeEach(() => {
  localStorage.clear();
  mockMain = [];
});

it('keeps the curve a chain was saved with', async () => {
  if (!metal?.curve) {
    throw new Error('Metal has no curve');
  }
  const { store } = await fresh();
  const saved = await store.saveUserDspPreset(
    'My metal',
    metal.settings,
    metal.curve,
  );
  const [read] = store.readUserDspPresets();
  expect(read.id).toBe(saved.id);
  expect(read.curve?.bands).toEqual(metal.curve.bands);
  expect(read.curve?.subsonicHz).toBe(metal.curve.subsonicHz);
});

it('saves a chain with no tone as a rack alone', async () => {
  const { store } = await fresh();
  await store.saveUserDspPreset('Just the rack', {
    ...DSP_DEFAULTS,
    enabled: true,
  });
  const [read] = store.readUserDspPresets();
  expect(read.curve).toBeUndefined();
  // As main keeps it, not only as the window holds it.
  expect(mockMain[0]).not.toHaveProperty('curve');
});

it('reads a chain saved before chains kept a tone, and passes over a broken one', async () => {
  // Where every version before kept the list: handed to main once.
  localStorage.setItem(
    LEFT_IN_WINDOW_KEY,
    JSON.stringify([
      { id: 'user-chain:old', name: 'Old', settings: DSP_DEFAULTS },
      {
        id: 'user-chain:odd',
        name: 'Odd',
        settings: DSP_DEFAULTS,
        curve: 'not a curve',
      },
    ]),
  );
  const { store } = await fresh();
  await store.ensureUserDspPresetsLoaded();
  const read = store.readUserDspPresets();
  expect(read.map((preset) => preset.name)).toEqual(['Old', 'Odd']);
  expect(read.map((preset) => preset.curve)).toEqual([undefined, undefined]);
});

it('keeps the listener’s Treble choice when a saved chain is picked', async () => {
  // Saved with Precise, picked by a listener who has chosen Classic: the
  // choice is the listener's, as it is for every factory chain.
  const { store, catalog } = await fresh();
  const saved = await store.saveUserDspPreset('Saved precise', {
    ...DSP_DEFAULTS,
    enabled: true,
  });
  const current = {
    ...DSP_DEFAULTS,
    eq: { ...DSP_DEFAULTS.eq, treble: 'classic' as const },
  };
  expect(catalog.resolveDspPreset(saved.id, current)?.eq.treble).toBe(
    'classic',
  );
  // POSITIVE CONTROL: the same pick over a Precise rack stays Precise.
  expect(catalog.resolveDspPreset(saved.id, DSP_DEFAULTS)?.eq.treble).toBe(
    'precise',
  );
});

it('retains a saved chain’s Master but keeps the listener’s Normalizer', async () => {
  const settings = {
    ...DSP_DEFAULTS,
    normalizer: { ...DSP_DEFAULTS.normalizer, mode: 'loudness' as const },
    master: { ...DSP_DEFAULTS.master, enabled: true, loudnessMaximize: true },
  };
  const { store, catalog } = await fresh();
  const saved = await store.saveUserDspPreset('My levelled chain', settings);
  const selected = catalog.resolveDspPreset(saved.id, DSP_DEFAULTS);
  // The Normalizer stands beside the presets (Ivan, 2026-11-15): a saved
  // chain neither carries one nor switches the listener's.
  expect(selected?.normalizer).toEqual(DSP_DEFAULTS.normalizer);
  const levelled = {
    ...DSP_DEFAULTS,
    normalizer: {
      mode: 'truePeak' as const,
      truePeakDbtp: -2,
      targetLufs: -16,
    },
  };
  expect(catalog.resolveDspPreset(saved.id, levelled)?.normalizer).toEqual(
    levelled.normalizer,
  );
  // POSITIVE CONTROL: the chain's own stages still come back with it.
  expect(selected?.master).toEqual(settings.master);
});
