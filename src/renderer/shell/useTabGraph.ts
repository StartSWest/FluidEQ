/*
<AQUA: System-wide parametric audio equalizer interface>
Copyright (C) <2023>  <AQUA Dev Team>
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

import { useCallback, useEffect, useState } from 'react';
import { exitGraphFullScreen, getGraphView } from '../utils/graphStyle';
import type { TWorkspaceTab } from '../workspaceTabs';
import {
  GRAPH_VISIBILITY_BY_TAB_KEY,
  isFullscreenMediaTab,
  readWorkspaceGraphVisibility,
  type TWorkspaceGraphVisibility,
} from './workspaceGroups';

/**
 * Whether the open tab draws its response graph: each tab's own switch,
 * remembered, and what hiding the graph does to the mode it was drawn in.
 */
const useTabGraph = ({
  activeWorkspaceTab,
  graphView,
  isGraphViewOn,
}: {
  activeWorkspaceTab: TWorkspaceTab;
  graphView: ReturnType<typeof getGraphView>;
  /** The app-wide preference every tab starts from. */
  isGraphViewOn: boolean;
}) => {
  const [graphVisibilityByTab, setGraphVisibilityByTab] = useState<
    TWorkspaceGraphVisibility | undefined
  >(readWorkspaceGraphVisibility);

  // Each workspace owns this choice. Karaoke starts without the response graph
  // because its stage and pitch lane need the height; Library starts without
  // it because the tab is a surface for looking at album art, not at a
  // spectrum; every other workspace inherits the legacy graph preference until
  // the user chooses differently.
  // Library and Karaoke both start closed and stay togglable. Forcing Library
  // closed outright was tried and taken back out: it did remove the graph's
  // toolbar from a tab that has no use for it by default, but it also removed
  // the choice, and the switch in the sidebar then did nothing on that one tab
  // — a control that visibly does nothing being worse than the row it saved.
  const showsGraph =
    (graphView !== 'normal' && isFullscreenMediaTab(activeWorkspaceTab)) ||
    (graphVisibilityByTab?.[activeWorkspaceTab] ??
      (activeWorkspaceTab === 'karaoke' ||
      activeWorkspaceTab === 'library' ||
      activeWorkspaceTab === 'share' ||
      // A forum is read top to bottom; a spectrum under the thread takes the
      // height the conversation needs. Still one switch away.
      activeWorkspaceTab === 'forum'
        ? false
        : isGraphViewOn));

  const setActiveTabGraphVisibility = useCallback(
    (next: boolean) => {
      setGraphVisibilityByTab((current) => ({
        ...current,
        [activeWorkspaceTab]: next,
      }));
    },
    [activeWorkspaceTab],
  );

  /** The graph switched on for a tab that is not the open one. */
  const showGraphOn = useCallback((tab: TWorkspaceTab) => {
    setGraphVisibilityByTab((current) => ({
      ...current,
      [tab]: true,
    }));
  }, []);

  /**
   * Hiding the graph leaves the mode it was being drawn in.
   *
   * Expanded and full screen are ways of SHOWING the graph, and switching the
   * graph off while in one of them left the mode standing over a page with
   * nothing drawn on it — on Media that is a video with the player's own
   * chrome suppressed for a spectrum that is not there. There is nothing to
   * expand once the graph is off, so the view goes back to standard and the
   * page it was covering is a page again.
   *
   * Every tab, not only the two the graph is drawn THROUGH. It is worst on
   * those — a video with the player's chrome suppressed for a spectrum that
   * is not there — but the rule is the same wherever it happens: no graph, no
   * graph mode.
   *
   * What that costs, written down because it is not obvious from the code:
   * the mode is one global setting rather than one per tab, so arriving on a
   * tab whose graph is closed returns the view to standard too, and going
   * back does not put it on again. The alternative is a mode left standing on
   * a page with nothing drawn on it, which is the bug this replaces.
   */
  useEffect(() => {
    if (!showsGraph && graphView !== 'normal') {
      exitGraphFullScreen();
    }
  }, [graphView, showsGraph]);

  useEffect(() => {
    if (!graphVisibilityByTab) {
      return;
    }
    try {
      window.localStorage.setItem(
        GRAPH_VISIBILITY_BY_TAB_KEY,
        JSON.stringify(graphVisibilityByTab),
      );
    } catch {
      // A private/locked storage area must not break the live layout.
    }
  }, [graphVisibilityByTab]);

  useEffect(() => {
    const root = document.getElementById('root');
    root?.classList.toggle('minimized', !showsGraph);
    return () => root?.classList.remove('minimized');
  }, [showsGraph]);

  return { showsGraph, setActiveTabGraphVisibility, showGraphOn };
};

export default useTabGraph;
