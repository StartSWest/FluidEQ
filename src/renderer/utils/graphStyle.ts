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
import { GRAPH_LOOKS, getGraphLook } from 'common/graphStyles';
import {
  ICustomLook,
  IResolvedLook,
  isCustomLookId,
  resolveBuiltInLook,
  resolveCustomLook,
} from 'common/customLooks';
import {
  getCustomLook,
  getCustomLooks,
  subscribeCustomLooks,
} from './customLooks';

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
 * it — this form, mirrored, no grid, stretched, full screen — and then leaves
 * running. Rebuilding that arrangement by hand on every launch is the cost of
 * the old rule, and it is paid every single time. The way out is also better
 * signposted than it was: Escape leaves, the View menu lists every one of these
 * with its shortcut, and the sidebar switch turns the graph off entirely.
 */
const VIEW_KEYS = {
  wave: 'fluideq.graphWaveHidden',
  solo: 'fluideq.graphSolo',
  // Two of these are not keys any more but *stems*. The grid and the stretch
  // are kept once per view mode, under `<stem>.normal`, `<stem>.expanded` and
  // `<stem>.fullscreen` — see `createPerViewSetting` at the foot of this file,
  // which is also the only thing that still reads the bare stem, once, to move
  // an older install's value across.
  grid: 'fluideq.graphGridHidden',
  stretch: 'fluideq.graphStretched',
  orientation: 'fluideq.waveOrientation',
  view: 'fluideq.graphView',
};

const readStored = (key: string): string | null => {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Storage can be unavailable; every one of these has a sane default.
    return null;
  }
};

const writeStored = (key: string, value: string) => {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Not worth failing a mode change over.
  }
};

const removeStored = (key: string) => {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Only reachable if storage is unavailable altogether, in which case the
    // write that was supposed to replace this key did nothing either and there
    // is nothing to be inconsistent about.
  }
};

const readStoredFlag = (key: string): boolean => readStored(key) === 'true';

const listeners = new Set<() => void>();

/**
 * Every per-view setting's "your value has changed underneath you" call.
 *
 * Filled by `createPerViewSetting` and rung by `setGraphView`. It lives up here
 * with the rest of the storage machinery because the two ends are far apart in
 * the file: the thing that rings it is the view store in the middle, and the
 * things that fill it are all at the bottom.
 */
const perViewEmitters = new Set<() => void>();

/**
 * What the picker points at.
 *
 * The id rather than the look itself, because a look is no longer always one of
 * a fixed list — a custom one can be edited or deleted while it is selected, and
 * an id survives that where a held object would go stale.
 */
let selectedId = GRAPH_LOOKS[0].id;
try {
  selectedId = window.localStorage.getItem(STORAGE_KEY) || selectedId;
} catch {
  // Storage can be unavailable; the default is a perfectly good curve.
}

/**
 * The look being edited right now, which the chart draws instead of the
 * selection while the designer is open.
 *
 * This is the whole preview mechanism. Rather than build a second chart with a
 * second analyser to show what a tuning looks like, the real graph — which is
 * already drawing the real audio a few inches away — is asked to draw the draft.
 * So what the user is judging is the actual figure at actual size, and closing
 * the panel without saving simply drops this and the selection reappears.
 *
 * Never persisted: an unsaved draft that outlived a restart would be a look the
 * user cannot find in the picker and cannot get rid of.
 */
let draft: ICustomLook | null = null;

const computeResolved = (): IResolvedLook => {
  if (draft) {
    return resolveCustomLook(draft);
  }
  const custom = getCustomLook(selectedId);
  if (custom) {
    return resolveCustomLook(custom);
  }
  // `getGraphLook` answers with the first look for anything it does not know,
  // which is what a stale id from an older version or a deleted custom look
  // lands on.
  return resolveBuiltInLook(getGraphLook(selectedId));
};

/**
 * The resolved look, built once per change rather than per read.
 *
 * `useSyncExternalStore` compares snapshots by identity, so resolving inside
 * the getter would hand React a new object every time it looked and re-render
 * the chart forever.
 */
let resolved: IResolvedLook = computeResolved();

const refresh = () => {
  resolved = computeResolved();
  listeners.forEach((listener) => listener());
};

const persistSelection = () => {
  try {
    window.localStorage.setItem(STORAGE_KEY, selectedId);
  } catch {
    // Not worth failing a choice over.
  }
};

/**
 * Every look that can be selected, built-ins first.
 *
 * Rebuilt per call rather than cached because it changes whenever a look is
 * saved or deleted, and the two things that ask for it — the picker and the
 * click-to-cycle — are both user actions rather than frames.
 *
 * The user's own looks are a parameter, defaulted to the store, because the two
 * callers reach them differently: the cycle reads the store as it stands, and
 * React has to pass what it subscribed to. Reading the store here in both cases
 * would leave the component's memo depending on a value it never mentions,
 * which is a stale list waiting to happen and a lint error besides.
 */
