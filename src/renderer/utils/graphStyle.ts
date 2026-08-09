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
  quietEq: 'fluideq.graphQuietEq',
  solo: 'fluideq.graphSolo',
  // Two of these are not keys any more but *stems*. The grid and the stretch
  // are kept once per view mode, under `<stem>.normal`, `<stem>.expanded` and
  // `<stem>.fullscreen` — see `createPerViewSetting` at the foot of this file,
  // which is also the only thing that still reads the bare stem, once, to move
  // an older install's value across.
  grid: 'fluideq.graphGridHidden',
  coverage: 'fluideq.graphCoverageHidden',
  meter: 'fluideq.graphMeterHidden',
  titlebarWave: 'fluideq.titlebarWaveHidden',
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

/**
 * A plain remembered on/off, for the switches that are the same in every view.
 *
 * The per-view machinery below exists for settings whose right answer genuinely
 * differs between editing bands and watching a video — the grid, the coverage
 * wash. A switch that means the same thing in all three modes wants none of
 * that, and building it out of `createPerViewSetting` would store three copies
 * of one answer and let them drift.
 */
const createFlagSetting = (key: string, fallback: boolean) => {
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
  // Belt and braces now rather than the rule itself. `setGraphContents` is the
  // only caller and it sets the wave a line later anyway, so this can no longer
  // be the thing that saves the plot — what saves it is that "solo" and "wave
  // hidden" are two *states* rather than two switches, and there is no state in
  // which both are true. Kept because the invariant is worth stating where the
  // flag lives, and because it costs one comparison.
  if (next && isWaveHidden) {
    setWaveHidden(false);
  }
  isSolo = next;
  writeStored(VIEW_KEYS.solo, String(isSolo));
  soloListeners.forEach((listener) => listener());
};

/**
 * Through the state machine, not straight at the flag.
 *
 * This used to call `setLiveOutputSolo` directly, which made it a second writer
 * of the three flags and let them drift out of step with `hiddenCurves`: coming
 * out of solo left the EQ curve in the hidden list, so the plot claimed to be
 * showing everything while the bands' own line was still gone. Naming the state
 * instead of poking one switch is what keeps that impossible.
 */
export const toggleLiveOutputSolo = () =>
  setGraphContents(isSolo ? 'everything' : 'wave');

/**
 * The four things the plot can show, in one gesture.
 *
 * Solo and hide-the-wave are two switches making four combinations, one of
 * which is an empty grid — which is why each already turns the other off
 * rather than allow it. Two settings that will not let each other be true are
 * really one choice, and walking it with a single key says so far better than
 * two keys that quietly undo one another.
 *
 * Everything, then the wave alone, then the curves alone, then everything again
 * without the cyan EQ curve.
 *
 * That last one is the reading state. The bands' own line is the loudest thing
 * on the plot — full weight, a glow, a spectrum gradient and two dozen handles
 * sitting on it — and it is the one curve whose shape is already legible from
 * the sliders underneath. What is not legible anywhere else is what the other
 * layers are doing to it, and they are exactly what it covers. Its handles go
 * with it, since the chart ties them to the curve they draw.
 *
 * The fourth state used to be the curves with only the handles taken off, which
 * left the same bright line over the top of everything and so answered a
 * question nobody was asking.
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
 * them individually. Nothing sets them except `setGraphContents`, so they cannot
 * drift apart.
 *
 * ONLY THE KEY REACHES TWO OF THEM. `layers` and `layersAlone` quiet the EQ
 * curve, and nothing in the app has a switch for that — the wave toggle, the EQ
 * toggle and the legend chip between them can build the other three and no more.
 * So the View menu's cycle row is the whole mouse-driven route to those two, and
 * it names the state it is in for that reason rather than for tidiness.
 */
export type TGraphContents =
  'everything' | 'wave' | 'curves' | 'layers' | 'layersAlone';

