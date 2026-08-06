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

/**
 * Not exported, and there is nothing left that should set this directly.
 *
 * The Video tab used to force it on while it was open and put the old value
 * back on the way out. That decided for people — the graph is over a video so
 * the curve can be read against what is playing, and taking the curves away is
 * the opposite of that — so it went, and the pair of helpers it needed went
 * with it. Ctrl+W is how anybody says they want the wave alone.
 */
const setLiveOutputSolo = (next: boolean) => {
  if (next === isSolo) {
    return;
  }
  isSolo = next;
  soloListeners.forEach((listener) => listener());
};

export const toggleLiveOutputSolo = () => setLiveOutputSolo(!isSolo);

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
 * Whether the grid, the axes and their labels are drawn.
 *
 * Separate from solo, which hides the *curves* — the EQ response, the voicing,
 * the driver. This hides the paper they are drawn on: the decibel scale down
 * the side, the frequency marks along the bottom, the lines between them.
 *
 * Two switches because they are two different things to want. Solo is for
 * reading the live trace without four other curves across it, and the grid is
 * exactly what you keep for that — a spectrum with no scale is a pretty shape
 * rather than a measurement. Turning the grid off is for when it has stopped
 * being a measurement on purpose: a visualiser, over a video, with the graph
 * pared back to nothing but the wave.
 *
 * Not persisted, like the modes it sits beside. A graph that comes back with no
 * axes is a graph somebody will report as broken.
 */
let isGridHidden = false;

const gridListeners = new Set<() => void>();

export const toggleGraphGrid = () => {
  isGridHidden = !isGridHidden;
  gridListeners.forEach((listener) => listener());
};

const subscribeGrid = (listener: () => void) => {
  gridListeners.add(listener);
  return () => {
    gridListeners.delete(listener);
  };
};

export const useGraphGridHidden = () =>
  useSyncExternalStore(
    subscribeGrid,
    () => isGridHidden,
    () => false,
  );

/**
 * Whether full screen keeps FluidEQ's own top bar.
 *
 * On by default. Somebody arriving in this mode for the first time should still
 * be able to see where they are and how to get back — the creature, the
 * waveform and the actions menu all live in that bar — and the version without
 * it is the one to opt into rather than the one to discover you are in. The
 * switch is in the View menu beside the modes themselves, so taking it away is
 * one press from the control that got you here.
 *
 * One switch rather than one per element. The bar is a single row and the parts
 * of it are not independently useful: a waveform with no creature beside it is
 * the same bar with a hole in it.
 *
 * Not persisted, like the modes it sits beside.
 */
let hasFullScreenTopBar = true;

const topBarListeners = new Set<() => void>();

export const toggleFullScreenTopBar = () => {
  hasFullScreenTopBar = !hasFullScreenTopBar;
  topBarListeners.forEach((listener) => listener());
};

const subscribeTopBar = (listener: () => void) => {
  topBarListeners.add(listener);
  return () => {
    topBarListeners.delete(listener);
  };
};

export const useFullScreenTopBar = () =>
  useSyncExternalStore(
    subscribeTopBar,
    () => hasFullScreenTopBar,
    () => false,
  );

/**
 * Which way up the live trace is drawn.
 *
 *  - `up` — standing on the bottom, as it always has.
 *  - `down` — hanging from the top. Bars become stalactites, a filled wave
 *    becomes a ceiling.
 *  - `mirrored` — both at once, each growing in from its own edge, so loud
 *    frames meet in the middle.
 *  - `centred` — both at once, both growing *out* from the middle, so a loud
 *    frame reaches the top and the bottom together. This is the one that looks
 *    like a waveform in an editor; the other is the one that looks like a pair
 *    of spectrum analysers facing each other. Both are worth having and they
 *    are not interchangeable.
 *
 * Every one of the forty looks is drawn from the same points, so this is done
 * to the points and all forty follow. A CSS flip on the path would have been
 * fewer lines and wrong: it would fight the transforms some looks already set
 * for themselves, and mirror the glow and the lit tips with the shape — right
 * for the geometry, wrong for the light.
 */
export type TWaveOrientation = 'up' | 'down' | 'mirrored' | 'centred';

const ORIENTATIONS: TWaveOrientation[] = ['up', 'down', 'mirrored', 'centred'];

let orientation: TWaveOrientation = 'up';

const orientationListeners = new Set<() => void>();

/** Cycles, because three states on one control is a cycle. */
export const cycleWaveOrientation = () => {
  orientation =
    ORIENTATIONS[(ORIENTATIONS.indexOf(orientation) + 1) % ORIENTATIONS.length];
  orientationListeners.forEach((listener) => listener());
};

