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

import { useSyncExternalStore } from 'react';
import {
  VIEW_KEYS,
  createFlagSetting,
  perViewEmitters,
  readStored,
  removeStored,
  wakeOnViewChange,
  writeStored,
} from './graphStorage';

/**
 * Every graph setting that is remembered per view, and the view itself.
 *
 * The middle of a three-part store. graphStyle.ts was two stores sharing a
 * file: one picks the look — which of the forty forms is drawn and in what
 * colours — and this is the other. Whether the live trace is soloed, what the
 * chart shows, whether the EQ curve is quiet, which wave mode is on: each
 * remembered separately for the split, the expanded pane and full screen,
 * because a chart filling the screen wants different things on it than one
 * sharing a column.
 *
 * The order below is load-bearing and was commented as such where it used to
 * live: createPerViewSetting reads GRAPH_VIEWS while it runs, so a setting
 * declared above that block is a temporal dead zone, not a forward reference.
 */
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
 * Remembered, along with everything indexed by it — the note on `VIEW_KEYS` has
 * the argument, including the two ways remembering it can go wrong and what
 * answers them.
 *
 * THE MODE AND THE PER-VIEW MACHINERY SIT ABOVE EVERY SETTING THAT USES THEM,
 * which is not where they were. `createPerViewSetting` reads `GRAPH_VIEWS` while
 * it runs, so a setting built further up the file than this block would be a
 * temporal dead zone rather than a forward reference — and the settings that
 * live furthest up are the ones Ctrl+W walks. The view store itself, which only
 * ever runs after startup, stays down among the other controls.
 */
export type TGraphView = 'normal' | 'expanded' | 'fullscreen';

const GRAPH_VIEWS: TGraphView[] = ['normal', 'expanded', 'fullscreen'];

let view: TGraphView =
  GRAPH_VIEWS.find((entry) => entry === readStored(VIEW_KEYS.view)) ?? 'normal';

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
  /**
   * One value for every mode, or one per mode where they genuinely differ.
   *
   * Most of these want the same answer everywhere and say so with a single
   * value. A few do not: full screen is the mode somebody is in to *watch*
   * something, so the graph arrives there already out of the way — see through
   * and without its grid — while the same graph in a pane is a measurement and
   * starts solid and ruled. Expressing that as a default beats shipping a
   * default nobody wants and expecting them to find the menu.
   */
  fallback: T | Record<TGraphView, T>,
  parse: (raw: string) => T,
  serialize: (value: T) => string,
): IPerViewSetting<T> => {
  const keyFor = (mode: TGraphView) => `${stem}.${mode}`;
  const isPerMode = (
    value: T | Record<TGraphView, T>,
  ): value is Record<TGraphView, T> =>
    typeof value === 'object' &&
    value !== null &&
    GRAPH_VIEWS.every((mode) => mode in (value as Record<string, unknown>));
  const fallbackFor = (mode: TGraphView): T =>
    isPerMode(fallback) ? fallback[mode] : fallback;

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
    normal: fallbackFor('normal'),
    expanded: fallbackFor('expanded'),
    fullscreen: fallbackFor('fullscreen'),
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
 * Whether the graph shows only the live spectrum.
 *
 * With forty-six drawings to look at, the EQ response, the voicing layer, the
 * driver curve and the band handles are all in the way — they are the reason
 * the graph exists, and completely beside the point when what you want is to
 * watch the music. This hides them, leaving the trace alone on the grid.
 *
 * Per view mode, along with the other four things Ctrl+W moves. The whole
 * reason to want the wave on its own is that the graph has stopped being a
 * measurement for a while, which is what full screen is *for* and almost never
 * what the pane between the sliders and the editor is for. Shared, the key
 * therefore had to be pressed again on the way back — in both directions, every
 * time — and a cycle that has to be re-walked after every Ctrl+F is one nobody
 * finishes learning.
 */
const soloSetting = createPerViewSetting(
  VIEW_KEYS.solo,
  false,
  parseFlag,
  serializeFlag,
);

const soloListeners = new Set<() => void>();

wakeOnViewChange(soloListeners);

/**
 * The blank presentation in the Ctrl+W cycle.
 *
 * This has its own flag instead of borrowing any of the individual visibility
 * switches. Clean is temporary scenery for the media underneath; leaving it
 * must restore the grid, coverage, meter and waves exactly as they were rather
 * than silently rewriting five preferences to get an empty drawing.
 */
const cleanSetting = createPerViewSetting(
  VIEW_KEYS.clean,
  false,
  parseFlag,
  serializeFlag,
);

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
  if (next === soloSetting.get()) {
    return;
  }
  // Wave only, with the wave switched off, is an empty graph.
  //
  // Belt and braces now rather than the rule itself. `setGraphContents` is the
  // only caller and it sets the wave a line later anyway, so this can no longer
  // be the thing that saves the plot — what saves it is that "solo" and "wave
  // hidden" are two *states* rather than two switches, and there is no state in
  // which both are true. Kept because the invariant is worth stating where the
  // flag lives, and because it costs one comparison.
  if (next && waveSetting.get()) {
    setWaveHidden(false);
  }
  soloSetting.set(next);
  soloListeners.forEach((listener) => listener());
};

