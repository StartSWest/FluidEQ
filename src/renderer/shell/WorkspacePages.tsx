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

import { Activity, Suspense, type ReactNode, type SyntheticEvent } from 'react';
import FluidEngineLabel from '../components/FluidEngineLabel';
import ListenedLatency from '../components/ListenedLatency';
import WorkspaceSectionTabs from '../components/WorkspaceSectionTabs';
import MainContent from '../MainContent';
import { useTranslation } from '../utils/I18nContext';
import {
  ConfigPage,
  ConvolutionPage,
  ForumPage,
  GamesPage,
  PlusPage,
  PresetsPage,
  SharePage,
} from '../workspacePages';
import { resolveWorkspaceTab, type TWorkspaceTab } from '../workspaceTabs';
import { DspPage } from './ShellPanes';
import {
  EQ_GROUP_LABEL_KEYS,
  EQ_GROUP_TABS,
  isEqGroupTab,
} from './workspaceGroups';

/**
 * The equaliser's five as pills.
 *
 * Inside the page rather than above it, and pills rather than tabs: the
 * strip is where the app's five places are chosen, and a second row of
 * tab-shaped things under it would read as eight tabs in two rows — which
 * is the arrangement this split exists to undo. Built once by the shell and
 * placed by each panel, because they are five separate pages and a row that
 * is part of the page has to be inside it.
 */
export const EqGroupPills = ({
  activeTab,
  onSelect,
  isEngineOnOutput,
  isPartlyOff,
}: {
  activeTab: TWorkspaceTab;
  onSelect: (tab: TWorkspaceTab) => void;
  isEngineOnOutput: boolean | undefined;
  /** Part of the engine failing on the output being listened to. */
  isPartlyOff: boolean;
}) => {
  const { t } = useTranslation();
  return (
    <WorkspaceSectionTabs
      label={t('tabs.eq')}
      activeId={activeTab}
      tabs={EQ_GROUP_TABS.map((tab) => ({
        id: tab,
        label: t(EQ_GROUP_LABEL_KEYS[tab as keyof typeof EQ_GROUP_LABEL_KEYS]),
      }))}
      onSelect={(id) => {
        const next = resolveWorkspaceTab(id);
        if (next) {
          onSelect(next);
        }
      }}
    >
      <FluidEngineLabel
        isEngineOnOutput={isEngineOnOutput}
        isPartlyOff={isPartlyOff}
      />
      {/* The Bands page's Game mode and the path's delay, next to the
          engine's name they belong to (Ivan, 2026-09-27: "put game engine next
          to fluid engine on the top menu right"), the graph above the bands
          or not. */}
      {activeTab === 'eq' && <ListenedLatency />}
    </WorkspaceSectionTabs>
  );
};

export interface IWorkspacePagesProps {
  activeTab: TWorkspaceTab;
  /** Asleep behind the amp (`behindAmp`). */
  behindAmp: 'hidden' | 'visible';
  /** Whether a band can be heard; the EQ pages dim when it cannot. */
  isEqReachingSound: boolean;
  /** The EQ pages' pills stand above the graph rather than in the page. */
  isGraphFirst: boolean;
  /** The equaliser's section pills, built once by the shell. */
  eqGroupPills: ReactNode;
  onEqPillApproach: (event: SyntheticEvent<HTMLElement>) => void;
  onOpenEngineDialog: () => void;
  /** Plus asks the account panel to open on its first page. */
  onSignIn: () => void;
  /** Plus asks for the graph to be shown with the gallery's scene on it. */
  onShowGalleryGraph: () => void;
}

/**
 * The pages, asleep behind the amp. Each is unmounted by an ordinary tab
 * switch already, so nothing in one has to run while it is not on screen. The
 * players are not in here: they are the sound.
 */
const WorkspacePages = ({
  activeTab,
  behindAmp,
  isEqReachingSound,
  isGraphFirst,
  eqGroupPills,
  onEqPillApproach,
  onOpenEngineDialog,
  onSignIn,
  onShowGalleryGraph,
}: IWorkspacePagesProps) => (
  <Activity mode={behindAmp}>
    {isEqGroupTab(activeTab) && (
      // The shared header must outlive section changes: remounting
      // the engine label briefly hid it while status loaded and
      // restarted its rainbow animation. Only the scroll content is
      // keyed.
      <div
        key="eq-workspace"
        className={`workspace-tab-panel workspace-tab-panel--${activeTab}${!isEqReachingSound ? ' is-engine-disabled' : ''}`}
        aria-disabled={
          activeTab === 'config' || activeTab === 'games'
            ? undefined
            : !isEqReachingSound
        }
        onPointerOver={onEqPillApproach}
        onFocus={onEqPillApproach}
      >
        {!isGraphFirst && eqGroupPills}
        <div key={activeTab} className="workspace-tab-panel__scroll">
          {/* Only met by a page drawn before its code arrived,
            which `selectTopWorkspaceTab` never does: the pills
            stay, and the page follows a moment later. */}
          <Suspense fallback={null}>
            {activeTab === 'eq' && <MainContent />}
            {activeTab === 'presets' && <PresetsPage.Page />}
            {activeTab === 'convolution' && <ConvolutionPage.Page />}
            {activeTab === 'games' && <GamesPage.Page />}
            {activeTab === 'config' && <ConfigPage.Page />}
          </Suspense>
        </div>
      </div>
    )}
    {/* No engine-disabled state, and that is not an oversight. The
      panels above are inert with the equaliser off because they
      only write APO's config. This one is a Web Audio graph on
      FluidEQ's own player — APO is not in its path at all, so it
      works exactly the same either way, and greying it out would
      be a lie. */}
    {activeTab === 'dsp' && (
      <div
        key={activeTab}
        className="workspace-tab-panel workspace-tab-panel--dsp"
      >
        <div className="workspace-tab-panel__scroll">
          <Suspense fallback={null}>
            <DspPage onOpenEngineDialog={onOpenEngineDialog} />
          </Suspense>
        </div>
      </div>
    )}
    {activeTab === 'share' && (
      <div
        key={activeTab}
        className="workspace-tab-panel workspace-tab-panel--share"
      >
        <div className="workspace-tab-panel__scroll">
          <Suspense fallback={null}>
            <SharePage.Page />
          </Suspense>
        </div>
      </div>
    )}
    {activeTab === 'community' && (
      // No `__scroll` wrapper: the gallery, the board and the
      // Studio each scroll inside themselves beside a rail that
      // stays put.
      <div
        key={activeTab}
        className="workspace-tab-panel workspace-tab-panel--community"
      >
        <Suspense fallback={null}>
          <PlusPage.Page onSignIn={onSignIn} onShowGraph={onShowGalleryGraph} />
        </Suspense>
      </div>
    )}
    {activeTab === 'forum' && (
      // Like Plus: the list and the thread scroll inside
      // themselves, so the panel does not.
      <div
        key={activeTab}
        className="workspace-tab-panel workspace-tab-panel--forum"
      >
        <Suspense fallback={null}>
          <ForumPage.Page />
        </Suspense>
      </div>
    )}
  </Activity>
);

export default WorkspacePages;