const CONTENTS_ORDER: TGraphContents[] = [
  'everything',
  'wave',
  'curves',
  'layers',
  'layersAlone',
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
  wave: 'Wave only',
  curves: 'Curves only',
  // Renamed, because it was not true. This state quiets the EQ curve and leaves
  // the wave running underneath, which is a useful thing to look at and is not
  // what 'Layers only' describes. The name now belongs to the state that earns
  // it.
  layers: 'Layers over wave',
  layersAlone: 'Layers only',
};

export const getGraphContents = (): TGraphContents => {
  if (isSolo) {
    return 'wave';
  }
  if (isWaveHidden) {
    return isEqQuiet ? 'layersAlone' : 'curves';
  }
  return isEqQuiet ? 'layers' : 'everything';
};

/**
 * Move the plot to a state. THE ONLY WRITER OF THE FOUR VALUES BELOW IT.
 *
 * The EQ curve's own hidden flag is set from here as well, because the two
 * questions turned out to be one: "show me no curves" and "hide the EQ curve"
 * are the same request arriving from two controls. Somebody who takes the bands'
 * line away is not asking to read five layer curves against nothing — that line
 * is what the others are read against — so hiding it takes the plot to the wave,
 * and showing it again brings everything back.
 *
 * A `function` rather than a `const`, so it hoists. Everything that changes what
 * the plot shows now comes through here, and two of those — the wave toggle and
 * the solo toggle — sit above it in the file with the flags they used to write
 * directly.
 */
