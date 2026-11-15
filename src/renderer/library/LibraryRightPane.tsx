/*
<FluidEQ: System-wide parametric audio equalizer interface>
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

import { type ReactNode, useEffect, useRef, useState } from 'react';
import MenuIcon, { type MenuIconName } from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';
import { useLibraryPlayerSession } from './player/LibraryPlayerContext';
import LibraryNowPlayingCard from './LibraryNowPlayingCard';
import LibraryUpNext from './LibraryUpNext';
import LibraryTrackDetails from './LibraryTrackDetails';
import LibraryLyricsTab from './LibraryLyricsTab';
import { readPersistedMode, writePersistedMode } from './libraryWorkspacePrefs';
import usePaneTabsFit from './usePaneTabsFit';

const PANE_TABS = ['upNext', 'details', 'lyrics'] as const;

type TPaneTab = (typeof PANE_TABS)[number];

const PANE_TAB_KEY = 'fluideq.library.paneTab';

const TAB_LABEL_KEYS = {
  upNext: 'library.upNext',
  details: 'library.pane.details',
  lyrics: 'library.pane.lyrics',
} as const;

/** Each tab's picture: what the tab holds, and all of the tab once the pane
 * is too narrow for its words (`usePaneTabsFit`). */
const TAB_ICONS: Record<TPaneTab, MenuIconName> = {
  upNext: 'playlist',
  details: 'info',
  lyrics: 'microphone',
};

/**
 * THE LIBRARY'S RIGHT PANE (the "A + C" design, Ivan 2026-11-14): what is
 * playing on top, then three tabs as one segmented control — Up Next, the
 * song's Details, its Lyrics — and the chosen one under them.
 *
 * It replaced the Up Next panel's own chrome and keeps its fold: mounted
 * folded too, so it closes and opens on the Plus rail's motion
 * (`_libraryUpNext.scss`), and inert while folded so nothing in it can be
 * reached. The tab chosen is remembered between sessions.
 *
 * As a drawer (a narrow card) it runs from the card's top over the bar, so
 * the bar's Up next button is under it: `head` is that button drawn again in
 * the drawer's own first row, where the bar's stands, and pressing it puts
 * the drawer away.
 */
const LibraryRightPane = ({
  isCollapsed,
  canSurprise,
  head,
}: {
  isCollapsed: boolean;
  canSurprise: boolean;
  head?: ReactNode;
}) => {
  const { t } = useTranslation();
  const { track } = useLibraryPlayerSession();
  const [tab, setTab] = useState<TPaneTab>(() =>
    readPersistedMode(PANE_TAB_KEY, PANE_TABS, 'upNext'),
  );
  useEffect(() => writePersistedMode(PANE_TAB_KEY, tab), [tab]);
  const tabsRef = useRef<HTMLDivElement>(null);
  const labels = PANE_TABS.map((name) => t(TAB_LABEL_KEYS[name]));
  const isCompact = usePaneTabsFit(tabsRef, labels.join('|'));

  return (
    <aside
      className={`library-up-next${isCollapsed ? ' is-collapsed' : ''}`}
      aria-label={t('library.nowPlaying')}
      inert={isCollapsed}
    >
      {head && <div className="library-pane__drawer-head">{head}</div>}
      <LibraryNowPlayingCard track={track} />
      <div
        ref={tabsRef}
        className={`library-pane__tabs${isCompact ? ' is-compact' : ''}`}
        role="tablist"
        aria-label={t('library.pane.tabs')}
      >
        {PANE_TABS.map((name, at) => (
          <button
            key={name}
            type="button"
            role="tab"
            id={`library-pane-tab-${name}`}
            aria-selected={tab === name}
            aria-controls="library-pane-body"
            className={`library-pane__tab${tab === name ? ' is-active' : ''}`}
            // Named on the button itself, so a folded tab - its words not
            // laid out - is still named to a screen reader and in its tooltip.
            aria-label={labels[at]}
            title={isCompact ? labels[at] : undefined}
            onClick={() => setTab(name)}
          >
            <MenuIcon name={TAB_ICONS[name]} className="library-pane__icon" />
            <span className="library-pane__label">{labels[at]}</span>
          </button>
        ))}
      </div>
      <div
        id="library-pane-body"
        className="library-pane__body"
        role="tabpanel"
        aria-labelledby={`library-pane-tab-${tab}`}
      >
        {tab === 'upNext' && <LibraryUpNext canSurprise={canSurprise} />}
        {tab === 'details' && <LibraryTrackDetails track={track} />}
        {tab === 'lyrics' && <LibraryLyricsTab track={track} />}
      </div>
    </aside>
  );
};

export default LibraryRightPane;
