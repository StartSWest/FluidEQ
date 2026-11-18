/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with this program.  If not, see <https://www.gnu.org/licenses/>.
*/

/**
 * The graph's view settings, once they stopped being one value each.
 *
 * Four things here are easy to get subtly wrong and invisible in a screenshot.
 *
 * Whether the modes are really independent, or whether a write leaked into a
 * neighbour. Whether the settings that are meant to be *shared* stayed shared —
 * the look above all, which follows you between modes on purpose, and which
 * splitting by accident would be a bug found by being confused rather than by
 * anything appearing to break. Whether an install from before the split keeps
 * what it had, rather than quietly coming back to defaults in two modes out of
 * three. And whether anybody is *told* when the mode changes: the values are
 * right the instant `view` moves either way, so a missing notification is a bug
 * that exists only on screen, and only until the next unrelated render.
 *
 * The stores are module singletons that read storage once at import, so every
 * case here loads a fresh copy. A second load over the same `localStorage` is
 * exactly what a restart is.
 */

/**
 * The one import, and it is a type.
 *
 * Nothing may be imported for real here: every case needs a store that has not
 * read storage yet, so the loading is all done inside `jest.isolateModules`. A
 * file with no import and no export is a *script* to TypeScript though, and a
 * script puts every name it declares into the global scope — the store test
 * next door declares a `load` of its own, and the two files collide. A
 * type-only import makes this a module, which fixes that, and is erased before
 * anything runs, so no module is pulled in early.
 */
import type { TGraphView } from 'renderer/utils/graphStyle';

type TGraphStyle = typeof import('renderer/utils/graphStyle');
type TGraphOverlay = typeof import('renderer/utils/graphOverlay');

/** All three, for the cases that have to check every one of them. */
const MODES: TGraphView[] = ['normal', 'fullscreen'];

interface IStores {
  style: TGraphStyle;
  overlay: TGraphOverlay;
}

const load = (): IStores => {
  // Filled inside the callback, which control flow cannot follow into.
  const loaded: { stores?: IStores } = {};
  jest.isolateModules(() => {
    loaded.stores = {
      // eslint-disable-next-line global-require -- a fresh copy, read with what is stored now
      style: require('renderer/utils/graphStyle'),
      // eslint-disable-next-line global-require -- a fresh copy, read with what is stored now
      overlay: require('renderer/utils/graphOverlay'),
    };
  });
  if (!loaded.stores) {
    throw new Error('the graph settings did not load');
  }
  return loaded.stores;
};

/** What a `useSyncExternalStore` call was handed, once it is not React's. */
interface ISubscribed<T> {
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T;
}

/**
 * The same fresh copy, with `useSyncExternalStore` standing aside.
 *
 * Four of the per-view settings are reached through listener sets of their own
 * rather than through the factory's, and the only way into those from outside
 * the module is the hooks — which throw outside a component. A stand-in hands
 * back the two functions the store passed it, and those are exactly the pair
 * under test: whether a mode change rings the subscription, and whether the
 * getter then answers with the mode that was moved to.
 */
const loadWithoutReact = (): TGraphStyle => {
  const loaded: { style?: TGraphStyle } = {};
  jest.isolateModules(() => {
    jest.doMock('react', () => ({
      useSyncExternalStore: (
        subscribe: (listener: () => void) => () => void,
        getSnapshot: () => unknown,
      ) => ({ subscribe, getSnapshot }),
    }));
    // eslint-disable-next-line global-require -- a fresh copy, with React stood aside
    loaded.style = require('renderer/utils/graphStyle');
  });
  jest.dontMock('react');
  if (!loaded.style) {
    throw new Error('the graph settings did not load');
  }
  return loaded.style;
};

const stored = (key: string) => window.localStorage.getItem(key);

const GRID_STEM = 'fluideq.graphGridHidden';
/** The three-step size this replaced, kept for the migration cases. */
const STRETCH_STEM = 'fluideq.graphStretched';
const WAVE_HEIGHT_STEM = 'fluideq.graphWaveHeight';
const OPACITY_STEM = 'fluideq.graphOverlayOpacity';
const BLUR_STEM = 'fluideq.graphOverlayBlur';

