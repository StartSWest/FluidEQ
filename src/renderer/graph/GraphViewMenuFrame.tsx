/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { ReactNode, RefObject, useLayoutEffect, useState } from 'react';

/**
 * Where the list goes, decided against the window rather than assumed.
 *
 * The graph sits at the bottom of the workspace as often as not, and this menu
 * hangs off the top-right of it — so "below and right-aligned" is right about
 * half the time and off the edge of the screen the rest of it.
 */
export interface IPlacement {
  isAbove: boolean;
  isLeftAligned: boolean;
  /** How tall it may be here, or none if it fits without a cap. */
  maxHeight?: number;
}

/**
 * How close to an edge the list may come before it stops growing — the
 * window's chrome, and whatever it is standing in. The app's own gutter, so a
 * menu that has grown as tall as it can sits off the edge by the same breath
 * as everything else rather than appearing to touch it.
 *
 * There used to be an ESTIMATED height beside it — 260 pixels, guessed once
 * and never revisited — and the menu outgrew it. A guess that is too small
 * means the list believes it fits below when it does not, so it never flips
 * and the last rows are simply cut off. It measures itself now, so nothing has
 * to be kept in step with how many rows the menu has; this is only the margin
 * left around it.
 */
const MENU_EDGE_GAP = 16;
const MENU_ESTIMATED_WIDTH = 210;

/**
 * Where whatever the menu is inside would cut it off.
 *
 * The workspace column is `overflow: hidden` — it has to be, the cards in it
 * are rounded and its panes scroll — and it starts below the titlebar, so a
 * menu that measured itself against the window alone fitted the window and had
 * its first rows eaten by the column (Ivan, 2026-09-23). Every ancestor that
 * clips is asked, rather than one named class: the same menu opens from the
 * graph in a pane, over the workspace, in full screen and in the Studio, and a
 * rule that names the pane's wrapper would be right in one of them.
 *
 * `overflow` on either axis counts. A box that clips horizontally and not
 * vertically is still a scroll container, and the browser clips it both ways.
 */
const clipBounds = (from: Element) => {
  let top = 0;
  let bottom = window.innerHeight;
  let element = from.parentElement;
  while (element) {
    const style = getComputedStyle(element);
    if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
      const box = element.getBoundingClientRect();
      // A box with no size clips nothing that can be seen anyway, and taking
      // it as an edge would leave the menu with no room at all.
      if (box.height > 0 && box.width > 0) {
        top = Math.max(top, box.top);
        bottom = Math.min(bottom, box.bottom);
      }
    }
    element = element.parentElement;
  }
  return { top, bottom };
};

/**
 * The room either side of the menu’s button, and the button itself.
 */
const roomAround = (root: HTMLElement) => {
  const trigger = root.getBoundingClientRect();
  // The room is the window minus the chrome pinned over it. The titlebar
  // and the transport bar are both fixed and both paint above this list,
  // so a menu measured against the bare window edge opened up under the
  // titlebar and lost its first rows behind it. Measured from the DOM
  // rather than from a constant, so a hidden bar counts as no bar.
  const chromeTop =
    document.querySelector('.window-titlebar')?.getBoundingClientRect()
      .bottom ?? 0;
  const transport = document
    .querySelector('.now-playing-bar')
    ?.getBoundingClientRect();
  const chromeBottom = transport ? window.innerHeight - transport.top : 0;
  // And the room is no bigger than what the menu is standing in. The list
  // fitted the window and was still cut across the top, because the
  // workspace column it lives in is `overflow: hidden` and ends well below
  // the titlebar (Ivan: "the top part is getting eat by the wrapper").
  const clip = clipBounds(root);
  const ceiling = Math.max(chromeTop, clip.top);
  const floor = Math.min(window.innerHeight - chromeBottom, clip.bottom);
  return {
    trigger,
    below: floor - trigger.bottom - MENU_EDGE_GAP,
    above: trigger.top - ceiling - MENU_EDGE_GAP,
  };
};

/** The cap for a list that wants `wanted` pixels where there are `room`. */
const capFor = (wanted: number, room: number) =>
  wanted > room ? Math.max(120, room) : undefined;

/**
 * Where the list opens and how tall it may be, measured before the browser
 * paints, so the list never appears in the wrong place and jumps.
 * `useLayoutEffect` is the difference between choosing a side and being seen
 * to change your mind about it.
 */
