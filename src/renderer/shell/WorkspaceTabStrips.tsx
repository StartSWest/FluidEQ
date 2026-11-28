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

import type { ReactNode } from 'react';
import { isAccountConfigured } from 'common/accountConfig';
import WorkspaceTabStrip from '../components/WorkspaceTabStrip';
import { useSoundingGame } from '../games/useGameSound';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import type { TTitlebarPlace } from '../utils/titlebarPlaces';
import useMediaQuery from '../utils/useMediaQuery';
import type { TWorkspaceTab } from '../workspaceTabs';
import { isEqGroupTab, MEDIA_TAB_ONE_WORD_QUERY } from './workspaceGroups';
import { WORKSPACE_PLACES } from './workspacePlaces';

/**
 * The main places, drawn either side of the live output meter.
 *
 * Above the workspace rather than on it. The meter is the one element that
 * makes this window look like itself and it already floats across the top;
 * putting the places in the same wrapper means the app's navigation lives
 * in its signature element and the workspace below gets its row back.
 *
 * Split, because all six on one end left the spectrum sitting a couple of
 * hundred pixels left of the window's middle while the wrapper around it was
 * perfectly centred — the one drawing in this app that is meant to look
 * centred was the one thing that was not. Visualizers opens the left strip;
 * Online Media closes the right, as Ivan asked on 2026-11-05.
 */
export interface IWorkspaceTabsProps {
  activeTab: TWorkspaceTab;
  /** Which of the equaliser's five the EQ tab opens onto. */
  lastEqTab: TWorkspaceTab;
  onSelect: (tab: TWorkspaceTab) => void;
  /** A hover or a focus on a tab, which is when its page is fetched. */
  onApproach: (tab: TWorkspaceTab) => void;
}

/** What every place's tab needs from the strip: where the window is. */
type TPlaceNav = Omit<IWorkspaceTabsProps, 'lastEqTab'>;

interface IPlaceTabProps {
  place: TTitlebarPlace;
  nav: TPlaceNav;
  /** The word drawn, where it is shorter than the place's full name. */
  shown?: string;
  children?: ReactNode;
}

/**
 * One place's tab. It carries its place as `data-place`, which is how the bar
 * takes it out while there is no room for it (`titlebarPlaces.ts`).
 */
const PlaceTab = ({ place, nav, shown, children }: IPlaceTabProps) => {
  const { t } = useTranslation();
  const { activeTab, onSelect, onApproach } = nav;
  const { icon, label } = WORKSPACE_PLACES[place];
  const active = activeTab === place;
  return (
    <button
      type="button"
      role="tab"
      data-place={place}
      aria-selected={active}
      aria-label={t(label)}
      className={`workspace-tab${active ? ' is-active' : ''}`}
      onClick={() => onSelect(place)}
      onPointerEnter={() => onApproach(place)}
      onFocus={() => onApproach(place)}
    >
      <MenuIcon name={icon} />
      <span className="workspace-tab__label">{shown ?? t(label)}</span>
      {children}
    </button>
  );
};

const VisualizersTab = ({ nav }: { nav: TPlaceNav }) =>
  isAccountConfigured() ? <PlaceTab place="community" nav={nav} /> : null;

const OnlineMediaTab = ({ nav }: { nav: TPlaceNav }) => {
  const { t } = useTranslation();
  const short = useMediaQuery(MEDIA_TAB_ONE_WORD_QUERY);
  return (
    <PlaceTab
      place="video"
      nav={nav}
      shown={short ? t('tabs.mediaShort') : undefined}
    />
  );
};

/** Visualizers, Share Audio, Gaming Lab and the equaliser: left of the meter. */
export const WorkspaceTabsLeft = ({
  activeTab,
  lastEqTab,
  onSelect,
  onApproach,
}: IWorkspaceTabsProps) => {
  const { t } = useTranslation();
  const sounding = useSoundingGame();
  const nav = { activeTab, onSelect, onApproach };
  return (
    <WorkspaceTabStrip label={t('tabs.aria')}>
      <VisualizersTab nav={nav} />
      <PlaceTab place="share" nav={nav} />
      {/* Beside Share Audio, the other place about what others hear of
          you. */}
      <PlaceTab place="mic" nav={nav} />
      {/* Beside the equaliser, which it stands in for while a game plays:
          a game's whole sound is tuned here (Ivan, 2026-11-02: "put it to the
          left of EQ"). The dot says a game's own sound is the one on, from
          any page, without a banner over anybody's graph. */}
      <PlaceTab place="games" nav={nav}>
        {sounding && (
          <span
            className="workspace-tab__live"
            title={sounding.name}
            aria-hidden="true"
          />
        )}
      </PlaceTab>
      {/* Six places, not ten. The equaliser and everything that sets it
          are one tab with a row of pills inside — see EQ_GROUP_TABS.

          Last on this side, so it is the name against the meter's left edge
          and the rack is the name against its right: the two halves of one
          signal chain still touch, with the spectrum they are shaping between
          them. */}
      <button
        type="button"
        role="tab"
        aria-selected={isEqGroupTab(activeTab)}
        aria-label={t('tabs.eq')}
        className={`workspace-tab${
          isEqGroupTab(activeTab) ? ' is-active' : ''
        }`}
        onClick={() => onSelect(lastEqTab)}
        onPointerEnter={() => onApproach(lastEqTab)}
        onFocus={() => onApproach(lastEqTab)}
      >
        <MenuIcon name="layout" />
        <span className="workspace-tab__label">{t('tabs.eq')}</span>
      </button>
    </WorkspaceTabStrip>
  );
};

/** The rack, Library, Karaoke and Online Media: right of the meter. */
export const WorkspaceTabsRight = ({
  activeTab,
  onSelect,
  onApproach,
}: Omit<IWorkspaceTabsProps, 'lastEqTab'>) => {
  const { t } = useTranslation();
  const nav = { activeTab, onSelect, onApproach };
  return (
    <WorkspaceTabStrip label={t('tabs.aria')}>
      {/* First on this side, which keeps it next to the equaliser across the
          meter: the rack is the rest of the signal chain the EQ tab starts,
          and a user who has just set a curve looks for the compressor next —
          not past Library and Karaoke to the far end of the strip. */}
      <PlaceTab place="dsp" nav={nav} />
      <PlaceTab place="library" nav={nav} />
      <PlaceTab place="karaoke" nav={nav} />
      <OnlineMediaTab nav={nav} />
      {/* No Forum tab: the forum opens from the Help menu, beside the other
          ways to get help, and still fills the workspace like a tab. */}
    </WorkspaceTabStrip>
  );
};
