/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

/**
 * The graph's settings once more apart: one set for the standard looks and
 * one for Plus visualizers (Ivan, 2026-11-08: "turn off graph grid on plus
 * and when switching to standard it still shows the grid there").
 *
 * Each case loads fresh stores over what is in `localStorage`, which is what
 * a restart is, as `graphViewSettings.test.ts` does.
 */

import type { TGraphView } from 'renderer/utils/graphStyle';

type TGraphStyle = typeof import('renderer/utils/graphStyle');
type TGraphStorage = typeof import('renderer/utils/graphStorage');

interface IStores {
  style: TGraphStyle;
  storage: TGraphStorage;
}

const load = (): IStores => {
  const loaded: { stores?: IStores } = {};
  jest.isolateModules(() => {
    loaded.stores = {
      // eslint-disable-next-line global-require -- a fresh copy, read with what is stored now
      style: require('renderer/utils/graphStyle'),
      // eslint-disable-next-line global-require -- the same copy's floor
      storage: require('renderer/utils/graphStorage'),
    };
  });
  if (!loaded.stores) {
    throw new Error('the graph settings did not load');
  }
  return loaded.stores;
};

const MODES: TGraphView[] = ['normal', 'expanded', 'fullscreen'];
const GRID_STEM = 'fluideq.graphGridHidden';
const PLUS_LOOK = 'premium:aurora';
const STANDARD_LOOK = 'analyzer-auto';
const MEMBER_LOOK = 'member:someone-lake';

describe('one set of graph settings per family of look', () => {
  beforeEach(() => window.localStorage.clear());

  it('keeps the grid a Plus look turned off away from the standard looks', () => {
    const { style, storage } = load();
    style.setGraphView('normal');
    storage.setGraphLookFamily('plus');
    style.toggleGraphGrid();
    expect(style.getGraphGridHidden()).toBe(true);
    storage.setGraphLookFamily('standard');
    // The split: still on where it was on.
    expect(style.getGraphGridHidden()).toBe(false);
    // The control: back on the Plus look, it is still off there.
    storage.setGraphLookFamily('plus');
    expect(style.getGraphGridHidden()).toBe(true);
  });

  it('keeps each family’s wave height and hidden wave its own, across a restart', () => {
    let { style, storage } = load();
    style.setGraphView('expanded');
    storage.setGraphLookFamily('standard');
    style.setGraphWaveHeight(0.4);
    style.toggleGraphWave();
    storage.setGraphLookFamily('plus');
    style.setGraphWaveHeight(0.9);
    ({ style, storage } = load());
    storage.setGraphLookFamily('standard');
    expect(style.getGraphWaveHeight()).toBeCloseTo(0.4);
    expect(style.getGraphWaveHidden()).toBe(true);
    storage.setGraphLookFamily('plus');
    expect(style.getGraphWaveHeight()).toBeCloseTo(0.9);
    expect(style.getGraphWaveHidden()).toBe(false);
  });

  it('starts both families on what somebody had before the split', () => {
    window.localStorage.setItem(`${GRID_STEM}.normal`, 'true');
    window.localStorage.setItem(`${GRID_STEM}.fullscreen`, 'false');
    const { style, storage } = load();
    MODES.forEach((mode) => {
      if (mode === 'expanded') {
        return;
      }
      style.setGraphView(mode);
      storage.setGraphLookFamily('standard');
      const standard = style.getGraphGridHidden();
      storage.setGraphLookFamily('plus');
      expect(style.getGraphGridHidden()).toBe(standard);
    });
    // Written down, not followed: a change on one side after the update
    // stays on that side.
    style.setGraphView('normal');
    storage.setGraphLookFamily('plus');
    style.toggleGraphGrid();
    storage.setGraphLookFamily('standard');
    expect(style.getGraphGridHidden()).toBe(true);
    expect(window.localStorage.getItem(`${GRID_STEM}.plus.normal`)).toBe(
      'false',
    );
  });

  it('leaves a mode nothing was stored for on the default in both', () => {
    const { style, storage } = load();
    style.setGraphView('expanded');
    storage.setGraphLookFamily('standard');
    style.toggleGraphGrid();
    storage.setGraphLookFamily('plus');
    expect(style.getGraphGridHidden()).toBe(false);
  });

  it('follows the look chosen, a Plus scene to a standard look and back', () => {
    const { style } = load();
    style.setGraphView('normal');
    style.setGraphLook(PLUS_LOOK);
    style.toggleGraphGrid();
    style.setGraphLook(STANDARD_LOOK);
    expect(style.getGraphGridHidden()).toBe(false);
    style.setGraphLook(PLUS_LOOK);
    expect(style.getGraphGridHidden()).toBe(true);
    // A member's scene is a Plus look too.
    style.setGraphLook(MEMBER_LOOK);
    expect(style.getGraphGridHidden()).toBe(true);
  });

  // Without the look store: the overlay settings are read by things that
  // never load it, and they must still answer for the look on the plot.
  it('reads the family from the stored look before the look store has loaded', () => {
    window.localStorage.setItem('fluideq-graph-style', MEMBER_LOOK);
    window.localStorage.setItem(`${GRID_STEM}.families`, '1');
    window.localStorage.setItem(`${GRID_STEM}.plus.normal`, 'true');
    window.localStorage.setItem(`${GRID_STEM}.normal`, 'false');
    const loaded: {
      overlay?: typeof import('renderer/utils/graphOverlaySettings');
    } = {};
    jest.isolateModules(() => {
      // eslint-disable-next-line global-require -- a fresh copy, without the look store
      loaded.overlay = require('renderer/utils/graphOverlaySettings');
    });
    expect(loaded.overlay?.getGraphGridHidden()).toBe(true);
  });

  it('tells everybody watching when the family moves, and only then', () => {
    window.localStorage.setItem(`${GRID_STEM}.plus.normal`, 'true');
    const { style, storage } = load();
    style.setGraphView('normal');
    const told = jest.fn();
    const listener = () => told(style.getGraphGridHidden());
    storage.perViewEmitters.add(listener);
    storage.setGraphLookFamily('plus');
    expect(told).toHaveBeenLastCalledWith(true);
    storage.setGraphLookFamily('standard');
    expect(told).toHaveBeenLastCalledWith(false);
    told.mockClear();
    storage.setGraphLookFamily('standard');
    expect(told).not.toHaveBeenCalled();
    storage.perViewEmitters.delete(listener);
  });
});