const subscribeOrientation = (listener: () => void) => {
  orientationListeners.add(listener);
  return () => {
    orientationListeners.delete(listener);
  };
};

export const useWaveOrientation = () =>
  useSyncExternalStore(
    subscribeOrientation,
    () => orientation,
    () => 'up' as TWaveOrientation,
  );

/**
 * Whether the plot fills the card or keeps its share of it.
 *
 * The larger modes centre the drawing at two thirds of the card's height, on
 * the reasoning that a frequency response stretched over a whole monitor is a
 * shape that says nothing except that the window is tall. That is right for
 * reading a response and wrong for watching one: a spectrum used as a
 * visualiser wants every pixel it can have, and the vertical exaggeration that
 * ruins a measurement is exactly what makes a wave worth looking at.
 *
 * So it is a switch rather than a decision made here, and it sits beside the
 * others in the view menu.
 */
let isStretched = false;

const stretchListeners = new Set<() => void>();

export const toggleGraphStretch = () => {
  isStretched = !isStretched;
  stretchListeners.forEach((listener) => listener());
};

const subscribeStretch = (listener: () => void) => {
  stretchListeners.add(listener);
  return () => {
    stretchListeners.delete(listener);
  };
};

export const useGraphStretched = () =>
  useSyncExternalStore(
    subscribeStretch,
    () => isStretched,
    () => false,
  );

/**
 * How much of the screen the graph has, in three steps.
 *
 * Held here rather than in the chart because the things that have to move are
 * not the chart — they are the EQ panel above it and, at the far end, the
 * window itself. A pane cannot hide its own neighbour, so every end reads this.
 *
 *  - `normal` — the split. The graph is a pane among panes.
 *  - `expanded` — the graph covers the workspace column, floating over
 *    whichever editor is open. The side panels, the titlebar and the tabs are
 *    all still there; this is a bigger graph, not a different screen.
 *  - `fullscreen` — the window goes fullscreen and everything that is not the
 *    player and the graph goes with it. For watching something, rather than for
 *    working on it.
 *
 * Two steps rather than one because they answer different questions. Expanded
 * is "I want to see the trace better while I work"; fullscreen is "I am not
 * working, I am listening". Collapsing them into one control meant the second
 * had to be either unavailable or unavoidable.
 *
 * Not persisted, and for the same reason as the solo flag: a mode that outlives
 * a restart is how somebody ends up convinced their sliders are gone. A window
 * that comes back fullscreen with no visible way out is worse still.
 */
export type TGraphView = 'normal' | 'expanded' | 'fullscreen';

let view: TGraphView = 'normal';

const fullScreenListeners = new Set<() => void>();

/**
 * Taking the window fullscreen is the main process's business, so the store
 * cannot do it — and importing an IPC call here would tie a layout preference
 * to the shape of the app's API. App registers what to do instead.
 */
let applyWindowFullScreen: ((next: boolean) => void) | undefined;

export const onWindowFullScreenChange = (apply: (next: boolean) => void) => {
  applyWindowFullScreen = apply;
};

export const setGraphView = (next: TGraphView) => {
  if (next === view) {
    return;
  }
  const wasFullScreen = view === 'fullscreen';
  view = next;
  if (wasFullScreen !== (next === 'fullscreen')) {
    applyWindowFullScreen?.(next === 'fullscreen');
  }
  fullScreenListeners.forEach((listener) => listener());
};

export const getGraphView = () => view;

/**
 * Escape, and the button that says Exit. Always all the way out, from either
 * step — somebody pressing it wants their app back, not the next size down.
 */
export const exitGraphFullScreen = () => setGraphView('normal');

/** Ctrl+S, and the click on the plot's own toggle. */
export const toggleGraphExpanded = () =>
  setGraphView(view === 'expanded' ? 'normal' : 'expanded');

/** Ctrl+F. */
export const toggleGraphFullScreen = () =>
  setGraphView(view === 'fullscreen' ? 'normal' : 'fullscreen');

const subscribeFullScreen = (listener: () => void) => {
  fullScreenListeners.add(listener);
  return () => {
    fullScreenListeners.delete(listener);
  };
};

export const useGraphView = () =>
  useSyncExternalStore(
    subscribeFullScreen,
    () => view,
    () => 'normal' as TGraphView,
  );

/**
 * Whether the graph is over the workspace at all.
 *
 * True in both of the larger modes: the card covers the column either way, and
 * everything that only needs to know "is the graph on top of things" — the
 * layout class, the dimension recalculation — asks this rather than matching on
 * the mode and having to be found again when a third one appears.
 */
export const useGraphFullScreen = () => useGraphView() !== 'normal';