export function setGraphContents(next: TGraphContents) {
  setLiveOutputSolo(next === 'wave');
  setWaveHidden(next === 'curves' || next === 'layersAlone');
  setEqQuiet(next === 'layers' || next === 'layersAlone');
  setCurveHidden('eq', next === 'wave');
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
 * Put the bands' own line back, whatever the plot was doing. Ctrl+Q.
 *
 * Unconditional rather than a toggle, which is the whole point: the one thing
 * the key promises is that the EQ curve is on the plot afterwards, so leaning on
 * it can never be what took the curve away. A second press does nothing.
 *
 * Only `wave` is rescued, and the two states it leaves alone are deliberate
 * rather than an oversight.
 *
 * `curves` already draws the line at full weight with its handles — the wave is
 * what is missing there, and somebody who asked for the EQ curve did not ask for
 * the visualiser back. Turning it on would be answering a question that was not
 * put.
 *
 * `layers` draws the line too, thinly. That state exists so the curves
 * underneath can be read *against* it, so the line being quiet is the deliberate
 * arrangement rather than a curve gone missing, and a key that yanked somebody
 * out of the reading state would be undoing a choice instead of repairing one.
 * Ctrl+W is one press away for anybody who does want out.
 *
 * Which leaves `wave`, the single state where the EQ curve is genuinely not
 * drawn — and `everything` is where it goes, because the wave is already up in
 * that state and taking it away to add the curves would be trading one drawing
 * for another.
 */
export const showEqCurve = () => {
  if (getGraphContents() === 'wave') {
    setGraphContents('everything');
  }
};

/**
 * Which of the four the plot is in, for anything that draws a control for it.
 *
 * One subscription across the three flags rather than three hooks and a
 * derivation at each call site. The View menu needs the answer three times over
 * — the wave row, the EQ row and the cycle row are all views onto this — and a
 * menu that worked each of them out from a different flag is exactly how it
 * ended up offering to hide a curve that was already gone.
 */
const subscribeContents = (listener: () => void) => {
  soloListeners.add(listener);
  waveListeners.add(listener);
  quietEqListeners.add(listener);
  return () => {
    soloListeners.delete(listener);
    waveListeners.delete(listener);
    quietEqListeners.delete(listener);
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
 * The last stop of the cycle, and it used to take the curve away altogether.
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
 */
let isEqQuiet = readStoredFlag(VIEW_KEYS.quietEq);

const quietEqListeners = new Set<() => void>();

function setEqQuiet(next: boolean) {
  if (next === isEqQuiet) {
    return;
  }
  isEqQuiet = next;
  writeStored(VIEW_KEYS.quietEq, String(isEqQuiet));
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
    () => isEqQuiet,
    () => false,
  );

/**
 * What the plot just became, said once in the middle of it.
 *
 * A shortcut that changes four things at once is fast to use and impossible to
 * learn: the drawing rearranges and nothing says which of the four you are now
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

/**
 * The legend's own caption, and the View menu's row for it.
 *
 * Named states rather than the flag it reads, and that is the fix for a real
 * fault rather than tidying. This used to set `isWaveHidden` itself and clear
 * solo by hand, which made it the second writer of a set of values only
 * `setGraphContents` is allowed to touch — and the drift was visible: hiding the
 * wave while the plot was on `wave` left the EQ curve in `hiddenCurves`, so the
 * plot said "curves only" with the loudest curve missing, and the next Ctrl+W
 * put it back as if the key had done it.
 *
 * The no-blank-graph rule survives without being written twice. `curves` is a
 * state with the wave off and the curves on, so asking for the wave to go can no
 * longer also take the curves with it.
 */
export const toggleGraphWave = () =>
  setGraphContents(isWaveHidden ? 'everything' : 'curves');

/**
 * The same answer outside a render. See `getGraphGridHidden`.
 *
 * For the key handler, which is registered once and would otherwise read a
 * boolean captured when it was.
 */
export const getGraphWaveHidden = () => isWaveHidden;

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
  'smart',
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
 */
const CURVES_KEY = 'fluideq.graphHiddenCurves';

/** A stable empty list, because a server snapshot must not change identity. */
const NO_CURVES: readonly TGraphCurve[] = [];

const isGraphCurve = (id: string): id is TGraphCurve =>
  (GRAPH_CURVES as readonly string[]).includes(id);

let hiddenCurves: readonly TGraphCurve[] = (readStored(CURVES_KEY) || '')
  .split(',')
  .filter(isGraphCurve);

const curveListeners = new Set<() => void>();

/**
 * Declared rather than assigned, so `cycleGraphContents` — which is above it in
 * the file, with the other things Ctrl+W walks — can call it.
 */
function setCurveHidden(curve: TGraphCurve, next: boolean) {
  if (hiddenCurves.includes(curve) === next) {
    return;
  }
  hiddenCurves = next
    ? [...hiddenCurves, curve]
    : hiddenCurves.filter((id) => id !== curve);
  writeStored(CURVES_KEY, hiddenCurves.join(','));
  curveListeners.forEach((listener) => listener());
}

/**
 * The legend chips. Every curve but one is simply on or off.
 *
 * The EQ curve goes through the view instead, because taking the bands' line
 * off the plot is the same request as "no curves" — see `setGraphContents`. Handled
 * here rather than in the chip so both the chip and Ctrl+W get the same answer;
 * a rule about what hiding a curve means belongs with the curves, not with one
 * of the two controls that can ask for it.
 */
export const toggleGraphCurve = (curve: TGraphCurve) => {
  if (curve === 'eq') {
    setGraphContents(hiddenCurves.includes('eq') ? 'everything' : 'wave');
    return;
  }
  setCurveHidden(curve, !hiddenCurves.includes(curve));
};

export const useHiddenCurves = () =>
  useSyncExternalStore(
    (listener: () => void) => {
      curveListeners.add(listener);
      return () => {
        curveListeners.delete(listener);
      };
    },
    () => hiddenCurves,
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
 * Whether the shaded columns behind the Smart EQ regions are drawn.
 *
 * They are the loudest thing on the plot that is not a curve — nine tinted
 * blocks the full height of the drawing, brightening as each range is heard —
 * and while a measurement is running that is exactly what they are for. Over a
 * video, or on a graph somebody is using as a visualiser, they are nine grey
 * rectangles across the picture.
 *
 * A menu switch and NOT part of the Ctrl+W cycle, deliberately. That cycle is
 * four states of what the plot is *about*, walked with one key, and a fifth stop
 * for a background wash would make it longer for everybody to reach the states
 * they actually use. Hidden here means hidden: it does not come back when the
 * cycle moves, which is the whole point of it being a separate switch.
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

export const toggleGraphCoverage = () => {
  coverageSetting.set(!coverageSetting.get());
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
