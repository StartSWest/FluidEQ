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
 * How much room the top pane gets, held outside React.
 *
 * The *top* pane, not the graph. The graph takes whatever is left over, and
 * that asymmetry is the whole design.
 *
 * It is the height outright, on every tab. The EQ tab used to treat it as a
 * ceiling instead — asking for its content height and merely stopping here —
 * which let a folded reference picker pull the divider up by itself. That was
 * one clever behaviour on one of four tabs, and the price was a handle that
 * sometimes stayed where it was put and sometimes drifted, depending on which
 * tab happened to be open. Every panel scrolls when its content does not fit,
 * so none of them needs to be measured.
 *
 * Sizing the graph directly was the obvious way round and it does not work: the
 * graph then has to grow into space the editor did not want, which leaves
 * nothing able to take height back off it, and the divider stops responding to
 * a downward drag. Sizing the pane whose content actually varies keeps the
 * drag meaningful in both directions.
 *
 * **Held as a share of the window, not as a number of pixels.** Pixels are what
 * the divider is dragged in, but they are the wrong thing to remember: a split
 * set on a 4K monitor is most of a laptop screen, and the app is routinely
 * moved between the two — a docked machine, an external display unplugged, a
 * window snapped to half the screen. Storing pixels meant every one of those
 * changed the *proportion* on screen while pretending to preserve the setting,
 * and the clamp that kept the panes on screen then wrote the squashed value
 * back, so the original was gone for good. Dragging the divider once on a small
 * window and then maximising made it lurch somewhere else again. A share
 * survives all of it: the same split, wherever it is shown.
 *
 * A module store rather than a prop for the same reason the graph's look is
 * one: the handle is a sibling of both panes, and threading a layout concern
 * through every component in between buys nothing.
 */

import { useSyncExternalStore } from 'react';
import { getBandsPaneNeed, subscribeBandsPaneNeed } from './bandsPaneNeed';

/**
 * Below this a pane has stopped being a pane.
 *
 * Not a design preference: a graph shorter than this cannot show a curve and a
 * player shorter than it cannot show a video, so dragging past it is a way of
 * losing a panel rather than of resizing one.
 */
export const PANE_MIN_HEIGHT = 150;

/**
 * Room to leave for everything that is not the pane being dragged — the
 * titlebar, the tab strip and the workspace padding. Approximate on purpose:
 * it decides how close to the bottom of the window a pane may reach, and being
 * a little conservative costs nothing while being exact would need a measured
 * layout on every pointer move.
 */
const CHROME_ALLOWANCE = 200;

/** Per-workspace top-pane shares, keyed by stable tab id. */
const EDITOR_SHARES_BY_TAB_KEY = 'fluideq.editorShareByTab';

/** The previous single share, retained as the fallback for untouched tabs. */
const LEGACY_EDITOR_SHARE_KEY = 'fluideq.editorShare';

/**
 * What the old builds wrote: a flat pixel height.
 *
 * Read once and converted, so somebody who has had this app for a while keeps
 * roughly the split they chose instead of being reset to the default. Removed
 * as it is read — leaving it would mean converting it again on the next start
 * and undoing whatever they have done since.
 */
const LEGACY_EDITOR_HEIGHT_KEY = 'fluideq.editorHeight';

/**
 * How the window is divided the very first time it opens: seven parts to the
 * editor above, three to the graph below.
 *
 * Seventy is where the editing goes: bands, voicing, a video. The graph is a
 * reading of what those are doing and thirty per cent of a window is plenty to
 * read it in — and it is the pane with a mouse-friendly divider right above it
 * for anyone who disagrees.
 */
const EDITOR_DEFAULT_SHARE = 0.7;

interface ISplittable {
  /** What the two panes have between them right now. */
  room: number;
  /**
   * What the share is a share of: the room plus the transport's strip, which
   * the graph gives up on its own (`measureTransportStrip`).
   */
  base: number;
}