/**
 * Through the state machine, not straight at the flag.
 *
 * This used to call `setLiveOutputSolo` directly, which made it a second writer
 * of the three flags and let them drift out of step with the hidden curves:
 * coming out of solo left the EQ curve in the hidden list, so the plot claimed
 * to be showing everything while the bands' own line was still gone. Naming the
 * state instead of poking one switch is what keeps that impossible.
 */
export const toggleLiveOutputSolo = () =>
  setGraphContents(soloSetting.get() ? 'everything' : 'wave');

/**
 * The five things the plot can show, in one gesture.
 *
 * Solo and hide-the-wave are two switches making four combinations, one of
 * which is an empty grid — which is why each already turns the other off
 * rather than allow it. Two settings that will not let each other be true are
 * really one choice, and walking it with a single key says so far better than
 * two keys that quietly undo one another.
 *
 * Everything; then everything with the cyan EQ curve quieted; then the curves
 * with the wave switched off; then a clear stage with no graph drawing; then
 * the wave alone.
 *
 * `layers` is the reading state. The bands' own line is the loudest thing on
 * the plot — full weight, a glow, a spectrum gradient and two dozen handles
 * sitting on it — and it is the one curve whose shape is already legible from
 * the sliders underneath. What is not legible anywhere else is what the other
 * layers are doing to it, and they are exactly what it covers. Its handles go
 * with it, since the chart ties them to the curve they draw.
 *
 * `clean` is the watching state. The plot keeps its dimensions so media art and
 * video positioning do not jump, but no graph drawing is mounted: no wave,
 * curves, grid, handles or coverage. Global app instrumentation outside the
 * graph — including the titlebar wave — remains visible.
 *
 * FIVE NAMED STATES, not three loose flags.
 *
 * The flags came first and each arrived for its own reason, which is how they
 * ended up able to contradict each other — and how the legend ended up able to
 * contradict all three. Hiding the EQ curve from its chip left this cycle still
 * believing the view was "everything", so the next press moved to "wave only"
 * and looked like it had done nothing, because the curve it was taking away was
 * already gone.
 *
 * The flags are still what the chart reads, since its components subscribe to
 * them individually. `setGraphContents` is the only thing that moves the plot
 * between states, so they cannot drift apart.
 *
 * `clean` TOOK A STOP RATHER THAN ADDING ONE. The state it replaced was
 * `layersAlone` — the layer curves with the wave switched off and the EQ line
 * quieted — and it differed from `curves` in the weight of exactly one line.
 * The argument for keeping that line drawn at all is written on
 * `quietEqSetting`: it is what the other curves are read *against*. Which is
 * just as good an argument against a whole stop of the cycle spent making it
 * fainter, so the stop went. Nobody was asking the question it answered.
 *
 * Nothing has to be migrated for somebody sitting in it. What is stored is the
 * flags, never the name: a hidden wave with a quiet EQ line derives as `curves`
 * now, which is the same drawing minus one line's weight and is a state that
 * still exists.
 *
 * ONLY THE KEY REACHES ONE OF THEM. `layers` quiets the EQ curve and nothing in
 * the app has a switch for that — the wave toggle, the EQ toggle, the legend
 * chip and the coverage switch between them can build the other four and no
 * more. So the View menu's cycle row is the whole mouse-driven route to it, and
 * it names the state it is in for that reason rather than for tidiness.
 */
