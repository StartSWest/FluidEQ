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
 * Where every graph preference is kept, and how it is woken.
 *
 * The bottom of a three-part store: this holds the keys and the localStorage
 * access, `graphViewSettings` builds the per-view settings on top of it, and
 * `graphStyle` adds look selection and re-exports the lot.
 *
 * It exists as its own file for one reason. The other two both need these, and
 * without a floor beneath them the settings would have to import the look store
 * and the look store would have to re-export the settings — a cycle that works
 * today and breaks the first time an import order changes.
 */
import { isMemberLookId } from 'common/memberScenes';
import { isPremiumLookId } from 'common/scenePacks';

/**
 * How the live spectrum is drawn, held outside React.
 *
 * A module store rather than a prop, because the two ends are far apart: the
 * legend that changes it sits in the graph's header, and the thing that reads
 * it is a `Line` three components down inside the chart. Threading a prop
 * through Chart and Curve would make every other curve carry a setting that
 * has nothing to do with it.
 *
 * Remembered, like the meter's style — it is a preference, not a mode.
 */
export const STORAGE_KEY = 'fluideq-graph-style';

/**
 * The graph's view settings, remembered.
 *
 * These used to be deliberately forgotten, on the reasoning that a mode which
 * outlives a restart is how somebody ends up convinced their sliders have
 * vanished — and that a window coming back full screen with no visible way out
 * is worse still. Both are real, and they are the reason the reasoning is
 * written here rather than quietly reversed.
 *
 * They are remembered anyway because of what the graph turned into. It is not
 * only a measurement now: it is a visualiser somebody sets up the way they want
 * it — this form, mirrored, no grid, full-height, full screen — and then leaves
 * running. Rebuilding that arrangement by hand on every launch is the cost of
 * the old rule, and it is paid every single time. The way out is also better
 * signposted than it was: Escape leaves, the View menu lists every one of these
 * with its shortcut, and the sidebar switch turns the graph off entirely.
 */
export const VIEW_KEYS = {
  // Most of these are not keys any more but *stems*. Anything the graph keeps
  // one of per view mode is stored under `<stem>.normal`, `<stem>.expanded` and
  // `<stem>.fullscreen` — see `createPerViewSetting`, which is also the only
  // thing that still reads the bare stem, once, to move an older install's
  // value across. The Plus looks' own copies are `<stem>.plus.<mode>`, and
  // `<stem>.families` marks that the copy from before the split was made
  // (`getGraphLookFamily`).
  //
  // Four are still flat, and each says why where it is used: the meter and the
  // titlebar wave are not on the plot at all, the orientation is a property of
  // the drawing rather than of how much screen it has, and the view is the
  // thing the rest are indexed by. Wave height and position are per-view: a
  // low wave over a film and a tall one in the editing pane are independent
  // arrangements.
  wave: 'fluideq.graphWaveHidden',
  quietEq: 'fluideq.graphQuietEq',
  bandLabels: 'fluideq.graphBandLabelsHidden',
  solo: 'fluideq.graphSolo',
  clean: 'fluideq.graphClean',
  grid: 'fluideq.graphGridHidden',
  coverage: 'fluideq.graphCoverageHidden',
  meter: 'fluideq.graphMeterHidden',
  titlebarWave: 'fluideq.titlebarWaveHidden',
  waveHeight: 'fluideq.graphWaveHeight',
  wavePosition: 'fluideq.graphWavePosition',
  orientation: 'fluideq.waveOrientation',
  view: 'fluideq.graphView',
};

export const readStored = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can be unavailable; every one of these has a sane default.
    return null;
  }
};

export const writeStored = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not worth failing a mode change over.
  }
};

export const removeStored = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Only reachable if storage is unavailable altogether, in which case the
    // write that was supposed to replace this key did nothing either and there
    // is nothing to be inconsistent about.
  }
};

export const readStoredFlag = (key: string): boolean =>
  readStored(key) === 'true';

/**
 * A plain remembered on/off, for the switches that are the same in every view.
 *
 * The per-view machinery below exists for settings whose right answer genuinely
 * differs between editing bands and watching a video — the grid, the coverage
 * wash. A switch that means the same thing in all three modes wants none of
 * that, and building it out of `createPerViewSetting` would store three copies
 * of one answer and let them drift.
 */
export const createFlagSetting = (key: string, fallback: boolean) => {
  let value = readStored(key) === null ? fallback : readStoredFlag(key);
  const flagListeners = new Set<() => void>();
  return {
    get: () => value,
    set: (next: boolean) => {
      if (next === value) {
        return;
      }
      value = next;
      writeStored(key, String(next));
      flagListeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      flagListeners.add(listener);
      return () => {
        flagListeners.delete(listener);
      };
    },
  };
};

/**
 * Every per-view setting's "your value has changed underneath you" call.
 *
 * Filled by `createPerViewSetting` and rung by `setGraphView`. It lives up here
 * with the rest of the storage machinery because the two ends are far apart in
 * the file: the things that fill it run from the plot's contents at the top to
 * wave placement at the bottom, and the view store that rings it sits between
 * them.
 */
export const perViewEmitters = new Set<() => void>();

/**
 * The same wake-up, for a listener set the factory knows nothing about.
 *
 * Four of the per-view settings — solo, the quiet EQ curve, the hidden wave and
 * the hidden curves — keep their own listener sets beside the setting, because
 * their hooks and `subscribeContents` were written against those sets long
 * before any of this was per mode, and every subscriber in the app is still on
 * them. So the emitter `createPerViewSetting` registers reaches nobody who is
 * watching the plot: on Ctrl+F the trace kept drawing the mode it came from,
 * with the right answer sitting in the store underneath it, until some unrelated
 * render knocked it loose. Registering the sets here is what closes that gap.
 */
export const wakeOnViewChange = (set: Set<() => void>) => {
  perViewEmitters.add(() => {
    set.forEach((listener) => listener());
  });
};

/**
 * WHICH FAMILY OF LOOK THE GRAPH IS DRAWING, the second thing every per-view
 * setting is kept by (Ivan, 2026-11-08: "the graph grid and waves etc needs
 * to work separate non standard viz vs plus viz so I can for example turn off
 * graph grid on plus and when switching to standard it still shows the grid
 * there").
 *
 * A standard look is a measurement drawn on the plot's own paper; a Plus
 * visualizer is a picture the plot stands over. The grid, the wave, the
 * see-through sliders and the rest are set up differently for each, and one
 * value for both meant every switch between them undid the other's.
 *
 * `plus` is a Plus look or a member's scene, as the selection says; a scene
 * this session set aside is drawn as its free fallback form and is
 * `standard`, because that is what is on the plot. Read from the stored
 * selection here, so the very first read is right before the look store has
 * loaded, and kept by `graphStyle` from then on (`setGraphLookFamily`).
 */
export type TGraphLookFamily = 'standard' | 'plus';

export const lookFamilyOf = (lookId: string): TGraphLookFamily =>
  isPremiumLookId(lookId) || isMemberLookId(lookId) ? 'plus' : 'standard';

let lookFamily: TGraphLookFamily = lookFamilyOf(readStored(STORAGE_KEY) ?? '');

export const getGraphLookFamily = () => lookFamily;

/**
 * Every per-view setting has a new answer the moment the family moves, and
 * not one of them was set: rung like a change of view (`setGraphView`), so
 * the plot and the View menu draw the family now on screen.
 */
export const setGraphLookFamily = (next: TGraphLookFamily) => {
  if (next === lookFamily) {
    return;
  }
  lookFamily = next;
  perViewEmitters.forEach((emit) => emit());
};