/** The five the Ctrl+W cycle walks, split per mode after the same argument. */
const WAVE_STEM = 'fluideq.graphWaveHidden';
const SOLO_STEM = 'fluideq.graphSolo';
const QUIET_EQ_STEM = 'fluideq.graphQuietEq';
const CURVES_STEM = 'fluideq.graphHiddenCurves';
const CLEAN_STEM = 'fluideq.graphClean';
/** Independent from the five-state contents cycle. */
const COVERAGE_STEM = 'fluideq.graphCoverageHidden';

describe('one set of view settings per mode', () => {
  beforeEach(() => window.localStorage.clear());

  it('remembers the label toggle across restart independently in each view', () => {
    const { style } = load();
    style.setGraphView('normal');
    style.toggleGraphBandLabels();
    expect(style.getGraphContents()).toBe('everything');
    style.setGraphView('fullscreen');
    expect(style.getGraphBandLabelsHidden()).toBe(true);
    const restarted = load().style;
    restarted.setGraphView('normal');
    expect(restarted.getGraphBandLabelsHidden()).toBe(false);
    restarted.setGraphView('fullscreen');
    expect(restarted.getGraphBandLabelsHidden()).toBe(true);
  });

  it('hides the grid in one mode and leaves the other alone', () => {
    const { style } = load();

    // Full screen starts without a grid and the pane starts with one: full
    // screen is where the graph stops being a measurement, which is the same
    // argument that made this per-mode in the first place.
    style.setGraphView('fullscreen');
    expect(style.getGraphGridHidden()).toBe(true);
    style.setGraphView('normal');
    expect(style.getGraphGridHidden()).toBe(false);

    style.toggleGraphGrid();
    expect(style.getGraphGridHidden()).toBe(true);
    style.setGraphView('fullscreen');
    expect(style.getGraphGridHidden()).toBe(true);

    // Full screen turned the other way: each mode now holds the opposite of
    // its default, so a getter answering with whatever was last written
    // anywhere could not pass.
    style.toggleGraphGrid();
    expect(style.getGraphGridHidden()).toBe(false);
    style.setGraphView('normal');
    expect(style.getGraphGridHidden()).toBe(true);
    style.setGraphView('fullscreen');
    expect(style.getGraphGridHidden()).toBe(false);
  });

  it('writes one key per mode, named after the old flat one', () => {
    const { style } = load();

    style.setGraphView('normal');
    style.toggleGraphGrid();

    expect(stored(`${GRID_STEM}.normal`)).toBe('true');
    expect(stored(`${GRID_STEM}.fullscreen`)).toBeNull();
    // The stem itself is never a value again. Anything finding one there is
    // looking at storage written before the split.
    expect(stored(GRID_STEM)).toBeNull();
  });

  /**
   * One wave height per mode, like everything else in this file. The two big
   * modes used to share a value; on screen the pane is a band across a card
   * and full screen is the whole glass, so a wave set to fill one of them is
   * a smear in the other (Ivan, 2026-09-23).
   */
  it('keeps a wave height of its own for each mode', () => {
    const { style } = load();

    style.setGraphView('fullscreen');
    expect(style.getGraphWaveHeight()).toBe(0.75);
    style.setGraphWaveHeight(0.5);
    // Only the mode it was set in is written, so the other keeps its own.
    expect(stored(`${WAVE_HEIGHT_STEM}.fullscreen`)).toBe('0.5');
    expect(stored(`${WAVE_HEIGHT_STEM}.normal`)).toBeNull();

    // The pane has one too, and that is the point: the menu offers these rows
    // there while a visualizer is on the plot, and they used to write a value
    // the getter refused to hand back — so the thumb sprang home on release
    // and the picture never moved. Whether a bare pane draws with it is
    // `FrequencyResponseChart`'s call, because that is where it is known
    // whether a scene is on the plot at all.
    style.setGraphView('normal');
    expect(style.getGraphWaveHeight()).toBe(1);
    style.setGraphWaveHeight(0.4);
    expect(stored(`${WAVE_HEIGHT_STEM}.normal`)).toBe('0.4');
    style.setGraphView('fullscreen');
    expect(style.getGraphWaveHeight()).toBe(0.5);
    style.setGraphView('normal');

    // A desktop background is watched the way full screen is, so it takes
    // full screen's whichever mode the graph itself is in.
    expect(style.getWatchedGraphWave().height).toBe(0.5);
  });

  it('starts the watching view at three quarters and the pane at full', () => {
    const { style } = load();
    style.setGraphView('normal');
    expect(style.getGraphWaveHeight()).toBe(1);
    style.setGraphView('fullscreen');
    expect(style.getGraphWaveHeight()).toBe(0.75);
  });

  it('carries the old three-step size into the continuous one', () => {
    // Written by any build from while the wave had three named sizes. Only
    // `compact` was a different HEIGHT — `normal` and `stretched` differed by
    // the plot's margins — so it is the only one that moves the slider.
    // Each against a default it is not: the pane starts full and full screen
    // at three quarters.
    window.localStorage.setItem(`${STRETCH_STEM}.normal`, 'compact');
    window.localStorage.setItem(`${STRETCH_STEM}.fullscreen`, 'stretched');

    const { style } = load();
    style.setGraphView('normal');
    expect(style.getGraphWaveHeight()).toBe(0.5);

    style.setGraphView('fullscreen');
    expect(style.getGraphWaveHeight()).toBe(1);

    // And the old keys go, so the format cannot stay ambiguous.
    expect(stored(`${STRETCH_STEM}.normal`)).toBeNull();
    expect(stored(`${STRETCH_STEM}.fullscreen`)).toBeNull();
  });

  it('keeps the see-through and the blur per mode', () => {
    const { style, overlay } = load();

    style.setGraphView('normal');
    overlay.setOverlayOpacity(0.25);
    overlay.setOverlayBlur(12);

    // The mode not yet touched is still on its defaults, rather than on what
    // was just set in the other one.
    style.setGraphView('fullscreen');
    expect(overlay.getOverlayOpacity()).toBe(0);
    expect(overlay.getOverlayBlur()).toBe(0);

    overlay.setOverlayOpacity(0.6);
    overlay.setOverlayBlur(40);
    expect(overlay.getOverlayOpacity()).toBe(0.6);
    expect(overlay.getOverlayBlur()).toBe(40);

    style.setGraphView('normal');
    expect(overlay.getOverlayOpacity()).toBe(0.25);
    expect(overlay.getOverlayBlur()).toBe(12);
  });

  it('still clamps, per mode', () => {
    const { style, overlay } = load();

    style.setGraphView('fullscreen');
    overlay.setOverlayOpacity(4);
    overlay.setOverlayBlur(-3);

    expect(overlay.getOverlayOpacity()).toBe(1);
    expect(overlay.getOverlayBlur()).toBe(0);
  });

  it('keeps what the plot is showing per mode, on five stems', () => {
    // The five values Ctrl+W walks. They went per mode for the reason the grid
    // did and then some: the arrangement wanted over a video is the one the
    // cycle exists to reach, and sharing it meant walking the cycle again in
    // both directions on every Ctrl+F.
    //
    // Written in the pane: full screen writes its own on the way in, since it
    // opens on the wave (2026-11-16), so it is the neighbour that must not be
    // touched only until it is entered.
    const { style } = load();

    style.setGraphView('normal');
    style.toggleGraphWave();

    expect(stored(`${WAVE_STEM}.normal`)).toBe('true');
    expect(stored(`${WAVE_STEM}.fullscreen`)).toBeNull();
    expect(stored(WAVE_STEM)).toBeNull();

    style.setGraphView('fullscreen');
    expect(style.getGraphWaveHidden()).toBe(false);
    style.setGraphView('normal');
    expect(style.getGraphWaveHidden()).toBe(true);

    // Clean has a flag of its own. Reusing coverage here destroyed the user's
    // independent wash choice every time the cycle passed through its blank
    // presentation.
    style.setGraphContents('clean');
    expect(stored(`${CLEAN_STEM}.normal`)).toBe('true');
    expect(stored(`${CLEAN_STEM}.fullscreen`)).not.toBe('true');
    expect(stored(`${COVERAGE_STEM}.normal`)).toBeNull();
  });

  it('keeps the hidden curves per mode, still comma-joined', () => {
    // The one value here that is not a flag. Its list format is unchanged —
    // only the key it is written under moved — because the ids are what the
    // legend and the chart agree on and a second shape would be a second thing
    // to keep in step.
    const { style } = load();

    style.setGraphView('normal');
    style.toggleGraphCurve('voicing');
    style.toggleGraphCurve('driver');

    expect(stored(`${CURVES_STEM}.normal`)).toBe('voicing,driver');
    expect(stored(`${CURVES_STEM}.fullscreen`)).toBeNull();

    style.toggleGraphCurve('voicing');
    expect(stored(`${CURVES_STEM}.normal`)).toBe('driver');
  });

  it('hides only the EQ curve from the View menu', () => {
    const style = loadWithoutReact();
    const curves = style.useHiddenCurves() as unknown as ISubscribed<
      readonly string[]
    >;

    style.toggleGraphCurve('eq');

    expect(curves.getSnapshot()).toEqual(['eq']);
    expect(style.getGraphContents()).toBe('unlabelled');
    expect(style.getGraphWaveHidden()).toBe(false);

    style.toggleGraphCurve('eq');
    expect(curves.getSnapshot()).toEqual([]);
  });

  it('keeps the no-blank-graph rule, one mode at a time', () => {
    // Wave only, with the wave switched off, is a grid and nothing else. Both
    // halves are per mode now, so the rule has to hold *within* a mode — it
    // used to be a statement about a pair of single values, and a version that
    // still read one of them from whichever mode last wrote it would let the
    // plot go blank exactly once per Ctrl+F.
    const { style } = load();

    style.setGraphView('fullscreen');
    style.toggleGraphWave();
    expect(stored(`${WAVE_STEM}.fullscreen`)).toBe('true');

    style.toggleLiveOutputSolo();
    expect(stored(`${SOLO_STEM}.fullscreen`)).toBe('true');
    expect(stored(`${WAVE_STEM}.fullscreen`)).toBe('false');

    // And from the other side: hiding the wave while solo is on drops solo.
    style.toggleGraphWave();
    expect(stored(`${WAVE_STEM}.fullscreen`)).toBe('true');
    expect(stored(`${SOLO_STEM}.fullscreen`)).toBe('false');
  });

  it('does not reach into another mode to do it', () => {
    // Solo asked for in the normal view survives hiding the wave in full
    // screen. The rule pairs two values inside one mode, and a version that
    // reached across would take something away where nobody could see it go.
    const { style } = load();

    style.setGraphView('normal');
    style.toggleLiveOutputSolo();
    style.setGraphView('fullscreen');
    style.toggleGraphWave();

    // Full screen opened on the wave alone, its own solo, and hiding its wave
    // dropped that solo: the rule did reach a solo, only the one in its mode.
    expect(stored(`${SOLO_STEM}.normal`)).toBe('true');
    expect(stored(`${WAVE_STEM}.fullscreen`)).toBe('true');
    expect(stored(`${SOLO_STEM}.fullscreen`)).toBe('false');

    style.setGraphView('normal');
    expect(style.getGraphContents()).toBe('wave');
  });
});