export type TGraphContents =
  'everything' | 'layers' | 'curves' | 'clean' | 'wave';

const CONTENTS_ORDER: TGraphContents[] = [
  'everything',
  'layers',
  'curves',
  'clean',
  'wave',
];

/**
 * What each state is called, in one place.
 *
 * Exported because the View menu names the state the plot is in rather than
 * leaving its cycle row saying nothing, and a second list of these words in the
 * menu would be a second thing to keep in step with the machine. These are also
 * what `announceGraphMode` says out loud, so the caption after a keypress and
 * the row under the pointer cannot disagree about what the plot is doing.
 */
export const GRAPH_CONTENTS_LABEL: Record<TGraphContents, string> = {
  everything: 'Everything',
  // Named for what it is rather than 'Layers only', which it never was: the
  // wave is still running underneath, and that is a useful thing to look at.
  // The state that did earn the older name is gone — see `TGraphContents`.
  layers: 'Layers over wave',
  curves: 'Curves only',
  // Short on purpose: it is a clear stage for the media underneath.
  clean: 'Clean',
  wave: 'Wave only',
};

/**
 * Which state the flags add up to.
 *
 * Clean is asked first because it is an explicit presentation override. The
 * individual visibility flags keep their own values underneath it and become
 * observable again as soon as the cycle moves on.
 */
export const getGraphContents = (): TGraphContents => {
  if (cleanSetting.get()) {
    return 'clean';
  }
  if (soloSetting.get()) {
    return 'wave';
  }
  if (waveSetting.get()) {
    return 'curves';
  }
  return quietEqSetting.get() ? 'layers' : 'everything';
};

/**
 * Move the plot to a state. THE ONLY THING THAT MOVES IT BETWEEN STATES.
 *
 * The EQ curve's own hidden flag is set from here as well, because the two
 * questions turned out to be one: "show me no curves" and "hide the EQ curve"
 * are the same request arriving from two controls. Somebody who takes the bands'
 * line away is not asking to read five layer curves against nothing — that line
 * is what the others are read against — so hiding it takes the plot to the wave,
 * and showing it again brings everything back.
 *
 * Clean is deliberately separate from the individual visibility preferences.
 * Reusing the coverage flag made "Clean" mean only "hide listening bands" and
 * also made that independent menu switch unexpectedly change the Ctrl+W state.
 * The explicit flag lets the renderer clear everything without destroying the
 * arrangement that should return afterwards.
 *
 * A `function` rather than a `const`, so it hoists. Everything that changes what
 * the plot shows now comes through here, and two of those — the wave toggle and
 * the solo toggle — sit above it in the file with the flags they used to write
 * directly.
 */
export function setGraphContents(next: TGraphContents) {
  setLiveOutputSolo(next === 'wave');
  setWaveHidden(next === 'curves');
  setEqQuiet(next === 'layers');
  setCurveHidden('eq', next === 'wave');
  cleanSetting.set(next === 'clean');
}

/**
 * The caption belongs to the key, not to the writer.
 *
 * It used to be raised inside `setGraphContents`, which meant every control that
 * named a state got one — including the legend chip, which is on the graph, an
 * inch from where the caption appears. `announceGraphMode` says why that is
 * wrong: a control that was just pressed has already said what it did. So the
 * announcement moved out here, where the one caller that needs it is.
 */
export const cycleGraphContents = () => {
  const at = CONTENTS_ORDER.indexOf(getGraphContents());
  const next = CONTENTS_ORDER[(at + 1) % CONTENTS_ORDER.length];
  setGraphContents(next);
  announceGraphMode(GRAPH_CONTENTS_LABEL[next]);
};

/**
 * Which of the five the plot is in, for anything that draws a control for it.
 *
 * One subscription across the four flags rather than four hooks and a
 * derivation at each call site. The View menu needs the answer three times over
 * — the wave row, the EQ row and the cycle row are all views onto this — and a
 * menu that worked each of them out from a different flag is exactly how it
 * ended up offering to hide a curve that was already gone.
 *
 * Clean has its own subscription because it is the state now; coverage is an
 * independent drawing preference and no longer changes this answer.
 */