export const useViewMenuPlacement = (
  rootRef: RefObject<HTMLElement | null>,
  menuRef: RefObject<HTMLElement | null>,
  isOpen: boolean,
  folded: readonly string[],
): IPlacement => {
  const [placement, setPlacement] = useState<IPlacement>({
    isAbove: false,
    isLeftAligned: false,
  });

  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!isOpen || !root) {
      return;
    }
    /*
     * MEASURED, THEN PLACED, THEN CAPPED.
     *
     * The list is already in the document by the time this runs — it is
     * rendered when `isOpen` turns true and this is a layout effect — so its
     * natural height can simply be asked for rather than predicted. `scrollHeight`
     * rather than `offsetHeight`, because a previous opening may have left a cap
     * on it and the question is how tall it WANTS to be.
     *
     * Then the side with more room wins, and the cap is that room. Both, rather
     * than either: flipping alone still fails on a short window where neither
     * side fits, and scrolling alone would leave it opening downward into three
     * visible rows when there was a full menu's worth of space above.
     */
    const wanted = menuRef.current?.scrollHeight ?? 0;
    const { trigger, above, below } = roomAround(root);
    const isAbove = wanted > below && above > below;
    setPlacement({
      isAbove,
      isLeftAligned: trigger.right < MENU_ESTIMATED_WIDTH,
      maxHeight: capFor(wanted, isAbove ? above : below),
    });
  }, [isOpen, rootRef, menuRef]);

  // A group folded open or shut changes how tall the list wants to be, and
  // the cap was measured only at opening: a group unfolded in a list that had
  // fitted ran its last rows off the bottom of the window. Capped again on the
  // side it opened on — a list that jumped to the other side of its button,
  // under the pointer that had just unfolded it, would be worse.
  useLayoutEffect(() => {
    const root = rootRef.current;
    if (!isOpen || !root) {
      return;
    }
    const wanted = menuRef.current?.scrollHeight ?? 0;
    const { above, below } = roomAround(root);
    setPlacement((current) => {
      const maxHeight = capFor(wanted, current.isAbove ? above : below);
      return maxHeight === current.maxHeight
        ? current
        : { ...current, maxHeight };
    });
  }, [folded, isOpen, rootRef, menuRef]);

  return placement;
};

export const Icon = ({ children }: { children: ReactNode }) => (
  <svg className="graph-view-menu__icon" viewBox="0 0 16 16" aria-hidden>
    {children}
  </svg>
);

/**
 * Which groups of the menu are folded away, kept for next time.
 *
 * Per group and in `localStorage`, because folding one is a statement about
 * what you never touch rather than about this opening of the menu — and the
 * menu is opened dozens of times a session. Storage that refuses leaves
 * every group open, which is the behaviour before folding existed.
 */
const FOLD_KEY = 'fluideq.graphMenuFold';

const isString = (value: unknown): value is string => typeof value === 'string';

const readFolded = (): readonly string[] => {
  try {
    const raw = window.localStorage.getItem(FOLD_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isString) : [];
  } catch {
    return [];
  }
};

const writeFolded = (folded: readonly string[]): void => {
  try {
    window.localStorage.setItem(FOLD_KEY, JSON.stringify(folded));
  } catch {
    // The fold still holds for as long as the window lives.
  }
};

/**
 * Which groups are folded away, and what each group’s heading takes to
 * say so and to change it.
 */
export const useFoldedGroups = () => {
  const [folded, setFolded] = useState<readonly string[]>(readFolded);
  const toggleGroup = (group: string) =>
    setFolded((current) => {
      const next = current.includes(group)
        ? current.filter((entry) => entry !== group)
        : [...current, group];
      writeFolded(next);
      return next;
    });
  const groupProps = (group: string, isFirst?: boolean) => ({
    isOpen: !folded.includes(group),
    isFirst,
    onToggle: () => toggleGroup(group),
  });
  return { folded, groupProps };
};

/**
 * A group of the menu: its name, and the rows under it when it is open.
 *
 * The menu had dividers and no names at all, so which rows belonged together
 * was left for the reader to infer, and the Studio grouped the same settings
 * differently under headings of its own. Ivan, reading the menu: "this is a
 * mess". The names are the same four the Studio uses, in the same order
 * (`common/settingsGroups.ts`).
 *
 * They fold because the menu is long — nine sliders, six choices and a dozen
 * switches — and most of it is set once. A group folded away is one someone
 * has said they are done with; the heading stays, so nothing becomes
 * unreachable, and its arrow says which way it goes.
 */
export const Group = ({
  title,
  isOpen,
  isFirst,
  onToggle,
  children,
}: {
  title: string;
  isOpen: boolean;
  /** The first group needs no line above it: the menu's edge is the line. */
  isFirst?: boolean;
  onToggle: () => void;
  children: ReactNode;
}) => (
  <>
    {!isFirst && <div className="graph-view-menu__divider" />}
    <button
      type="button"
      className="graph-view-menu__group"
      aria-expanded={isOpen}
      onClick={onToggle}
    >
      <span>{title}</span>
      <svg
        className="graph-view-menu__group-arrow"
        viewBox="0 0 16 16"
        aria-hidden
      >
        <path d="M4.5 6.5L8 10l3.5-3.5" />
      </svg>
    </button>
    {isOpen && children}
  </>
);
