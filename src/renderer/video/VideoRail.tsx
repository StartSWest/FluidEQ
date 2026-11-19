/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import type { ReactNode } from 'react';
import { suggestSearches } from 'common/searchHistory';
import { type IVideoSite, VIDEO_SITES } from 'common/videoSites';
import { useTransportIdentitySources } from '../audio/transportSource';
import { useRailWidth } from '../library/LibraryRailSplitter';
import { useTranslation } from '../utils/I18nContext';
import {
  removeSearchFromHistory,
  useSearchHistory,
} from '../utils/videoSearchHistory';
import StudioRail, { useRailPinned } from '../widgets/StudioRail';
import VideoSiteIcon from './VideoSiteIcon';
import '../styles/VideoRail.scss';

/** Where the rail's dragged width is remembered (`useRailWidth`). */
const VIDEO_RAIL_WIDTH_KEY = 'fluideq.video.railWidth';

/** Whether the rail is pinned open or folded to its icons (`useRailPinned`). */
const VIDEO_RAIL_PINNED_KEY = 'fluideq.video.railPinned';

interface IVideoRailSitesProps {
  activeSiteId: string | undefined;
  onSite: (site: IVideoSite) => void;
}

/**
 * The sites, as the Library's shelves: the site's mark and its name, the
 * Library's one mark on the site open, and the live dot on it while it
 * plays. Its own component so the transport's every change re-draws five
 * rows, never the page holding the guest.
 */
const VideoRailSites = ({ activeSiteId, onSite }: IVideoRailSitesProps) => {
  const { t } = useTranslation();
  const isPlaying = useTransportIdentitySources().media?.isPlaying === true;
  return (
    <nav className="video-rail__group" aria-label={t('video.sites')}>
      {VIDEO_SITES.map((site) => {
        const isActive = site.id === activeSiteId;
        return (
          <button
            key={site.id}
            type="button"
            className={`video-rail__item${isActive ? ' is-active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
            // Its name while the rail is folded to the marks.
            title={site.name}
            onClick={() => onSite(site)}
          >
            <VideoSiteIcon siteId={site.id} />
            <span className="video-rail__label studio-rail__word">
              {site.name}
            </span>
            {isActive && isPlaying && (
              <span className="video-rail__live" aria-hidden="true" />
            )}
          </button>
        );
      })}
    </nav>
  );
};

/**
 * What has been searched before, a press from running again on the site
 * that is open, each with its own way to be forgotten. On the surface beside
 * the page rather than only in the field's list, where nobody saw them until
 * the field had the caret. Folded, the rail drops them: six identical clocks
 * name nothing.
 */
const VideoRailRecents = ({
  onRunSearch,
}: {
  onRunSearch: (terms: string) => void;
}) => {
  const { t } = useTranslation();
  const recent = suggestSearches(useSearchHistory(), '');
  return (
    <div className="video-rail__recents">
      <span className="studio-rail__lead" aria-hidden="true">
        {t('video.searchRecent')}
      </span>
      {recent.length === 0 ? (
        <p className="video-rail__note">{t('video.recentEmpty')}</p>
      ) : (
        <ul className="video-rail__group" aria-label={t('video.searchRecent')}>
          {recent.map((term) => (
            <li key={term} className="video-rail__recent">
              <button
                type="button"
                className="video-rail__recent-run"
                title={term}
                onClick={() => onRunSearch(term)}
              >
                <svg viewBox="0 0 16 16" aria-hidden="true">
                  <circle cx="8" cy="8" r="5.6" />
                  <path d="M8 4.8V8l2.4 1.5" />
                </svg>
                <span className="video-rail__label">{term}</span>
              </button>
              <button
                type="button"
                className="video-rail__forget"
                aria-label={t('video.searchForget', { term })}
                title={t('video.searchForget', { term })}
                onClick={() => removeSearchFromHistory(term)}
              >
                <svg viewBox="0 0 12 12" aria-hidden="true">
                  <path d="M3 3l6 6M9 3l-6 6" />
                </svg>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

interface IVideoRailProps extends IVideoRailSitesProps {
  /** Runs a search on the site that is open, and remembers it. */
  onRunSearch: (terms: string) => void;
  /** The rail's foot: the colours, the sign-out and the hidden ad switch. */
  foot: ReactNode;
}

/**
 * ONLINE MEDIA'S RAIL, THE LIBRARY'S (Ivan, 2026-11-19: "fix Online Media
 * to match our new flat style, so it looks like the Library"; direction A of
 * that day's mockups). The page's name beside the pin, the sites as its
 * shelves, the recent searches under them, and the account's two controls
 * in the foot where the Library adds a folder - words, where they were two
 * loose glyphs at the end of a toolbar. Folds to the marks by its pin or on a
 * narrow card, and opens over the page under the pointer (`StudioRail`).
 */
const VideoRail = ({
  activeSiteId,
  onSite,
  onRunSearch,
  foot,
}: IVideoRailProps) => {
  const { t } = useTranslation();
  const rail = useRailWidth(VIDEO_RAIL_WIDTH_KEY);
  const [isPinned, setPinned] = useRailPinned(VIDEO_RAIL_PINNED_KEY);
  return (
    <StudioRail
      rail={rail}
      isPinned={isPinned}
      onPinnedChange={setPinned}
      heading={t('tabs.media')}
    >
      <div className="video-rail">
        <div className="video-rail__scroll">
          <span className="studio-rail__lead" aria-hidden="true">
            {t('video.railSites')}
          </span>
          <VideoRailSites activeSiteId={activeSiteId} onSite={onSite} />
          <VideoRailRecents onRunSearch={onRunSearch} />
        </div>
        <div className="video-rail__foot">{foot}</div>
      </div>
    </StudioRail>
  );
};

export default VideoRail;