const subscribeContents = (listener: () => void) => {
  soloListeners.add(listener);
  waveListeners.add(listener);
  quietEqListeners.add(listener);
  const stopClean = cleanSetting.subscribe(listener);
  return () => {
    soloListeners.delete(listener);
    waveListeners.delete(listener);
    quietEqListeners.delete(listener);
    stopClean();
  };
};

export const useGraphContents = () =>
  useSyncExternalStore(
    subscribeContents,
    getGraphContents,
    () => 'everything' as TGraphContents,
  );

/**
 * Whether the EQ curve is drawn quietly rather than at full weight.
 *
 * The second stop of the cycle, and it used to take the curve away altogether.
 * That was too much: the bands' line is the one everything else is read
 * against, and a plot of four layer curves with nothing to compare them to
 * answers a question nobody asked either. What made it unreadable was never the
 * line, it was its furniture — a three-pixel stroke with a glow, a spectrum
 * gradient, and two dozen handles sitting on top of the very curves you are
 * trying to see behind it.
 *
 * So the furniture goes and the line stays: thin, plain cyan, no glow, no
 * gradient, no handles. Present enough to read the others against, quiet enough
 * to read them at all.
 *
 * Its own flag rather than the hidden-curves set, because the legend chip has
 * to keep meaning what it says. Hiding the EQ curve from the legend hides it;
 * this is a different state and conflating them would leave the chip unable to
 * do the one thing it is for.
 *
 * Per view mode, like the rest of the cycle. This is the reading state, and
 * reading five layer curves against a quiet line is a thing done in the pane
 * beside the sliders, not over a video.
 */
const quietEqSetting = createPerViewSetting(
  VIEW_KEYS.quietEq,
  false,
  parseFlag,
  serializeFlag,
);

const quietEqListeners = new Set<() => void>();

wakeOnViewChange(quietEqListeners);

function setEqQuiet(next: boolean) {
  if (next === quietEqSetting.get()) {
    return;
  }
  quietEqSetting.set(next);
  quietEqListeners.forEach((listener) => listener());
}

export const useGraphEqQuiet = () =>
  useSyncExternalStore(
    (listener: () => void) => {
      quietEqListeners.add(listener);
      return () => {
        quietEqListeners.delete(listener);
      };
    },
    quietEqSetting.get,
    () => false,
  );

/**
 * What the plot just became, said once in the middle of it.
 *
 * A shortcut that changes five things at once is fast to use and impossible to
 * learn: the drawing rearranges and nothing says which of the five you are now
 * in or how many are left. Naming it for a moment turns the key into something
 * somebody can walk without counting.
 *
 * Only for the key. Choosing a state deliberately from the menu or the legend
 * does not need to be told what it did — the control that was pressed says so,
 * and a caption appearing over the graph in answer to a press on the graph's own
 * legend is the app talking over the user.
 *
 * A store rather than state on the chart, because the thing that fires it is a
 * window key handler and the thing that draws it is a div three components down.
 */
const MODE_ANNOUNCEMENT_MS = 1100;

let announcement = '';
/** Bumped per announcement, so the same mode twice still reads as twice. */
let announcementId = 0;
let announcementTimer: ReturnType<typeof setTimeout> | undefined;
const announcementListeners = new Set<() => void>();

const emitAnnouncement = () => {
  announcementListeners.forEach((listener) => listener());
};

export const announceGraphMode = (label: string) => {
  announcement = label;
  announcementId += 1;
  if (announcementTimer) {
    clearTimeout(announcementTimer);
  }
  announcementTimer = setTimeout(() => {
    announcement = '';
    announcementTimer = undefined;
    emitAnnouncement();
  }, MODE_ANNOUNCEMENT_MS);
  emitAnnouncement();
};

const subscribeAnnouncement = (listener: () => void) => {
  announcementListeners.add(listener);
  return () => {
    announcementListeners.delete(listener);
  };
};

/**
 * The caption and a key that changes with every announcement.
 *
 * The key is what lets the same words animate again: React reuses an element
 * whose key has not changed, so cycling back to a mode you were in a moment ago
 * would otherwise put the caption up with its entrance already over.
 */