describe('the settings that stay shared', () => {
  beforeEach(() => window.localStorage.clear());

  it('carries the chosen look between modes', () => {
    // The point of the whole change was the *view* settings. Which visualiser
    // is on the graph is a choice about the thing being drawn, and a picker
    // that silently pointed somewhere else after Ctrl+F would be its own bug.
    const { style } = load();

    style.setGraphView('fullscreen');
    style.cycleGraphLook();
    const chosen = style.getGraphLookId();

    style.setGraphView('normal');
    expect(style.getGraphLookId()).toBe(chosen);
  });

  it('leaves the orientation, the meter and the titlebar wave flat', () => {
    // The three that stayed single, each for its own reason. Which way up the
    // trace is drawn is a property of the drawing rather than of how much room
    // it has, and the other two are not on the plot at all — a meter that came
    // and went with Ctrl+F would only ever be surprising. The titlebar wave
    // has no hide switch since 2026-11-16 ("that one always shows"); its old
    // stored value is still read, flat, once, by the wave's own migration.
    window.localStorage.setItem('fluideq.titlebarWaveHidden', 'true');
    const { style } = load();

    style.setGraphView('fullscreen');
    style.cycleWaveOrientation();
    style.toggleGraphMeter();

    expect(stored('fluideq.waveOrientation')).toBe('down');
    expect(stored('fluideq.waveOrientation.fullscreen')).toBeNull();
    expect(stored('fluideq.graphMeterHidden')).toBe('true');
    expect(stored('fluideq.graphMeterHidden.fullscreen')).toBeNull();
    expect(style.getTitlebarWaveHidden()).toBe(true);

    style.setGraphView('normal');
    expect(style.getGraphMeterHidden()).toBe(true);
    expect(style.getTitlebarWaveHidden()).toBe(true);
  });
});

