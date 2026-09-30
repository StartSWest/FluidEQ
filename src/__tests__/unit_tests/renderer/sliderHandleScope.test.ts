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
  // A new install: the fader cap in the app, the round knob in the amp
  // (Ivan, 2026-09-29).
  it('starts a new install rectangular in the app and round in the amp', () => {
    load({});
    expect(onRoot()).toBe('rect');
    const store = load({});
    store.applySliderHandleScope('player');
    expect(onRoot()).toBe('round');
  });

  it('is remembered apart for the app and the amp', () => {
    const store = load({});
    store.setSliderHandle('round');
    store.applySliderHandleScope('player');
    store.setSliderHandle('rect');
    expect(onRoot()).toBe('rect');
    store.applySliderHandleScope('app');
    expect(onRoot()).toBe('round');
    expect(window.localStorage.getItem('fluideq.sliderHandle')).toBe('round');
    expect(window.localStorage.getItem('fluideq.sliderHandle.player')).toBe(
      'rect',
    );
  });

  it('writes nothing until a choice changes', () => {
    const store = load({});
    store.setSliderHandle('rect');
    store.applySliderHandleScope('player');
    store.setSliderHandle('round');
    expect(window.localStorage.getItem('fluideq.sliderHandle')).toBeNull();
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

  // Somebody who picked in the app before the amp had a choice of its own:
  // the amp keeps the shape it had, whichever that was.
  it.each(['round', 'rect'])(
    'starts the amp on the app’s choice (%s) when the amp has none yet',
    (app) => {
      const store = load({ 'fluideq.sliderHandle': app });
      store.applySliderHandleScope('player');
      expect(onRoot()).toBe(app);
    },
  );

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
