/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>

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

import { useSyncExternalStore } from 'react';
import { GRAPH_LOOKS, IGraphLook, getGraphLook } from 'common/graphStyles';

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
const STORAGE_KEY = 'fluideq-graph-style';

const listeners = new Set<() => void>();

let look: IGraphLook = GRAPH_LOOKS[0];
try {
  look = getGraphLook(window.localStorage.getItem(STORAGE_KEY) || '');
} catch {
  // Storage can be unavailable; the default is a perfectly good curve.
}

export const getGraphLookId = () => look.id;

/**
 * The next look along, for the click on the plot.
 *
 * The picker is for reaching a particular one out of ninety-odd; this is for
 * flicking through them while listening, without moving the pointer off the
 * graph. Backwards with a modifier held, because with a list this long
 * overshooting by one otherwise means going all the way round again.
 */
export const cycleGraphLook = (direction: 1 | -1 = 1) => {
  const index = GRAPH_LOOKS.indexOf(look);
  const count = GRAPH_LOOKS.length;
  look = GRAPH_LOOKS[(index + direction + count) % count];
  try {
    window.localStorage.setItem(STORAGE_KEY, look.id);
  } catch {
    // Not worth failing a click over.
  }
  listeners.forEach((listener) => listener());
};

export const setGraphLook = (id: string) => {
  const next = getGraphLook(id);
  if (next === look) {
    return;
  }
  look = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, look.id);
  } catch {
    // Not worth failing a choice over.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * The whole look, as one stable object.
 *
 * Returned as the object rather than as `{ style, palette }` built per call,
 * because `useSyncExternalStore` compares snapshots by identity and a fresh
 * object every time is an infinite render.
 */
export const useGraphLook = () =>
  useSyncExternalStore(
    subscribe,
    () => look,
    () => GRAPH_LOOKS[0],
  );

/**
 * Whether the graph shows only the live spectrum.
 *
 * With forty-six drawings to look at, the EQ response, the voicing layer, the
 * driver curve and the band handles are all in the way — they are the reason
 * the graph exists, and completely beside the point when what you want is to
 * watch the music. This hides them, leaving the trace alone on the grid.
 *
 * Deliberately NOT persisted. Everything else here is a preference; this one
 * is a mode, and a mode that survives a restart is how somebody ends up
 * convinced their bands have vanished. It lasts as long as the window does.
 */
let isSolo = false;

const soloListeners = new Set<() => void>();

export const setLiveOutputSolo = (next: boolean) => {
  if (next === isSolo) {
    return;
  }
  isSolo = next;
  soloListeners.forEach((listener) => listener());
};

export const toggleLiveOutputSolo = () => setLiveOutputSolo(!isSolo);

/**
 * The current value, for a caller that means to put it back.
 *
 * Read outside React by the Video tab, which turns solo on while it is open —
 * the whole point of watching something with the graph underneath is the trace,
 * not the band handles — and restores whatever was there on the way out.
 */
export const getLiveOutputSolo = () => isSolo;

const subscribeSolo = (listener: () => void) => {
  soloListeners.add(listener);
  return () => {
    soloListeners.delete(listener);
  };
};

export const useLiveOutputSolo = () =>
  useSyncExternalStore(
    subscribeSolo,
    () => isSolo,
    () => false,
  );

/**
 * Whether the graph has the workspace to itself.
 *
 * Held here rather than in the chart because the thing that has to move is not
 * the chart — it is the EQ panel above it, which is a sibling owned by App. A
 * pane cannot hide its own neighbour, so both ends read this instead.
 *
 * Not persisted, and for the same reason as the solo flag: a mode that
 * outlives a restart is how somebody ends up convinced their sliders are gone.
 */
let isFullScreen = false;

const fullScreenListeners = new Set<() => void>();

export const setGraphFullScreen = (next: boolean) => {
  if (next === isFullScreen) {
    return;
  }
  isFullScreen = next;
  fullScreenListeners.forEach((listener) => listener());
};

export const toggleGraphFullScreen = () => setGraphFullScreen(!isFullScreen);

const subscribeFullScreen = (listener: () => void) => {
  fullScreenListeners.add(listener);
  return () => {
    fullScreenListeners.delete(listener);
  };
};

export const useGraphFullScreen = () =>
  useSyncExternalStore(
    subscribeFullScreen,
    () => isFullScreen,
    () => false,
  );