export const useGraphModeAnnouncement = () => {
  const id = useSyncExternalStore(
    subscribeAnnouncement,
    () => announcementId,
    () => 0,
  );
  return { label: announcement, id };
};

const subscribeSolo = (listener: () => void) => {
  soloListeners.add(listener);
  return () => {
    soloListeners.delete(listener);
  };
};

export const useLiveOutputSolo = () =>
  useSyncExternalStore(subscribeSolo, soloSetting.get, () => false);

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
 *
 * Per view mode, and this is the one where a shared value was worst. Stilling
 * the trace to drag a band is a normal-view thing and switching a visualiser off
 * in full screen leaves an empty card, so the two modes want opposite answers
 * almost by definition.
 */
const waveSetting = createPerViewSetting(
  VIEW_KEYS.wave,
  false,
  parseFlag,
  serializeFlag,
);

const waveListeners = new Set<() => void>();

wakeOnViewChange(waveListeners);

function setWaveHidden(next: boolean) {
  if (next === waveSetting.get()) {
    return;
  }
  waveSetting.set(next);
  waveListeners.forEach((listener) => listener());
}

/**
 * The legend's own caption, and the View menu's row for it.
 *
 * Named states rather than the flag it reads, and that is the fix for a real
 * fault rather than tidying. This used to set the hidden-wave value itself and
 * clear solo by hand, which made it the second writer of a set of values only
 * `setGraphContents` is allowed to touch — and the drift was visible: hiding the
 * wave while the plot was on `wave` left the EQ curve in the hidden-curves list,
 * so the plot said "curves only" with the loudest curve missing, and the next
 * Ctrl+W put it back as if the key had done it.
 *
 * The no-blank-graph rule survives without being written twice. `curves` is a
 * state with the wave off and the curves on, so asking for the wave to go can no
 * longer also take the curves with it.
 */
/**
 * Take the wave off the plot, or put it back. Nothing else moves.
 *
 * It used to name a state — `curves` on the way out, `everything` on the way
 * back — which meant it was never only about the wave. Hiding the wave from
 * `clean` put the coverage wash back; from `layers` it un-quieted the EQ curve;
 * and showing it again restored both, whatever they had been set to. Somebody
 * pressing a switch labelled with the wave got two or three other changes with
 * it and no way to tell which control had done it.
 *
 * So it moves one flag, exactly like `toggleGraphCoverage` — the other switch
 * that names no state and is reversible for that reason.
 *
 * The one thing it cannot do is empty the plot. On `wave` the curves are gone
 * and the wave is all that is left, so hiding it would leave nothing at all;
 * there, and only there, the curves come back — to `curves`, which is the wave
 * hidden with something behind it, and not to `everything`, which would put
 * back the very thing the press asked to remove. That is the same invariant
 * `setLiveOutputSolo` states from the other side.
 */
export const toggleGraphWave = () => {
  if (cleanSetting.get()) {
    setGraphContents('everything');
    return;
  }
  if (!waveSetting.get() && soloSetting.get()) {
    setGraphContents('curves');
    return;
  }
  setWaveHidden(!waveSetting.get());
};

/**
 * The same answer outside a render. See `getGraphGridHidden`.
 *
 * For the key handler, which is registered once and would otherwise read a
 * boolean captured when it was.
 */
export const getGraphWaveHidden = () => waveSetting.get();

const subscribeWave = (listener: () => void) => {
  waveListeners.add(listener);
  return () => {
    waveListeners.delete(listener);
  };
};

export const useGraphWaveHidden = () =>
  useSyncExternalStore(subscribeWave, waveSetting.get, () => false);

/**
 * The curves that can be taken off the plot one at a time.
 *
 * Every id here is a curve the chart builds, and the legend chip naming it is
 * the switch — which is why the ids are these words rather than the chart's
 * internal `'Total Response'` and friends: the store is what both ends agree
 * on, so neither has to know the other's naming.
 */
export const GRAPH_CURVES = [
  'convolution',
  'eq',
  'voicing',
  'driver',
  // Beside the driver, which is the layer it is written next to in the chain
  // and the layer it is: both correct the transducer rather than the taste.
  //
  // Only for whoever reads this list, though — nothing here is ordered. The
  // legend's order is the order the chart pushes its chips, the draw order is
  // the order of `chartData`, and the stored list keeps the order curves were
  // hidden in. Putting it here changes none of those, and a reader who assumed
  // otherwise would be assuming something the file never promised.
  'headphone',
  'smart',
  'custom',
  'total',
] as const;