/**
 * The strip the transport bar reserves at the foot of the window, while it
 * reserves one: `#root`'s padding there, which is exactly what the column
 * lost to it (`App.scss`, `.has-now-playing`).
 *
 * Not the split's to divide. The bar comes and goes with the music — it
 * arrives a moment after launch, once the system's player has been read, and
 * leaves when that player closes — and the editor above is what is being
 * worked on, so the graph gives the strip up and the bands hold still. That
 * was already what happened at launch, by accident of timing: the column was
 * measured before the bar arrived and not again until the window was resized,
 * when the editor suddenly gave up seven tenths of the strip. Which of the two
 * splits a window showed depended on whether it had been resized since
 * launch, and in the harness, which answers at once, on which of the two came
 * first.
 */
const measureTransportStrip = () => {
  const root = document.getElementById('root');
  return root ? parseFloat(getComputedStyle(root).paddingBottom) || 0 : 0;
};

/**
 * The EQ pages' head — their section pills and the Bands title row — standing
 * above the graph when the graph is between it and the page (`App.tsx`,
 * `.center-head`; layout A, 2026-09-25). It is in the column but in neither
 * pane, so it comes off the room the two of them divide, like the seam.
 */
const measureHead = (column: HTMLElement) => {
  const head = column.querySelector(':scope > .center-head');
  return head instanceof HTMLElement ? head.offsetHeight : 0;
};

/**
 * What the divider takes out of the column: itself, the two gaps either side
 * of it, and its own margins (`App.scss`). On the open floor the column has no
 * gap and the divider no margins, so the seam is the divider's own hairline:
 * its 12px grab strip is drawn over the panes and takes no room.
 *
 * The margins were once left out while they were negative, so the seam was
 * counted as 36 when it was 12, and a graph dragged as low as it would go
 * stood at 174, never at `PANE_MIN_HEIGHT`.
 */
const measureSeam = (column: HTMLElement) => {
  const gap = parseFloat(getComputedStyle(column).rowGap) || 0;
  const divider = column.querySelector(':scope > .pane-resizer');
  if (!(divider instanceof HTMLElement)) {
    return gap * 2;
  }
  const { marginTop, marginBottom } = getComputedStyle(divider);
  return (
    gap * 2 +
    divider.offsetHeight +
    (parseFloat(marginTop) || 0) +
    (parseFloat(marginBottom) || 0)
  );
};

/**
 * The height the two panes actually divide between them.
 *
 * Measured off the column that holds them whenever there is one, because
 * guessing it from the window is only right while the column *is* most of the
 * window. Below the two-column breakpoint it is not: the profile panel moves
 * to a row underneath and the side bar to one above, and the centre column
 * keeps about half of what the window has. Measured at 640x1000, the column
 * was 548px tall while the guess said 800 — so the ceiling let the editor be
 * dragged 250px past what the column could hold, and the graph, which cannot
 * shrink under `PANE_MIN_HEIGHT`, was pushed out through the bottom of a box
 * that clips. That is the graph disappearing when the divider is dragged
 * down.
 *
 * The divider's seam is not part of the split either, so it comes off the top,
 * and nor is the EQ pages' head when it stands above the graph.
 */
const measureSplittableHeight = (): ISplittable => {
  if (typeof document !== 'undefined') {
    const column = document.querySelector('.center-workspace');
    if (column instanceof HTMLElement && column.clientHeight > 0) {
      const room = Math.max(
        PANE_MIN_HEIGHT * 2,
        column.clientHeight - measureSeam(column) - measureHead(column),
      );
      return { room, base: room + measureTransportStrip() };
    }
  }
  const viewport = typeof window === 'undefined' ? 0 : window.innerHeight || 0;
  // Nothing laid out to measure — a test environment, or a render before the
  // first layout. The window less an allowance for the chrome around the
  // column is the best guess available. The first subscription refreshes it
  // after the workspace has committed to the DOM.
  const guess = viewport > 0 ? viewport - CHROME_ALLOWANCE : 614;
  return { room: guess, base: guess };
};

