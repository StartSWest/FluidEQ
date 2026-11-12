/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import {
  useCallback,
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type ReactNode,
} from 'react';
import OverflowArrow from '../components/OverflowArrow';
import { useOverflowScroll } from '../utils/useOverflowScroll';

/** The width of the row's faded edge (`.studio-work__tabs.has-*`): a tab
 * brought into view stops clear of it, never half-faded. */
const FADE_PX = 28;

export interface IStudioWorkTab<TId extends string> {
  id: TId;
  label: string;
  /** A count beside the name: the pictures a scene asks for, its problems. */
  badge?: number;
  /** The count is something wrong, and is said in the warning colour. */
  isAlert?: boolean;
  /**
   * Never scrolled away: it stands at the row's end, outside the part that
   * scrolls, whatever the width or the language.
   */
  pinned?: boolean;
}

interface IStudioWorkTabsProps<TId extends string> {
  label: string;
  tabs: readonly IStudioWorkTab<TId>[];
  selected: TId;
  onSelect: (id: TId) => void;
  /**
   * At the row's far end, after every tab: the full screen's button that
   * hides the pane (`StudioBench`). Not a tab, so outside the tablist.
   */
  end?: ReactNode;
  /** The selected tab's panel. */
  children: ReactNode;
}

/**
 * The Studio's work, one part at a time under the stage (layout A, Ivan
 * 2026-09-27): making it with an AI, its code, its pictures, tuning it and
 * how it is drawn. The stage stays where it is while these change, which is
 * the point of them: one long page under it took the scene off the screen
 * exactly while it was being made.
 *
 * Tabs as the platform means them: arrows move between them and select, Home
 * and End go to the ends, and only the selected one is in the tab order, so
 * the panel is one Tab press away rather than five.
 *
 * Tabs that do not fit scroll, with a faded edge and the app's round arrows,
 * as the Gaming tab's filters do. The pinned ones never do (Ivan, 2026-11-09:
 * "make sure the pic and amaintor tab always visible"): they stand after the
 * part that scrolls, which gives way around them. One tablist all the same,
 * owning them by `aria-owns`, so the arrows can stand beside the part they
 * scroll without being children of the tablist.
 */
export default function StudioWorkTabs<TId extends string>({
  label,
  tabs,
  selected,
  onSelect,
  end,
  children,
}: IStudioWorkTabsProps<TId>) {
  const id = useId();
  const row = useRef<HTMLDivElement | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const tabId = (tab: TId) => `${id}-tab-${tab}`;
  const panelId = `${id}-panel`;
  // In the order they stand, which is the order the arrow keys walk.
  const scrolling = tabs.filter((tab) => !tab.pinned);
  const pinned = tabs.filter((tab) => tab.pinned);
  const ordered = [...scrolling, ...pinned];
  // Measured again whenever the tabs change: "What it hears now" joins the
  // row only when the bench is too narrow for its column, and a count can
  // widen a tab.
  const tabsKey = ordered
    .map((tab) => `${tab.id}:${tab.label}:${tab.badge ?? ''}`)
    .join('|');
  const overflow = useOverflowScroll(tabsKey);
  const { ref: overflowRef } = overflow;
  const attach = useCallback(
    (element: HTMLDivElement | null) => {
      scroller.current = element;
      overflowRef(element);
    },
    [overflowRef],
  );

  // The selected tab is always one that can be seen: chosen from elsewhere
  // (the scene's chat opening an animation), remembered from the last visit,
  // or reached by the arrow keys, it is scrolled into the row. Only the row
  // moves; `scrollIntoView` would scroll the page under it as well. Keyed on
  // what the tabs say, never on the array: a fresh array every render ran this
  // after each scroll the arrows made, and snapped the row back. A pinned tab
  // is not in the part that scrolls, and is never looked for there.
  useLayoutEffect(() => {
    const box = scroller.current;
    const tab = box?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (!box || !tab) {
      return;
    }
    const boxRect = box.getBoundingClientRect();
    const tabRect = tab.getBoundingClientRect();
    if (tabRect.left < boxRect.left + FADE_PX) {
      box.scrollLeft -= boxRect.left + FADE_PX - tabRect.left;
    } else if (tabRect.right > boxRect.right - FADE_PX) {
      box.scrollLeft += tabRect.right - (boxRect.right - FADE_PX);
    }
  }, [selected, tabsKey]);

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = ordered.findIndex((tab) => tab.id === selected);
    let next = -1;
    if (event.key === 'ArrowRight') {
      next = (at + 1) % ordered.length;
    } else if (event.key === 'ArrowLeft') {
      next = (at - 1 + ordered.length) % ordered.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = ordered.length - 1;
    }
    if (next < 0) {
      return;
    }
    event.preventDefault();
    onSelect(ordered[next].id);
    row.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };

  const renderTab = (tab: IStudioWorkTab<TId>) => {
    const isSelected = tab.id === selected;
    return (
      <button
        key={tab.id}
        id={tabId(tab.id)}
        type="button"
        role="tab"
        className="studio-work__tab"
        aria-selected={isSelected}
        aria-controls={panelId}
        tabIndex={isSelected ? 0 : -1}
        onClick={() => onSelect(tab.id)}
        onKeyDown={onKeyDown}
      >
        {tab.label}
        {tab.badge !== undefined && tab.badge > 0 && (
          <span
            className={`studio-work__badge${tab.isAlert ? ' is-alert' : ''}`}
          >
            {tab.badge}
          </span>
        )}
      </button>
    );
  };

  return (
    <div className="studio-work">
      <div ref={row} className="studio-work__tab-row">
        {overflow.canScrollBack && (
          <OverflowArrow
            direction="back"
            onPress={() => overflow.scrollBy(-1)}
          />
        )}
        <div
          ref={attach}
          onScroll={overflow.onScroll}
          className={`studio-work__tabs${
            overflow.canScrollBack ? ' has-back' : ''
          }${overflow.canScrollForward ? ' has-forward' : ''}`}
          role="tablist"
          aria-label={label}
          aria-owns={
            pinned.length > 0
              ? pinned.map((tab) => tabId(tab.id)).join(' ')
              : undefined
          }
        >
          {scrolling.map(renderTab)}
        </div>
        {overflow.canScrollForward && (
          <OverflowArrow
            direction="forward"
            onPress={() => overflow.scrollBy(1)}
          />
        )}
        {pinned.length > 0 && (
          <div className="studio-work__pinned">{pinned.map(renderTab)}</div>
        )}
        {end !== undefined && <div className="studio-work__end">{end}</div>}
      </div>
      <div
        id={panelId}
        className="studio-work__panel"
        role="tabpanel"
        aria-labelledby={tabId(selected)}
      >
        {children}
      </div>
    </div>
  );
}