export type TGraphCurve = (typeof GRAPH_CURVES)[number];

/**
 * Which curves are hidden. DRAWING ONLY — this changes nothing in the config.
 *
 * The distinction matters more here than anywhere else in this file, because
 * the app has a second thing that also makes a curve disappear and it is not
 * this one: bypassing a layer takes its `Include:` out of the Equalizer APO
 * chain, which is audible. Hiding is for reading a crowded plot — six curves is
 * a tangle, and the question is usually about two of them.
 *
 * So the two switches are kept far apart in the interface as well: bypass is
 * the chip in the layer row above the editor, hiding is the chip in the graph's
 * own legend. Neither one is reachable by aiming at the other and missing.
 *
 * Remembered, for the same reason the rest of the view is: somebody who works
 * with the wave and the total alone should not have to say so every morning.
 *
 * Once per view mode, at that. Six curves is a tangle in a pane and a wall over
 * a video, so the list somebody wants off is not the same list in both — and the
 * EQ curve is in this list whenever the plot is on `wave`, which is per mode
 * now, so leaving the curves shared would have let the two disagree about a
 * state the cycle depends on being readable from its flags.
 */
const CURVES_KEY = 'fluideq.graphHiddenCurves';

/** A stable empty list, because a server snapshot must not change identity. */
const NO_CURVES: readonly TGraphCurve[] = [];

const isGraphCurve = (id: string): id is TGraphCurve =>
  (GRAPH_CURVES as readonly string[]).includes(id);

/**
 * A comma-joined list, unchanged from when it was one value.
 *
 * Anything in storage that is not a curve this build draws is dropped rather
 * than kept, which is what makes a renamed or retired curve harmless: the ids
 * are a wire format between the legend and the chart, and the empty string —
 * which is what a list with everything shown serialises to — filters down to an
 * empty list on the way back in.
 */
const curvesSetting = createPerViewSetting<readonly TGraphCurve[]>(
  CURVES_KEY,
  NO_CURVES,
  (raw) => raw.split(',').filter(isGraphCurve),
  (curves) => curves.join(','),
);

const curveListeners = new Set<() => void>();

wakeOnViewChange(curveListeners);

/**
 * Declared rather than assigned, so `cycleGraphContents` — which is above it in
 * the file, with the other things Ctrl+W walks — can call it.
 */
function setCurveHidden(curve: TGraphCurve, next: boolean) {
  const hidden = curvesSetting.get();
  if (hidden.includes(curve) === next) {
    return;
  }
  // A fresh list every time, so the setting's identity check always sees a
  // change. That is the same bargain the old assignment made — `useHiddenCurves`
  // hands React an array and compares it by identity — and mutating in place to
  // save an allocation would leave the hook unable to tell that anything moved.
  curvesSetting.set(
    next ? [...hidden, curve] : hidden.filter((id) => id !== curve),
  );
  curveListeners.forEach((listener) => listener());
}

/**
 * The legend chips. Every curve is simply on or off.
 *
 * The EQ option in the View menu uses this same path, so it hides only the
 * cyan EQ line and leaves the other response layers visible for comparison.
 * The multi-line arrangements remain available through the Ctrl+W cycle and
 * `setGraphContents`.
 */
export const toggleGraphCurve = (curve: TGraphCurve) => {
  if (cleanSetting.get()) {
    setGraphContents('everything');
    setCurveHidden(curve, false);
    return;
  }
  const hidden = curvesSetting.get();
  setCurveHidden(curve, !hidden.includes(curve));
};