/**
 * Layout is measured at store boundaries, never while React reads a snapshot.
 *
 * `useSyncExternalStore` may call its getter several times for one render and
 * again after the commit. Letting those reads reach the DOM made every host
 * telemetry update synchronously lay out the whole workspace. Once the store
 * has seen the mounted column, only the column changing size can change these
 * numbers — the window resized, the transport bar arriving or leaving, the
 * short-window tier putting the shell's chrome away — and divider drags only
 * change the share.
 */
let cachedSplittable = measureSplittableHeight();

/**
 * The tallest a lone pane may be: the space to divide, less what the pane below
 * it needs.
 *
 * Derived rather than declared, so it follows the window instead of a number
 * somebody picked on a different monitor. On a very short window it collapses
 * to the minimum, which is the honest answer — there is no room to give.
 * Measured against the room there is, strip and all: the graph gives the
 * transport its strip only down to its own floor.
 */
const ceilingForSinglePane = () =>
  Math.max(PANE_MIN_HEIGHT, cachedSplittable.room - PANE_MIN_HEIGHT);

/** Floor only. Used where a second pane is absorbing the difference. */
export const clampToMinimum = (value: number) =>
  Math.max(PANE_MIN_HEIGHT, Math.round(value));

/** Floor and the derived ceiling. Used where a pane moves on its own. */
export const clampToWindow = (value: number) =>
  Math.min(ceilingForSinglePane(), clampToMinimum(value));

const clampShare = (share: number) => Math.min(0.95, Math.max(0.05, share));

const readStoredDefaultShare = (): number => {
  try {
    const stored = Number(window.localStorage.getItem(LEGACY_EDITOR_SHARE_KEY));
    if (Number.isFinite(stored) && stored > 0) {
      return clampShare(stored);
    }

    const legacy = Number(
      window.localStorage.getItem(LEGACY_EDITOR_HEIGHT_KEY),
    );
    if (Number.isFinite(legacy) && legacy > 0) {
      window.localStorage.removeItem(LEGACY_EDITOR_HEIGHT_KEY);
      const migrated = clampShare(legacy / cachedSplittable.base);
      window.localStorage.setItem(LEGACY_EDITOR_SHARE_KEY, String(migrated));
      return migrated;
    }
  } catch {
    // Storage can be unavailable; the default is a perfectly good split.
  }
  return EDITOR_DEFAULT_SHARE;
};

const readStoredSharesByTab = (): Record<string, number> => {
  try {
    const source = JSON.parse(
      window.localStorage.getItem(EDITOR_SHARES_BY_TAB_KEY) ?? '{}',
    ) as Record<string, unknown>;
    return Object.entries(source).reduce<Record<string, number>>(
      (shares, [tab, value]) => {
        if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
          shares[tab] = clampShare(value);
        }
        return shares;
      },
      {},
    );
  } catch {
    return {};
  }
};

const defaultEditorShare = readStoredDefaultShare();
let editorSharesByTab = readStoredSharesByTab();

const SHORT_WINDOW_SUFFIX = '@short';

/**
 * A page's split on a short window, remembered apart from its split anywhere
 * else, and starting with the graph as a strip.
 *
 * On a laptop's height (`$bp-laptop-height`) a page that is not the EQ — Online
 * Media, Share Audio, the Library — has its own content to show, and a graph
 * held at the share it was given on a tall monitor took a third of what was
 * left: Share Audio's two role cards were cut in half under a graph of 266px
 * (Ivan's window, 1440x852, 2026-09-23). There the graph starts at its floor,
 * `PANE_MIN_HEIGHT` — its legend and a low curve — and the divider pulls it up
 * as it always does. Wherever it is pulled to is this window's decision, kept
 * under this key, and it leaves the tall window's split alone.
 */
export const shortWindowPaneKey = (tab: string) =>
  `${tab}${SHORT_WINDOW_SUFFIX}`;

/** More than the ceiling allows, so the ceiling is what holds it: the floor. */
const GRAPH_STRIP_SHARE = 1;

const BELOW_GRAPH_SUFFIX = '@below-graph';

/**
 * An EQ page's split while its graph stands above the page rather than under
 * it (layout A, 2026-09-25): the pane the divider sets is then the one BELOW
 * it — the bands and the Tone — and the head with the title row is outside
 * the split altogether. Remembered apart from the old split, which measured a
 * different pane (head, title and bands together, above the graph), so a
 * share chosen for that one does not size this one.
 */