describe('telling subscribers the mode moved', () => {
  beforeEach(() => window.localStorage.clear());

  it('wakes every per-view setting, whether or not its value differs', () => {
    // Unconditional on purpose. Working out which settings actually changed
    // would make the notification depend on the two modes happening to
    // disagree, and a subscriber told only sometimes is harder to reason about
    // than one told always.
    //
    // Subscribed through the factory rather than through the grid, because the
    // factory is what registers for the wake-up: anything built by it is woken,
    // and grid, stretch, see-through and blur are all built by it.
    const { style } = load();

    const setting = style.createPerViewSetting(
      'fluideq.test.probe',
      0,
      Number,
      String,
    );
    const woken = jest.fn();
    const unsubscribe = setting.subscribe(woken);

    style.setGraphView('fullscreen');
    expect(woken).toHaveBeenCalledTimes(1);

    style.setGraphView('normal');
    expect(woken).toHaveBeenCalledTimes(2);

    unsubscribe();
    style.setGraphView('fullscreen');
    expect(woken).toHaveBeenCalledTimes(2);
  });

  it('says nothing when the mode is set to the one it is already in', () => {
    const { style } = load();

    style.setGraphView('fullscreen');
    const setting = style.createPerViewSetting(
      'fluideq.test.probe',
      0,
      Number,
      String,
    );
    const woken = jest.fn();
    setting.subscribe(woken);

    style.setGraphView('fullscreen');
    expect(woken).not.toHaveBeenCalled();
    // Positive control: a real move wakes it.
    style.setGraphView('normal');
    expect(woken).toHaveBeenCalledTimes(1);
  });

  it('wakes only the setting that was set, when one is set', () => {
    const { style } = load();

    const setting = style.createPerViewSetting(
      'fluideq.test.probe',
      0,
      Number,
      String,
    );
    const woken = jest.fn();
    setting.subscribe(woken);

    style.toggleGraphGrid();
    expect(woken).not.toHaveBeenCalled();

    setting.set(3);
    expect(woken).toHaveBeenCalledTimes(1);
    // Set to what it already is, which is not a change.
    setting.set(3);
    expect(woken).toHaveBeenCalledTimes(1);
  });

  it('wakes the listener sets the plot itself subscribes through', () => {
    // The factory's own emitter is not enough. Solo, the quiet EQ curve, the
    // wave and the hidden curves each keep a listener set that predates the
    // split, and those sets are what the chart, the legend and the View menu
    // are all on. Woken only through the factory, the graph carried on drawing
    // the mode it came from with the right answer sitting underneath it — which
    // looks exactly like the setting never having been saved.
    const style = loadWithoutReact();

    const solo = style.useLiveOutputSolo() as unknown as ISubscribed<boolean>;
    const curves = style.useHiddenCurves() as unknown as ISubscribed<
      readonly string[]
    >;
    const wokenSolo = jest.fn();
    const wokenCurves = jest.fn();
    solo.subscribe(wokenSolo);
    curves.subscribe(wokenCurves);

    style.toggleLiveOutputSolo();
    expect(solo.getSnapshot()).toBe(true);
    expect(curves.getSnapshot()).toEqual(['eq']);

    // Full screen opens on the wave alone, which is the pane's state too, so
    // it is given everything here: the way back then has a different answer
    // to wake the listeners with.
    style.setGraphView('fullscreen');
    style.setGraphContents('everything');
    expect(solo.getSnapshot()).toBe(false);
    expect(curves.getSnapshot()).toEqual([]);

    wokenSolo.mockClear();
    wokenCurves.mockClear();

    style.setGraphView('normal');
    expect(wokenSolo).toHaveBeenCalled();
    expect(wokenCurves).toHaveBeenCalled();
    expect(solo.getSnapshot()).toBe(true);
    expect(curves.getSnapshot()).toEqual(['eq']);
  });
});