export const getSelectableLooks = (
  customLooks: readonly ICustomLook[] = getCustomLooks(),
): IResolvedLook[] => [
  ...GRAPH_LOOKS.map(resolveBuiltInLook),
  ...customLooks.map(resolveCustomLook),
];

export const getGraphLookId = () => selectedId;

/**
 * What is on the graph right now, with every setting already worked out.
 *
 * For the designer, which starts a new look from what is being looked at rather
 * than from the form's own defaults. Those are two different things the moment
 * anything has been tuned — and starting from the defaults meant opening the
 * panel visibly changed the drawing before a single control had been touched.
 */
export const getResolvedLook = (): IResolvedLook => resolved;

/**
 * The next look along, for the click on the plot.
 *
 * The picker is for reaching a particular one out of ninety-odd; this is for
 * flicking through them while listening, without moving the pointer off the
 * graph. Backwards with a modifier held, because with a list this long
 * overshooting by one otherwise means going all the way round again.
 *
 * Walks the user's own looks too, at the end of the list, so a look somebody
 * made is reachable the same way as one that shipped.
 */
export const cycleGraphLook = (direction: 1 | -1 = 1) => {
  // Deliberately live while the designer is open.
  //
  // This used to refuse, on the reasoning that the draft covers the selection
  // so nothing would appear to happen. That was the wrong end to fix: the
  // designer now follows the selection instead, so the arrows, Space and the
  // click on the plot are how the form is chosen while building a look — which
  // is one control doing one job rather than a second form picker inside the
  // panel duplicating the one already in the header.
  const ids = getSelectableLooks().map((look) => look.id);
  const index = ids.indexOf(selectedId);
  const count = ids.length;
  // An unknown selection cycles from the start rather than from -1, which
  // would otherwise step backwards into the last entry.
  selectedId = ids[(Math.max(0, index) + direction + count) % count];
  persistSelection();
  refresh();
};

export const setGraphLook = (id: string) => {
  if (id === selectedId) {
    return;
  }
  selectedId = id;
  persistSelection();
  refresh();
};

/**
 * Show this tuning on the graph until told otherwise.
 *
 * Passing `null` puts the selection back, which is what closing the designer
 * without saving does.
 */
export const setLookDraft = (next: ICustomLook | null) => {
  draft = next;
  refresh();
};

// A look can change or vanish underneath the selection while it is being
// drawn, so the drawing has to be rebuilt when the list does. A deleted look
// also has to give the selection somewhere to land: leaving it pointing at
// nothing works — the resolver falls back — but it would silently re-point at
// the first look the next time somebody cycled, from an id that no longer
// means anything.
subscribeCustomLooks(() => {
  if (isCustomLookId(selectedId) && !getCustomLook(selectedId)) {
    selectedId = GRAPH_LOOKS[0].id;
    persistSelection();
  }
  refresh();
});

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const DEFAULT_RESOLVED = resolveBuiltInLook(GRAPH_LOOKS[0]);

/**
 * The whole look, as one stable object: which form, which palette, and every
 * number needed to draw it.
 *
 * Draft-aware, so this is what the chart should draw — not necessarily what the
 * picker is pointing at. Anything that needs the selection itself wants
 * `useSelectedLookId`.
 */
export const useGraphLook = () =>
  useSyncExternalStore(
    subscribe,
    () => resolved,
    () => DEFAULT_RESOLVED,
  );

/**
 * What the picker shows.
 *
 * Separate from the look above because a draft deliberately shadows the
 * selection: while the designer is open the chart draws an unsaved look whose
 * id is in no list, and a picker fed that id would go blank.
 */
