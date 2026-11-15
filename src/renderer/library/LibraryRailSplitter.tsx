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
  setWidth: (width: number) => void;
  setIsResizing: (isResizing: boolean) => void;
}

/**
 * The shelf rail's width: dragged at its edge, remembered for the next
 * session, and a flag the card wears while the drag is on so the rail's own
 * width transition stands still under the pointer.
 */
export const useLibraryRailWidth = (): ILibraryRailWidth => {
  const [width, setWidth] = useState(() => {
    const stored = Number(readPersistedText(RAIL_WIDTH_KEY));
    return Number.isFinite(stored) && stored > 0
      ? clampRail(stored)
      : RAIL_DEFAULT_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  return { width, isResizing, setWidth, setIsResizing };
};

interface ILibraryRailSplitterProps {
  rail: ILibraryRailWidth;
}

/**
 * The rail's edge as a splitter (Ivan, 2026-11-15: "we need a resizable
 * splitter here", over a folder tree whose names were cut). The karaoke
 * panes' and the queue's splitter, so the three drag and step alike: a
 * delta from where the drag began, arrows by the keyboard. Dragging right
 * widens the rail, which is anchored left.
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
          writePersistedText(RAIL_WIDTH_KEY, String(draggedToRef.current));
        }}
      />
    </div>
  );
}