export const belowGraphPaneKey = (tab: string) => `${tab}${BELOW_GRAPH_SUFFIX}`;

/**
 * The bands' height when the graph is above them and nobody has moved the
 * divider: what the band row and the Tone need, and the graph gets the rest
 * (Ivan, 2026-09-25: "a default less height for the eq on the bottom").
 *
 * A height, not a share like every other default here, because this pane's
 * content does not scale with the window: below a floor-length track (72px,
 * `MainContent.scss`) the bands stop giving way and the page scrolls, and
 * above it more pane is only a longer reach. Any one share was too much on a
 * tall window and too little on a short one — measured in the full-app
 * harness, 0.45 left the page scrolling 31px at 1440x852 while 1707x960 had
 * room to spare. 344px is a track of about 96px at every width down to 1100,
 * nothing scrolling; the graph takes whatever the window has beyond it.
 *
 * It is only where the pane opens before the bands have been laid out once:
 * from then on the height is what they measure they need for that track
 * (`bandsPaneNeed.ts`), which on a 2560x1440 window, with the Tone's dials at
 * full size, is 368px — at 344 the tracks stood at their 72px floor.
 */
const BELOW_GRAPH_DEFAULT_HEIGHT = 344;

const editorShareForTab = (tab: string) => {
  const stored = editorSharesByTab[tab];
  if (stored !== undefined) {
    return stored;
  }
  if (tab.endsWith(SHORT_WINDOW_SUFFIX)) {
    return GRAPH_STRIP_SHARE;
  }
  return tab.endsWith(BELOW_GRAPH_SUFFIX)
    ? (getBandsPaneNeed() ?? BELOW_GRAPH_DEFAULT_HEIGHT) /
        Math.max(1, cachedSplittable.base)
    : defaultEditorShare;
};

const editorListeners = new Set<() => void>();
const cachedEditorHeights = new Map<string, number>();

const calculateEditorHeight = (tab: string) =>
  clampToWindow(Math.round(cachedSplittable.base * editorShareForTab(tab)));

const refreshEditorHeightCache = () => {
  const measured = measureSplittableHeight();
  if (
    measured.room === cachedSplittable.room &&
    measured.base === cachedSplittable.base
  ) {
    return false;
  }

  cachedSplittable = measured;
  cachedEditorHeights.forEach((_height, tab) => {
    cachedEditorHeights.set(tab, calculateEditorHeight(tab));
  });
  return true;
};

/**
 * The share as pixels for the window as it is right now.
 *
 * Clamped on the way out, never on the way in. That is the whole of the fix:
 * a window too short to honour the share shows a clamped split for as long as
 * it is that short, and the share itself is untouched — so making the window
 * big again restores exactly what was set rather than whatever the smallest
 * size it ever had happened to allow.
 */
export const getEditorHeight = (tab = 'default') => {
  const cached = cachedEditorHeights.get(tab);
  if (cached !== undefined) {
    return cached;
  }

  const height = calculateEditorHeight(tab);
  cachedEditorHeights.set(tab, height);
  return height;
};

/**
 * Set from a drag, in pixels, converted straight back to a share.
 *
 * Compared as pixels rather than as shares because pixels are what the caller
 * has and what the screen shows; two pointer positions a fraction of a per cent
 * apart are the same divider position and are not worth a re-render.
 */
export const setEditorHeight = (next: number, tab = 'default') => {
  const value = clampToMinimum(next);
  if (value === getEditorHeight(tab)) {
    return;
  }
  editorSharesByTab = {
    ...editorSharesByTab,
    [tab]: clampShare(value / cachedSplittable.base),
  };
  cachedEditorHeights.set(tab, calculateEditorHeight(tab));
  editorListeners.forEach((listener) => listener());
};

/**
 * Remember it, once the drag is over.
 *
 * Written on release rather than on every move: a drag across the window is
 * hundreds of pointer events, and localStorage is synchronous.
 */
