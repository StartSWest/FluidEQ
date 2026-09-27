/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react';

export interface IStudioWorkTab<TId extends string> {
  id: TId;
  label: string;
  /** A count beside the name: the pictures a scene asks for, its problems. */
  badge?: number;
  /** The count is something wrong, and is said in the warning colour. */
  isAlert?: boolean;
}

interface IStudioWorkTabsProps<TId extends string> {
  label: string;
  tabs: readonly IStudioWorkTab<TId>[];
  selected: TId;
  onSelect: (id: TId) => void;
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
 */
export default function StudioWorkTabs<TId extends string>({
  label,
  tabs,
  selected,
  onSelect,
  children,
}: IStudioWorkTabsProps<TId>) {
  const id = useId();
  const list = useRef<HTMLDivElement>(null);
  const tabId = (tab: TId) => `${id}-tab-${tab}`;
  const panelId = `${id}-panel`;

  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    const at = tabs.findIndex((tab) => tab.id === selected);
    let next = -1;
    if (event.key === 'ArrowRight') {
      next = (at + 1) % tabs.length;
    } else if (event.key === 'ArrowLeft') {
      next = (at - 1 + tabs.length) % tabs.length;
    } else if (event.key === 'Home') {
      next = 0;
    } else if (event.key === 'End') {
      next = tabs.length - 1;
    }
    if (next < 0) {
      return;
    }
    event.preventDefault();
    onSelect(tabs[next].id);
    list.current
      ?.querySelectorAll<HTMLButtonElement>('[role="tab"]')
      [next]?.focus();
  };

  return (
    <div className="studio-work">
      <div
        ref={list}
        className="studio-work__tabs"
        role="tablist"
        aria-label={label}
      >
        {tabs.map((tab) => {
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
        })}
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
