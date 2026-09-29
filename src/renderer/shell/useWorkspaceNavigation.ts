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

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type SyntheticEvent,
} from 'react';
import { exitGraphFullScreen, getGraphView } from '../utils/graphStyle';
import { reportError } from '../utils/logger';
import { isTabReady, preloadTab } from '../workspacePages';
import {
  readWorkspaceTab,
  WORKSPACE_TAB_KEY,
  type TWorkspaceTab,
} from '../workspaceTabs';
import { EQ_GROUP_TABS, isEqGroupTab } from './workspaceGroups';

/**
 * Which page is open, and every route to another one: a tab, a pill, the amp,
 * the tour, a reveal.
 */
const useWorkspaceNavigation = () => {
  const [activeWorkspaceTab, setActiveWorkspaceTab] =
    useState<TWorkspaceTab>(readWorkspaceTab);
  /**
   * Every route to another page: a tab, a pill, the amp, the tour, a reveal.
   *
   * Most pages are fetched on their first opening (`workspacePages.ts`), and a
   * page that has not arrived yet is fetched before anything changes, so the
   * page being left stays on screen until the next one can be drawn whole —
   * never an empty pane between the two. The latest press wins: one made
   * while an earlier page was still arriving is the page that opens.
   *
   * Read through refs at the moment the page is shown, not closed over at the
   * press, because that moment can be a fetch later than the press.
   */
  const activeTabRef = useRef(activeWorkspaceTab);
  activeTabRef.current = activeWorkspaceTab;
  const requestedTabRef = useRef<TWorkspaceTab | undefined>(undefined);
  const selectTopWorkspaceTab = useCallback((next: TWorkspaceTab) => {
    requestedTabRef.current = next;
    const show = () => {
      if (requestedTabRef.current !== next) {
        return;
      }
      if (next !== activeTabRef.current && getGraphView() !== 'normal') {
        exitGraphFullScreen();
      }
      setActiveWorkspaceTab(next);
    };
    if (isTabReady(next)) {
      show();
      return;
    }
    preloadTab(next).then(show, (error: unknown) => {
      // Shown anyway: a press that does nothing reads as a dead button, and
      // drawing the page meets the failure again where it can be reported.
      reportError(`Loading the ${next} page`, error);
      show();
    });
  }, []);
  /** A hover or a focus on a way to a page is when its code is fetched. */
  const preloadTabOnApproach = useCallback((tab: TWorkspaceTab) => {
    preloadTab(tab).catch((error: unknown) => {
      reportError(`Fetching the ${tab} page ahead of its press`, error);
    });
  }, []);
  /**
   * The same for the equaliser's pills, which are drawn by a component that
   * knows them only by their order: they are `EQ_GROUP_TABS`, in that order.
   * One listener on the panel rather than one per pill.
   */
  const preloadEqPillOnApproach = useCallback(
    (event: SyntheticEvent<HTMLElement>) => {
      if (!(event.target instanceof Element)) {
        return;
      }
      const pill = event.target.closest('.workspace-pill');
      const pills = pill?.parentElement?.querySelectorAll('.workspace-pill');
      const index = pill && pills ? Array.from(pills).indexOf(pill) : -1;
      const tab = EQ_GROUP_TABS[index];
      if (tab !== undefined) {
        preloadTabOnApproach(tab);
      }
    },
    [preloadTabOnApproach],
  );
  /**
   * Which of the equaliser's five was last open, for the tab that holds them.
   *
   * Pressing EQ from Media has to land somewhere, and always landing on the
   * bands would mean somebody working in Voicing lost their place every time
   * they looked at something else. Seeded from the stored tab, so it survives
   * a restart the same way the tab itself does.
   */
  const [lastEqTab, setLastEqTab] = useState<TWorkspaceTab>(() => {
    const stored = readWorkspaceTab();
    return isEqGroupTab(stored) ? stored : 'eq';
  });
  useEffect(() => {
    if (isEqGroupTab(activeWorkspaceTab)) {
      setLastEqTab(activeWorkspaceTab);
    }
  }, [activeWorkspaceTab]);

  // Written on every change rather than on the way out, because there is no
  // reliable way out: a development reload, a crash and a quit all end the
  // renderer without warning, and the reload is the one this exists for.
  useEffect(() => {
    try {
      window.localStorage.setItem(WORKSPACE_TAB_KEY, activeWorkspaceTab);
    } catch {
      // Not worth failing a tab change over.
    }
  }, [activeWorkspaceTab]);

  return {
    activeWorkspaceTab,
    selectTopWorkspaceTab,
    preloadTabOnApproach,
    preloadEqPillOnApproach,
    lastEqTab,
  };
};

export default useWorkspaceNavigation;