export const useHiddenCurves = () =>
  useSyncExternalStore(
    (listener: () => void) => {
      curveListeners.add(listener);
      return () => {
        curveListeners.delete(listener);
      };
    },
    curvesSetting.get,
    () => NO_CURVES,
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
 * Moving between the three modes. `TGraphView` and `view` itself are at the top
 * of the file, above the settings that index themselves by them; what is left
 * here is everything that only runs once somebody presses something.
 */
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
  //
  // This reaches the four settings with hand-rolled listener sets as well —
  // solo, the quiet EQ curve, the wave and the hidden curves — because
  // `wakeOnViewChange` puts those sets in here too. They are the ones almost
  // everything watching the plot subscribes to, so leaving them out would have
  // meant a mode change that was correct everywhere except on the graph.
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
/*
 * Hidden in full screen out of the box, drawn everywhere else.
 *
 * The paragraph above already argues that hiding the grid is what somebody does
 * on the way into full screen and undoes on the way out. If that is the move
 * almost everyone makes, making them find the menu to make it is a default
 * chosen the wrong way round — so full screen simply starts without it, and the
 * pane and the expanded card, where the graph is still a measurement, keep
 * every label they can get.
 */
const gridSetting = createPerViewSetting(
  VIEW_KEYS.grid,
  { normal: false, expanded: false, fullscreen: true },
  parseFlag,
  serializeFlag,
);

export const toggleGraphGrid = () => {
  if (cleanSetting.get()) {
    cleanSetting.set(false);
    gridSetting.set(false);
    return;
  }
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
 * Whether the shaded columns behind the Smart EQ regions are drawn.
 *
 * They are the loudest thing on the plot that is not a curve — nine tinted
 * blocks the full height of the drawing, brightening as each range is heard —
 * and while a measurement is running that is exactly what they are for. Over a
 * video, or on a graph somebody is using as a visualiser, they are nine grey
 * rectangles across the picture.
 *
 * This remains independent from the Ctrl+W states. Hiding listening bands is a
 * useful graph arrangement of its own; it must not accidentally become the
 * completely blank Clean mode.
 *
 * The progress bars along the foot are not covered by this. They are two pixels
 * of the plot's height and they are the part that answers "is it still working",
 * so taking the wash away and leaving them is a clearer measurement rather than
 * a hidden one — and somebody who has switched the columns off is usually
 * watching something else and still wants to know when the correction lands.
 *
 * Per view mode, like the grid, and for the same reason: the arrangement wanted
 * over a video is not the arrangement wanted while editing bands.
 */
const coverageSetting = createPerViewSetting(
  VIEW_KEYS.coverage,
  false,
  parseFlag,
  serializeFlag,
);

/**
 * Declared rather than assigned, so `setGraphContents` — which sits up the file
 * with the rest of the cycle — can reach it.
 */
function setCoverageHidden(next: boolean) {
  coverageSetting.set(next);
}

/**
 * The menu switch: the one control that moves a value in the machine without
 * naming a state.
 *
 * Deliberately not routed through `setGraphContents`: coverage is an
 * independent preference and no longer names the Clean state. From Clean, the
 * effective control says "show", so that one press leaves Clean and restores
 * the columns without disturbing the other remembered graph preferences.
 */
export const toggleGraphCoverage = () => {
  if (cleanSetting.get()) {
    cleanSetting.set(false);
    setCoverageHidden(false);
    return;
  }
  setCoverageHidden(!coverageSetting.get());
};

export const getGraphCoverageHidden = () => coverageSetting.get();

export const useGraphCoverageHidden = () =>
  useSyncExternalStore(
    coverageSetting.subscribe,
    coverageSetting.get,
    () => false,
  );

/**
 * Whether the output level meter is drawn at all.
 *
 * It lives in the sidebar rather than on the plot, so hiding it is not a
 * statement about the graph — but the graph's View menu is where every other
 * "show me less" switch already is, and a second menu somewhere else for one
 * more toggle is worse than a slightly broad one here.
 *
 * NOT per view mode, unlike the grid and the coverage wash. Those are about how
 * busy the drawing should be in a given mode, and the answer genuinely differs
 * over a video. The sidebar is the same sidebar in every mode, so a meter that
 * appeared and vanished as the view changed would only ever be surprising.
 */
const meterSetting = createFlagSetting(VIEW_KEYS.meter, false);

export const toggleGraphMeter = () => {
  meterSetting.set(!meterSetting.get());
};

export const getGraphMeterHidden = () => meterSetting.get();

export const useGraphMeterHidden = () =>
  useSyncExternalStore(meterSetting.subscribe, meterSetting.get, () => false);

/**
 * Whether the titlebar keeps its waveform.
 *
 * The strip across the top is the one piece of this app that is decoration
 * before it is instrumentation — it says the audio is alive and little else,
 * and somebody working on a curve for an hour may reasonably want the top of
 * the window to stop moving.
 *
 * Hidden by CSS rather than by unmounting, which is the same rule the full
 * screen path already follows: tearing the component down takes its analyser
 * hook with it and builds a new one on every toggle, for a component nobody can
 * see. The bar stops being drawn; the capture behind it is untouched.
 */
const titlebarWaveSetting = createFlagSetting(VIEW_KEYS.titlebarWave, false);

export const toggleTitlebarWave = () => {
  titlebarWaveSetting.set(!titlebarWaveSetting.get());
};

export const getTitlebarWaveHidden = () => titlebarWaveSetting.get();

export const useTitlebarWaveHidden = () =>
  useSyncExternalStore(
    titlebarWaveSetting.subscribe,
    titlebarWaveSetting.get,
    () => false,
  );

/** The wave never disappears completely under its own height control. */
export const MIN_GRAPH_WAVE_HEIGHT = 0.05;

const clampWaveHeight = (value: number) =>
  Math.max(MIN_GRAPH_WAVE_HEIGHT, Math.min(1, value));

const clampWavePosition = (value: number) => Math.max(0, Math.min(1, value));

const parseWaveHeight = (raw: string) => {
  const value = Number(raw);
  return Number.isFinite(value) ? clampWaveHeight(value) : 1;
};

const parseWavePosition = (raw: string) => {
  const value = Number(raw);
  return Number.isFinite(value) ? clampWavePosition(value) : 0;
};

const serializeWaveControl = (value: number) =>
  String(Math.round(value * 100) / 100);

/**
 * Carry the only distinct old size forward before removing its three-step
 * state. `compact` was a half-height wave; `normal` and `stretched` differed by
 * the plot's margins rather than by the wave, so both become full height. The
 * plot now decides its margins from whether the measurement grid is present,
 * while these two controls describe only the wave they name.
 */
const migrateLegacyWaveSize = () => {
  const legacyStem = 'fluideq.graphStretched';
  const flat = readStored(legacyStem);
  GRAPH_VIEWS.forEach((mode) => {
    const legacyKey = `${legacyStem}.${mode}`;
    const legacy = flat ?? readStored(legacyKey);
    const heightKey = `${VIEW_KEYS.waveHeight}.${mode}`;
    if (legacy !== null && readStored(heightKey) === null) {
      writeStored(heightKey, legacy === 'compact' ? '0.5' : '1');
    }
    removeStored(legacyKey);
  });
  removeStored(legacyStem);
};

migrateLegacyWaveSize();

/**
 * How tall the live wave is, continuously, from a low ripple to the complete
 * available height. Kept per view because a background wave under the editor
 * and a full-screen visualiser are different arrangements.
 */
const waveHeightSetting = createPerViewSetting(
  VIEW_KEYS.waveHeight,
  1,
  parseWaveHeight,
  serializeWaveControl,
);

export const setGraphWaveHeight = (next: number) => {
  waveHeightSetting.set(clampWaveHeight(next));
};

export const getGraphWaveHeight = () => waveHeightSetting.get();

export const useGraphWaveHeight = () =>
  useSyncExternalStore(
    waveHeightSetting.subscribe,
    waveHeightSetting.get,
    () => 1,
  );

/**
 * Where the wave stands vertically. Zero is its orientation's outer edge and
 * one moves its baseline to the middle. For the ordinary upright wave that is
 * exactly bottom-to-centre; the inverted and mirrored forms make the symmetric
 * move from their own edges.
 */
const wavePositionSetting = createPerViewSetting(
  VIEW_KEYS.wavePosition,
  0,
  parseWavePosition,
  serializeWaveControl,
);

export const setGraphWavePosition = (next: number) => {
  wavePositionSetting.set(clampWavePosition(next));
};

export const getGraphWavePosition = () => wavePositionSetting.get();

export const useGraphWavePosition = () =>
  useSyncExternalStore(
    wavePositionSetting.subscribe,
    wavePositionSetting.get,
    () => 0,
  );