describe('carrying an older install across', () => {
  beforeEach(() => window.localStorage.clear());

  it('seeds both modes from the one flat value', () => {
    window.localStorage.setItem(GRID_STEM, 'true');
    window.localStorage.setItem(STRETCH_STEM, 'true');
    window.localStorage.setItem(OPACITY_STEM, '0.4');
    window.localStorage.setItem(BLUR_STEM, '18');

    load();

    MODES.forEach((mode) => {
      expect(stored(`${GRID_STEM}.${mode}`)).toBe('true');
      expect(stored(`${OPACITY_STEM}.${mode}`)).toBe('0.4');
      expect(stored(`${BLUR_STEM}.${mode}`)).toBe('18');
      // The old size is seeded into the height it means rather than into a
      // key of its own: `stretched` was never a different wave height.
      expect(stored(`${WAVE_HEIGHT_STEM}.${mode}`)).toBe('1');
    });
  });

  it('reads the seeded value in every mode, not only the one it started in', () => {
    window.localStorage.setItem(GRID_STEM, 'true');
    window.localStorage.setItem(BLUR_STEM, '18');

    const { style, overlay } = load();

    // Through the stores rather than through storage, because seeding the keys
    // and loading them are two separate steps and only the second is what the
    // graph actually draws from.
    MODES.forEach((mode) => {
      style.setGraphView(mode);
      expect(style.getGraphGridHidden()).toBe(true);
      expect(overlay.getOverlayBlur()).toBe(18);
    });
  });

  it("carries an older install's plot contents into both modes", () => {
    // The cycle's values were flat keys until this split, and an install that
    // had walked to a state should still be in it — in every mode, since
    // whatever was set was set with no notion of modes at all.
    //
    // These two flags used to be `layersAlone`, the stop that was dropped when
    // `clean` took its place. Nothing had to be migrated for that, and this is
    // the case that says so: what storage holds is the flags, never the state's
    // name, and a hidden wave with a quiet EQ line simply derives as `curves`
    // now — the same drawing, minus one line's worth of weight.
    window.localStorage.setItem(WAVE_STEM, 'true');
    window.localStorage.setItem(QUIET_EQ_STEM, 'true');
    window.localStorage.setItem(SOLO_STEM, 'false');
    window.localStorage.setItem(CURVES_STEM, 'voicing,driver');

    const { style } = load();

    MODES.forEach((mode) => {
      expect(stored(`${WAVE_STEM}.${mode}`)).toBe('true');
      expect(stored(`${CURVES_STEM}.${mode}`)).toBe('voicing,driver');
    });
    // Read back in the pane. Full screen opens on the wave whatever it was
    // left on (2026-11-16), so its carried flags are seen in storage above.
    style.setGraphView('normal');
    expect(style.getGraphContents()).toBe('curves');

    expect(stored(WAVE_STEM)).toBeNull();
    expect(stored(CURVES_STEM)).toBeNull();
  });

  it('removes the flat key, so the format does not stay ambiguous forever', () => {
    window.localStorage.setItem(GRID_STEM, 'true');
    window.localStorage.setItem(STRETCH_STEM, 'false');
    window.localStorage.setItem(OPACITY_STEM, '0.4');
    window.localStorage.setItem(BLUR_STEM, '18');

    load();

    expect(stored(GRID_STEM)).toBeNull();
    expect(stored(STRETCH_STEM)).toBeNull();
    expect(stored(OPACITY_STEM)).toBeNull();
    expect(stored(BLUR_STEM)).toBeNull();
  });

  it('runs once, and does not undo what was done after it', () => {
    // Grid shown, against full screen's own default of hidden, so the seed
    // can be told from the default there.
    window.localStorage.setItem(GRID_STEM, 'false');

    const { style: first } = load();
    first.setGraphView('fullscreen');
    expect(first.getGraphGridHidden()).toBe(false);
    first.toggleGraphGrid();
    expect(first.getGraphGridHidden()).toBe(true);

    // A restart. The flat key is gone, so there is nothing left to seed from
    // and the two modes stand on their own — which is the point of deleting
    // it rather than leaving it as a fallback. A fallback would still find
    // `false` sitting there and put the grid back in both.
    const { style: second } = load();
    second.setGraphView('fullscreen');
    expect(second.getGraphGridHidden()).toBe(true);
    second.setGraphView('normal');
    expect(second.getGraphGridHidden()).toBe(false);
  });

  it('lets a flat key win if an older build ever writes one again', () => {
    // Only reachable by running an old build after a new one: it writes the
    // flat key and knows nothing about the per-mode keys. Its value is then the most
    // recent thing the user actually asked for, so it takes over rather than
    // being ignored beside per-mode keys that are now stale.
    window.localStorage.setItem(`${GRID_STEM}.normal`, 'false');
    window.localStorage.setItem(`${GRID_STEM}.fullscreen`, 'false');
    window.localStorage.setItem(GRID_STEM, 'true');

    const { style } = load();

    expect(style.getGraphGridHidden()).toBe(true);
    expect(stored(`${GRID_STEM}.fullscreen`)).toBe('true');
  });

  it('leaves a fresh install on the defaults and writes nothing', () => {
    const { style, overlay } = load();

    expect(style.getGraphGridHidden()).toBe(false);
    expect(style.getGraphWaveHeight()).toBe(1);
    expect(overlay.getOverlayOpacity()).toBe(1);
    expect(overlay.getOverlayBlur()).toBe(0);
    expect(stored(`${GRID_STEM}.normal`)).toBeNull();
    expect(stored(`${OPACITY_STEM}.fullscreen`)).toBeNull();
  });

  it('falls back to the default for a stored value that is not a number', () => {
    window.localStorage.setItem(`${BLUR_STEM}.normal`, 'quite a lot');

    const { overlay } = load();

    expect(overlay.getOverlayBlur()).toBe(0);
  });

  it('remembers each mode across a restart', () => {
    const { style: first } = load();
    first.setGraphView('fullscreen');
    first.toggleGraphGrid();
    first.setGraphWaveHeight(0.4);

    const { style: second } = load();
    // The view is remembered too, so the reopened app is where it was left.
    expect(second.getGraphView()).toBe('fullscreen');
    expect(second.getGraphWaveHeight()).toBe(0.4);
    // Full screen hides the grid by default, so the toggle above turned it back
    // ON — and that is what has to survive. A default that came back after a
    // restart would look identical to a value that was remembered, which is
    // exactly the bug this test exists to catch.
    expect(second.getGraphGridHidden()).toBe(false);
    // And the wave height is each mode's own as well: the pane reopens at its
    // own starting full height rather than at what was set in full screen.
    second.setGraphView('normal');
    expect(second.getGraphWaveHeight()).toBe(1);
  });
});
