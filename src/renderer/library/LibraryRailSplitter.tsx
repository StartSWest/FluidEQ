/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useRef, useState } from 'react';
import KaraokePaneSplitter from '../karaoke/KaraokePaneSplitter';
import { useTranslation } from '../utils/I18nContext';
import {
  RAIL_DEFAULT_WIDTH,
  RAIL_MAX,
  RAIL_MIN,
  RAIL_WIDTH_KEY,
  readPersistedText,
  writePersistedText,
} from './libraryWorkspacePrefs';

const clampRail = (width: number) =>
  Math.min(RAIL_MAX, Math.max(RAIL_MIN, width));

export interface ILibraryRailWidth {
  width: number;
  isResizing: boolean;
  /** Where the width is remembered: each page's rail keeps its own. */
  storageKey: string;
  setWidth: (width: number) => void;
  setIsResizing: (isResizing: boolean) => void;
}

/**
 * A studio rail's width: dragged at its edge, remembered for the next
 * session under `storageKey`, and a flag the page wears while the drag is on
 * so the rail's own width transition stands still under the pointer. The
 * Library's shelves and the Scenes tab's places are one rail design, so one
 * width rule; each remembers its own.
 */
export const useRailWidth = (storageKey: string): ILibraryRailWidth => {
  const [width, setWidth] = useState(() => {
    const stored = Number(readPersistedText(storageKey));
    return Number.isFinite(stored) && stored > 0
      ? clampRail(stored)
      : RAIL_DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  return { width, isResizing, storageKey, setWidth, setIsResizing };
};

/** The shelf rail's width (`useRailWidth`), kept as the Library's. */
export const useLibraryRailWidth = (): ILibraryRailWidth =>
  useRailWidth(RAIL_WIDTH_KEY);

interface ILibraryRailSplitterProps {
  rail: ILibraryRailWidth;
}

/**
 * The rail's edge as a splitter (Ivan, 2026-11-15: "we need a resizable
 * splitter here", over a folder tree whose names were cut). The karaoke
 * panes' and the queue's splitter, so the three drag and step alike: a
 * delta from where the drag began, arrows by the keyboard. Dragging right
 * widens the rail, which is anchored left. The Scenes tab's rail wears it
 * too, placed by its own page's stylesheet (`PlusRail.scss`).
 */
export default function LibraryRailSplitter({
  rail,
}: ILibraryRailSplitterProps) {
  const { t } = useTranslation();
  /** The width the drag started from: the splitter reports a delta. */
  const startRef = useRef(rail.width);
  /**
   * The width the last step asked for, written once the drag ends - never
   * on every move, which would write localStorage synchronously on the
   * thread drawing the drag. A ref, because a keyboard step is start, drag
   * and end in one handler, where the end still sees the old state.
   */
  const draggedToRef = useRef(rail.width);
  return (
    <div className="library-rail__splitter">
      <KaraokePaneSplitter
        orientation="vertical"
        ariaLabel={t('library.rail.resize')}
        valuePercent={((rail.width - RAIL_MIN) / (RAIL_MAX - RAIL_MIN)) * 100}
        onStart={() => {
          startRef.current = rail.width;
          rail.setIsResizing(true);
        }}
        onDrag={(delta) => {
          const next = clampRail(startRef.current + delta);
          draggedToRef.current = next;
          rail.setWidth(next);
        }}
        onEnd={() => {
          rail.setIsResizing(false);
          writePersistedText(rail.storageKey, String(draggedToRef.current));
        }}
      />
    </div>
  );
}