export const useSelectedLookId = () =>
  useSyncExternalStore(
    subscribe,
    () => selectedId,
    () => GRAPH_LOOKS[0].id,
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
let isSolo = readStoredFlag(VIEW_KEYS.solo);

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
  // Wave only, with the wave switched off, is an empty graph.
  //
  // The two settings were independent and one combination of them showed
  // nothing at all: solo drops the EQ curves, hiding the wave drops the trace,
  // and together they leave a grid. Asking for the wave alone is asking for the
  // wave, so it comes back — see `setWaveHidden` for the other half of this,
  // which is the same rule approached from the other side.
  if (next && isWaveHidden) {
    setWaveHidden(false);
  }
  isSolo = next;
  writeStored(VIEW_KEYS.solo, String(isSolo));
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
 * Whether the live wave is drawn at all.
 *
 * Distinct from solo, which hides the *other* curves, and from the grid, which
 * hides the paper. This hides the visualiser itself and leaves the measurement:
 * the response being edited, the layers under it, the band handles, the axes.
 *
 * Worth having on its own terms — the graph is a tool as well as a toy, and a
 * trace jumping about over the curve you are dragging is not always wanted. It
 * also takes the whole live drawing out of the tree rather than merely stilling
 * it, which is a thing nothing else here could do.
 */
let isWaveHidden = readStoredFlag(VIEW_KEYS.wave);

const waveListeners = new Set<() => void>();

function setWaveHidden(next: boolean) {
  if (next === isWaveHidden) {
    return;
  }
  isWaveHidden = next;
  writeStored(VIEW_KEYS.wave, String(isWaveHidden));
  waveListeners.forEach((listener) => listener());
}

export const toggleGraphWave = () => {
  const next = !isWaveHidden;
  // The other half of the rule in `setLiveOutputSolo`: with the curves already
  // dropped by solo, taking the wave away as well would leave a bare grid. The
  // curves come back rather than the request being refused, because a control
  // that quietly does nothing is worse than one that does something sensible.
  if (next && isSolo) {
    setLiveOutputSolo(false);
  }
  setWaveHidden(next);
};

const subscribeWave = (listener: () => void) => {
  waveListeners.add(listener);
  return () => {
    waveListeners.delete(listener);
  };
};

export const useGraphWaveHidden = () =>
  useSyncExternalStore(
    subscribeWave,
    () => isWaveHidden,
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

let orientation: TWaveOrientation =
  ORIENTATIONS.find((entry) => entry === readStored(VIEW_KEYS.orientation)) ??
  'up';

const orientationListeners = new Set<() => void>();

/** Cycles, because three states on one control is a cycle. */
export const cycleWaveOrientation = () => {
  orientation =
    ORIENTATIONS[(ORIENTATIONS.indexOf(orientation) + 1) % ORIENTATIONS.length];
  writeStored(VIEW_KEYS.orientation, orientation);
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

const GRAPH_VIEWS: TGraphView[] = ['normal', 'expanded', 'fullscreen'];

let view: TGraphView =
  GRAPH_VIEWS.find((entry) => entry === readStored(VIEW_KEYS.view)) ?? 'normal';

const fullScreenListeners = new Set<() => void>();

/**
 * Taking the window fullscreen is the main process's business, so the store
 * cannot do it — and importing an IPC call here would tie a layout preference
 * to the shape of the app's API. App registers what to do instead.
 */
let applyWindowFullScreen: ((next: boolean) => void) | undefined;

export const onWindowFullScreenChange = (apply: (next: boolean) => void) => {
  applyWindowFullScreen = apply;
  // A restored full screen has to be applied the moment there is something to
  // apply it with. The store is read at import, long before App is mounted to
  // register this — so without it the app comes back believing it is full
  // screen, lays itself out that way, and sits in a window that is not.
  if (view === 'fullscreen') {
    apply(true);
  }
};

export const setGraphView = (next: TGraphView) => {
  if (next === view) {
    return;
  }
  const wasFullScreen = view === 'fullscreen';
  view = next;
  writeStored(VIEW_KEYS.view, view);
  if (wasFullScreen !== (next === 'fullscreen')) {
    applyWindowFullScreen?.(next === 'fullscreen');
  }
  // Every per-view setting has a new answer now, and not one of them was set.
  //
  // Their getters already read the right thing the instant `view` moved — they
  // index the current mode. What has not happened is anybody being told, and
  // `useSyncExternalStore` re-reads only when its subscription fires. Without
  // this line the chart and the View menu keep drawing the mode they came from
  // until some unrelated render knocks them out of it, which on screen is
  // indistinguishable from the setting never having been saved.
  perViewEmitters.forEach((emit) => emit());
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

/**
 * A setting the graph keeps one of per view mode.
 *
 * These were one value each, shared by all three modes, and that turned out to
 * be wrong about what they are. Hiding the grid is the sort of thing somebody
 * does on the way *into* full screen — full screen is where the graph stops
 * being a measurement and becomes something to watch — and it is the first
 * thing they want back when the window is a pane among panes again. One shared
 * value made the return trip cost a second visit to the menu, every time, in
 * both directions, which is how a setting ends up not being used.
 *
 * What is deliberately *not* here is the look. Which visualiser is on the graph
 * follows you between the modes, because it is a choice about the thing being
 * drawn rather than about how much of the screen it has, and a picker that
 * silently pointed somewhere else after Ctrl+F would be its own bug.
 *
 * Held as three loaded values rather than a read from storage per access:
 * `useSyncExternalStore` asks its getter on every render of every subscriber,
 * and `localStorage.getItem` is a synchronous trip out of the JavaScript heap.
 */
export interface IPerViewSetting<T> {
  /** The value for whichever mode the graph is in right now. */
  get: () => T;
  /** Sets it for the current mode only; the other two are left alone. */
  set: (next: T) => void;
  subscribe: (listener: () => void) => () => void;
}

/**
 * The stored keys are the old flat key with the mode appended —
 * `fluideq.graphGridHidden.expanded`. Appending rather than prefixing keeps the
 * three of them sorted next to each other and next to their old name, which is
 * what anybody reading the storage in devtools is actually trying to do.
 *
 * Exported because `graphOverlay` needs the same thing for the see-through
 * sliders, and the machinery has to live on this side: it is keyed by the
 * current view, which is this file's business. The dependency runs one way —
 * overlay knows about the view, the view knows nothing about overlay.
 */
export const createPerViewSetting = <T>(
  /** The old flat key, now the stem that the three real keys hang off. */
  stem: string,
  fallback: T,
  parse: (raw: string) => T,
  serialize: (value: T) => string,
): IPerViewSetting<T> => {
  const keyFor = (mode: TGraphView) => `${stem}.${mode}`;

  /**
   * What somebody already had, carried across — once, on the first read after
   * the update that split these.
   *
   * All three modes are seeded from the one old value rather than one mode
   * being picked to inherit it. Whatever was set was set with no notion of
   * modes at all, so it is equally true of every one of them; giving it to one
   * would mean an app that appears to have forgotten a setting for two thirds
   * of the time it is used.
   *
   * The old key is then removed rather than kept as a fallback. A fallback
   * would work and would leave the format ambiguous forever: every future
   * reader would have to understand both shapes, and there would never be a
   * point at which the flat key could be dropped, because nothing would
   * distinguish a migrated install from a fresh one. Deleting it makes the
   * presence of a flat key mean exactly one thing — this storage was last
   * written by a build from before the split, and that value is the truth for
   * all three modes, including any per-view keys an in-between build left
   * behind.
   */
  const legacy = readStored(stem);
  if (legacy !== null) {
    GRAPH_VIEWS.forEach((mode) => writeStored(keyFor(mode), legacy));
    removeStored(stem);
  }

  // Written out rather than built by folding `GRAPH_VIEWS`, so that adding a
  // fourth mode is a compiler error here rather than a mode that quietly reads
  // `undefined` and draws whatever that coerces to.
  const values: Record<TGraphView, T> = {
    normal: fallback,
    expanded: fallback,
    fullscreen: fallback,
  };
  GRAPH_VIEWS.forEach((mode) => {
    const raw = readStored(keyFor(mode));
    if (raw !== null) {
      values[mode] = parse(raw);
    }
  });

  const settingListeners = new Set<() => void>();
  const emit = () => {
    settingListeners.forEach((listener) => listener());
  };

  perViewEmitters.add(emit);

  return {
    get: () => values[view],
    set: (next: T) => {
      if (next === values[view]) {
        return;
      }
      values[view] = next;
      writeStored(keyFor(view), serialize(next));
      emit();
    },
    subscribe: (listener: () => void) => {
      settingListeners.add(listener);
      return () => {
        settingListeners.delete(listener);
      };
    },
  };
};

const parseFlag = (raw: string) => raw === 'true';
const serializeFlag = (value: boolean) => String(value);

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
 * Which is the whole argument for it being per mode. That last sentence
 * describes full screen and nothing else, and the same person editing bands in
 * the normal view wants every label they can get.
 */
const gridSetting = createPerViewSetting(
  VIEW_KEYS.grid,
  false,
  parseFlag,
  serializeFlag,
);

export const toggleGraphGrid = () => {
  gridSetting.set(!gridSetting.get());
};

/**
 * The same answer outside a render, for the same reason `getGraphView` exists
 * beside `useGraphView`: not everything that needs to know is a component.
 */
export const getGraphGridHidden = () => gridSetting.get();

export const useGraphGridHidden = () =>
  useSyncExternalStore(gridSetting.subscribe, gridSetting.get, () => false);

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
 * others in the view menu — one per mode, because reading and watching are
 * usually done in different ones.
 */
const stretchSetting = createPerViewSetting(
  VIEW_KEYS.stretch,
  false,
  parseFlag,
  serializeFlag,
);

export const toggleGraphStretch = () => {
  stretchSetting.set(!stretchSetting.get());
};

/** Outside a render. See `getGraphGridHidden`. */
export const getGraphStretched = () => stretchSetting.get();

export const useGraphStretched = () =>
  useSyncExternalStore(
    stretchSetting.subscribe,
    stretchSetting.get,
    () => false,
  );
