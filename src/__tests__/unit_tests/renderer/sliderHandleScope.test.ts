/**
 * The EQ sliders' handle, round or rectangular: one choice for the full app
 * and one for the amp (Ivan, 2026-09-28: "the EQ knobs circle or rect setting
 * need to be different on amp and full app, each can have their own").
 */

import type * as SliderHandle from 'renderer/utils/sliderHandle';

type TModule = typeof SliderHandle;

// The store reads its choices once, when it is first loaded: each case
// starts from its own storage and its own copy of the module.
const load = (stored: Record<string, string>): TModule => {
  window.localStorage.clear();
  Object.entries(stored).forEach(([key, value]) =>
    window.localStorage.setItem(key, value),
  );
  let loaded: TModule | undefined;
  jest.isolateModules(() => {
    // eslint-disable-next-line global-require
    loaded = require('renderer/utils/sliderHandle') as TModule;
  });
  if (!loaded) {
    throw new Error('the store did not load');
  }
  return loaded;
};

const onRoot = () => document.documentElement.dataset.sliderHandle;

describe('the EQ sliders’ handle', () => {
  it('is remembered apart for the app and the amp', () => {
    const store = load({});
    store.setSliderHandle('round');
    expect(onRoot()).toBe('round');
    store.applySliderHandleScope('player');
    // The amp opens on the app's choice from before the split: rect.
    expect(onRoot()).toBe('rect');
    store.applySliderHandleScope('app');
    expect(onRoot()).toBe('round');
    expect(window.localStorage.getItem('fluideq.sliderHandle')).toBe('round');
    // Nothing chosen in the amp, so nothing written for it.
    expect(
      window.localStorage.getItem('fluideq.sliderHandle.player'),
    ).toBeNull();
  });

  it('is a change of the amp’s own while the window is the amp', () => {
    const store = load({ 'fluideq.sliderHandle': 'rect' });
    store.applySliderHandleScope('player');
    store.setSliderHandle('round');
    expect(onRoot()).toBe('round');
    store.applySliderHandleScope('app');
    expect(onRoot()).toBe('rect');
    expect(window.localStorage.getItem('fluideq.sliderHandle')).toBe('rect');
    expect(window.localStorage.getItem('fluideq.sliderHandle.player')).toBe(
      'round',
    );
  });

  it('starts the amp on the app’s choice when the amp has none yet', () => {
    const store = load({ 'fluideq.sliderHandle': 'round' });
    store.applySliderHandleScope('player');
    expect(onRoot()).toBe('round');
  });

  it('keeps each choice across launches', () => {
    const store = load({
      'fluideq.sliderHandle': 'rect',
      'fluideq.sliderHandle.player': 'round',
    });
    expect(onRoot()).toBe('rect');
    store.applySliderHandleScope('player');
    expect(onRoot()).toBe('round');
  });
});