export const commitPaneSizes = () => {
  try {
    window.localStorage.setItem(
      EDITOR_SHARES_BY_TAB_KEY,
      JSON.stringify(editorSharesByTab),
    );
  } catch {
    // Not worth failing a drag over.
  }
};

let hasMeasuredMountedWorkspace = false;

/**
 * The column, watched for as long as anything reads the split.
 *
 * A window resize is only one of the ways it changes size, and the only one
 * this store used to hear. The transport bar arriving takes a strip off its
 * foot, and a window crossing the short-window tier gives it the chrome the
 * shell puts away (`App.scss`) — the window's size is the same before and
 * after the first, so the split went on dividing a column that was no longer
 * there. The column's own size is the signal that says so.
 *
 * `ResizeObserver` is absent from the jsdom the tests run under; there the
 * window's resize stays the only boundary, as it always was.
 */
let watchedColumn: Element | undefined;
let columnObserver: ResizeObserver | undefined;
let columnChildren: MutationObserver | undefined;

const onColumnResized = () => {
  if (refreshEditorHeightCache()) {
    editorListeners.forEach((listener) => listener());
  }
};

/**
 * The column's own size, and the EQ pages' head inside it.
 *
 * The head takes its height out of the room the panes divide (`measureHead`),
 * and it changes that room without the column changing size at all: it
 * arrives and leaves with the graph and the EQ pages, and while it is there
 * its title row's tools wrap onto a second line as the window narrows and its
 * applied-layer chips come and go. So the column's children are watched too —
 * a head arriving is observed for its size, which also reports once on
 * `observe`, and a head leaving remeasures there and then. A MutationObserver
 * reports after the DOM has changed, which is what makes that measurement the
 * new room rather than the old one.
 */
const watchColumn = () => {
  if (typeof ResizeObserver === 'undefined') {
    return;
  }
  const column = document.querySelector('.center-workspace');
  if (!column || column === watchedColumn) {
    return;
  }
  columnObserver?.disconnect();
  columnChildren?.disconnect();
  watchedColumn = column;
  columnObserver = new ResizeObserver(onColumnResized);
  columnObserver.observe(column);
  let watchedHead: Element | null = null;
  const observeHead = () => {
    const head = column.querySelector(':scope > .center-head');
    if (head === watchedHead) {
      return;
    }
    if (watchedHead) {
      columnObserver?.unobserve(watchedHead);
    }
    watchedHead = head;
    if (head) {
      columnObserver?.observe(head);
    }
  };
  observeHead();
  columnChildren = new MutationObserver(() => {
    observeHead();
    onColumnResized();
  });
  columnChildren.observe(column, { childList: true });
};

const subscribeEditor = (listener: () => void) => {
  editorListeners.add(listener);
  if (!hasMeasuredMountedWorkspace) {
    hasMeasuredMountedWorkspace = true;
    if (refreshEditorHeightCache()) {
      listener();
    }
  }
  watchColumn();
  return () => {
    editorListeners.delete(listener);
  };
};

export const useEditorHeight = (tab = 'default') =>
  useSyncExternalStore(
    subscribeEditor,
    () => getEditorHeight(tab),
    // Server snapshot for useSyncExternalStore. Never rendered to a user, so it
    // does not need the window it has no access to.
    () => 430,
  );

/**
 * Redraw at the new size when the window changes.
 *
 * Refresh the cached pixels and notify; the share is not touched, so the panes
 * keep their proportion across a resize, a move to another monitor and a
 * maximise. This used to write a clamped pixel height back into the store,
 * which is how a window briefly made small permanently lost the split it had.
 */
if (typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    refreshEditorHeightCache();
    editorListeners.forEach((listener) => listener());
  });
}

// A pane under the graph that nobody has sized follows what the bands say
// they need; one that has been dragged keeps its share, which this leaves
// alone (`editorShareForTab`).
subscribeBandsPaneNeed(() => {
  cachedEditorHeights.forEach((_height, tab) => {
    cachedEditorHeights.set(tab, calculateEditorHeight(tab));
  });
  editorListeners.forEach((listener) => listener());
});
