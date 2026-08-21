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
  DEFAULT_GRAPH_LOOK,
  DEFAULT_GRAPH_LOOK_ID,
  GRAPH_FORM_LOOKS,
  GraphPalette,
  getGraphLook,
  graphLookId,
} from 'common/graphStyles';
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

import { STORAGE_KEY } from './graphStorage';

const listeners = new Set<() => void>();

/**
 * What the picker points at.
 *
 * The id rather than the look itself, because a look is no longer always one of
 * a fixed list — a custom one can be edited or deleted while it is selected, and
 * an id survives that where a held object would go stale.
 */
let selectedId = DEFAULT_GRAPH_LOOK_ID;
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
  /**
   * Which palette to show the rows in, defaulted to the live one for the
   * same reason `customLooks` is — the two callers reach it differently.
   *
   * The cycle reads the store as it stands. React has to PASS it, and not
   * merely because of the memo lint: a memo whose body reads module state
   * it never mentions is a stale list waiting to happen, and this one went
   * stale the first time somebody pressed the palette toggle. Taking it as
   * an argument is what makes the dependency real rather than remembered.
   */
  palette: GraphPalette = getGraphPalette(),
): IResolvedLook[] => {
  return [
    // One row per form, shown in whichever palette is currently on. The
    // palette is a toggle rather than three rows each, so the list is
    // forty-seven entries instead of a hundred and forty-one — and the
    // click-on-the-plot cycle walks forms rather than repainting the same
    // form three times before reaching the next one.
    ...GRAPH_FORM_LOOKS.map((form) =>
      resolveBuiltInLook(getGraphLook(graphLookId(form.style, palette))),
    ),
    ...customLooks.map(resolveCustomLook),
  ];
};

/**
 * Which palette is on, read back out of the selection itself.
 *
 * Deliberately not stored separately. The saved id already carries both
 * halves — `bars-rainbow` is the bars form under the rainbow palette — so a
 * second stored value would be a second source of truth for something
 * already written down, with all the drift that invites and a migration to
 * write for nothing.
 *
 * A look the user built keeps whatever palette they gave it in the designer,
 * and the toggle does not reach into one.
 */
export const getGraphPalette = (): GraphPalette => {
  const custom = getCustomLook(selectedId);
  return custom ? custom.palette : getGraphLook(selectedId).palette;
};

/**
 * Repaint the selected form in another palette.
 *
 * Selecting the same form's other id rather than storing a mode, which is
 * what keeps this one line: the palette is part of the look's identity and
 * always was.
 */
export const setGraphPalette = (palette: GraphPalette) => {
  if (getCustomLook(selectedId)) {
    return;
  }
  setGraphLook(graphLookId(getGraphLook(selectedId).style, palette));
};

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
    selectedId = DEFAULT_GRAPH_LOOK_ID;
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

const DEFAULT_RESOLVED = resolveBuiltInLook(DEFAULT_GRAPH_LOOK);

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
    () => DEFAULT_GRAPH_LOOK_ID,
  );

/**
 * Which palette the toggle should show as pressed.
 *
 * A primitive, so `useSyncExternalStore` compares it by value and the
 * toggle does not re-render on every unrelated look change.
 */
export const useGraphPalette = () =>
  useSyncExternalStore(subscribe, getGraphPalette, () => 'signal' as const);

/**
 * Whether the palette toggle applies to what is selected.
 *
 * False for a look the user built, which carries the palette it was designed
 * with. Surfaced so the control can be disabled rather than silently doing
 * nothing when it is pressed.
 */
export const useIsPaletteSelectable = () =>
  useSyncExternalStore(
    subscribe,
    () => !isCustomLookId(selectedId),
    () => true,
  );

// The two layers beneath this one. Re-exported so every caller keeps one
// address for the graph store: the split is how the code is organised, not
// something forty import lines should have to know about.
export * from './graphStorage';
export * from './graphViewSettings';
