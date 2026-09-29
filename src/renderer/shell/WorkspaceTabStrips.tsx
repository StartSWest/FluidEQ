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

import { isAccountConfigured } from 'common/accountConfig';
import WorkspaceTabStrip from '../components/WorkspaceTabStrip';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import useMediaQuery from '../utils/useMediaQuery';
import type { TWorkspaceTab } from '../workspaceTabs';
import { isEqGroupTab, MEDIA_TAB_ONE_WORD_QUERY } from './workspaceGroups';

/**
 * The six places, drawn in the titlebar either side of the live output
 * meter — three on the left, three on the right.
 *
 * Above the workspace rather than on it. The meter is the one element that
 * makes this window look like itself and it already floats across the top;
 * putting the places in the same wrapper means the app's navigation lives
 * in its signature element and the workspace below gets its row back.
 *
 * Split, because all six on one end left the spectrum sitting a couple of
 * hundred pixels left of the window's middle while the wrapper around it was
 * perfectly centred — the one drawing in this app that is meant to look
 * centred was the one thing that was not. Share Audio belongs beside Online
 * Media because both move audio between computers rather than shape it.
 */
export interface IWorkspaceTabsProps {
  activeTab: TWorkspaceTab;
  /** Which of the equaliser's five the EQ tab opens onto. */
  lastEqTab: TWorkspaceTab;
  onSelect: (tab: TWorkspaceTab) => void;
  /** A hover or a focus on a tab, which is when its page is fetched. */
  onApproach: (tab: TWorkspaceTab) => void;
}

/** Media, Share Audio and the equaliser: the left of the meter. */
export const WorkspaceTabsLeft = ({
  activeTab,
  lastEqTab,
  onSelect,
  onApproach,
}: IWorkspaceTabsProps) => {
  const { t } = useTranslation();
  const isMediaTabOneWord = useMediaQuery(MEDIA_TAB_ONE_WORD_QUERY);
  const isVideoTab = activeTab === 'video';
  const isShareTab = activeTab === 'share';
  return (
    <WorkspaceTabStrip label={t('tabs.aria')}>
      {/* The one tab whose name is too long for its own strip. It shortens for
          the eye and not for anything else: the accessible name stays the full
          two words at every width, and the short label is a word out of them,
          so what is read aloud and what is on screen never disagree. */}
      <button
        type="button"
        role="tab"
        aria-selected={isVideoTab}
        aria-label={t('tabs.media')}
        className={`workspace-tab${isVideoTab ? ' is-active' : ''}`}
        onClick={() => onSelect('video')}
        onPointerEnter={() => onApproach('video')}
        onFocus={() => onApproach('video')}
      >
        <MenuIcon name="video" />
        <span className="workspace-tab__label">
          {isMediaTabOneWord ? t('tabs.mediaShort') : t('tabs.media')}
        </span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isShareTab}
        aria-label={t('tabs.share')}
        className={`workspace-tab${isShareTab ? ' is-active' : ''}`}
        onClick={() => onSelect('share')}
        onPointerEnter={() => onApproach('share')}
        onFocus={() => onApproach('share')}
      >
        <MenuIcon name="waveform" />
        <span className="workspace-tab__label">{t('tabs.share')}</span>
      </button>
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

/** The rack, the Library, Karaoke and Plus: the right of the meter. */
export const WorkspaceTabsRight = ({
  activeTab,
  onSelect,
  onApproach,
}: Omit<IWorkspaceTabsProps, 'lastEqTab'>) => {
  const { t } = useTranslation();
  const isDspTab = activeTab === 'dsp';
  const isLibraryTab = activeTab === 'library';
  const isKaraokeTab = activeTab === 'karaoke';
  const isCommunityTab = activeTab === 'community';
  return (
    <WorkspaceTabStrip label={t('tabs.aria')}>
      {/* First on this side, which keeps it next to the equaliser across the
          meter: the rack is the rest of the signal chain the EQ tab starts,
          and a user who has just set a curve looks for the compressor next —
          not past Library and Karaoke to the far end of the strip. */}
      <button
        type="button"
        role="tab"
        aria-selected={isDspTab}
        aria-label={t('tabs.dsp')}
        className={`workspace-tab${isDspTab ? ' is-active' : ''}`}
        onClick={() => onSelect('dsp')}
        onPointerEnter={() => onApproach('dsp')}
        onFocus={() => onApproach('dsp')}
      >
        <MenuIcon name="configure" />
        <span className="workspace-tab__label">{t('tabs.dsp')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isLibraryTab}
        aria-label={t('tabs.library')}
        className={`workspace-tab${isLibraryTab ? ' is-active' : ''}`}
        onClick={() => onSelect('library')}
        onPointerEnter={() => onApproach('library')}
        onFocus={() => onApproach('library')}
      >
        <MenuIcon name="album" />
        <span className="workspace-tab__label">{t('tabs.library')}</span>
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={isKaraokeTab}
        aria-label={t('tabs.karaoke')}
        className={`workspace-tab${isKaraokeTab ? ' is-active' : ''}`}
        onClick={() => onSelect('karaoke')}
        onPointerEnter={() => onApproach('karaoke')}
        onFocus={() => onApproach('karaoke')}
      >
        <MenuIcon name="microphone" />
        <span className="workspace-tab__label">{t('tabs.karaoke')}</span>
      </button>
      {/* Only in a build with a backend — every fork and every checkout
          without a .env has no gallery, board or Studio sharing to show, and
          a tab that opens an empty room is worse than no tab. */}
      {isAccountConfigured() && (
        <button
          type="button"
          role="tab"
          aria-selected={isCommunityTab}
          aria-label={t('tabs.plus')}
          className={`workspace-tab${isCommunityTab ? ' is-active' : ''}`}
          onClick={() => onSelect('community')}
          onPointerEnter={() => onApproach('community')}
          onFocus={() => onApproach('community')}
        >
          <MenuIcon name="plusTab" />
          <span className="workspace-tab__label">{t('tabs.plus')}</span>
        </button>
      )}
      {/* No Forum tab: the forum opens from the Help menu, beside the other
          ways to get help, and still fills the workspace like a tab. */}
    </WorkspaceTabStrip>
  );
};
