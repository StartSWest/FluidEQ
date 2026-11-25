/* Copyright (C) 2026 Ivan Carmenates Garcia. SPDX-License-Identifier: GPL-3.0-or-later */

import { useState } from 'react';
import { VIDEO_SITES } from 'common/videoSites';
import { useTranslation } from '../../utils/I18nContext';
import VideoSignOut from '../../video/VideoSignOut';
import VideoSiteIcon from '../../video/VideoSiteIcon';
import VideoTopBar from '../../video/VideoTopBar';
import StudioRail from '../../widgets/StudioRail';
import { HELP_RAIL } from './libraryFigureData';
import playerAurora from '../../../../assets/tour/player-aurora.jpg';

/**
 * The Online Media chapter's page (`helpChapters/listen.ts`): the rail the
 * page shares with the Library, and the Library's bar over the site.
 *
 * The bar is the page's own `VideoTopBar` and the sign-out its own
 * `VideoSignOut`, which only acts on a press; the sites, the recent
 * searches and the colours switch read the player and the reader's history
 * and settings, so they are `VideoRail`'s and `GuestTintToggle`'s markup,
 * class for class, with made-up searches. The site itself is a page Help
 * cannot draw; a still of a film stands where it plays.
 */

const nothing = () => undefined;

/** Searches somebody made on the site before, newest first. */
const RECENT = ['ambient for focus', 'synthwave live set', 'night drive mix'];

const OPEN_SITE = 'youtube';

/** The page on YouTube, a video open and playing. */
const OnlineMediaDrawing = () => {
  const { t } = useTranslation();
  const [isPinned, setPinned] = useState(true);
  const site = VIDEO_SITES.find((entry) => entry.id === OPEN_SITE);
  return (
    <div
      className="video-browser workspace-tab-panel--video"
      style={{ height: 560 }}
    >
      <StudioRail
        rail={HELP_RAIL}
        isPinned={isPinned}
        onPinnedChange={setPinned}
        heading={t('tabs.media')}
      >
        <div className="video-rail">
          <div className="video-rail__scroll">
            <span className="studio-rail__lead" aria-hidden="true">
              {t('video.railSites')}
            </span>
            <nav className="video-rail__group" aria-label={t('video.sites')}>
              {VIDEO_SITES.map((entry) => {
                const isActive = entry.id === OPEN_SITE;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`video-rail__item${isActive ? ' is-active' : ''}`}
                    aria-current={isActive ? 'page' : undefined}
                  >
                    <VideoSiteIcon siteId={entry.id} />
                    <span className="video-rail__label studio-rail__word">
                      {entry.name}
                    </span>
                    {isActive && (
                      <span className="video-rail__live" aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </nav>
            <div className="video-rail__recents">
              <span className="studio-rail__lead" aria-hidden="true">
                {t('video.searchRecent')}
              </span>
              <ul
                className="video-rail__group"
                aria-label={t('video.searchRecent')}
              >
                {RECENT.map((term) => (
                  <li key={term} className="video-rail__recent">
                    <button type="button" className="video-rail__recent-run">
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
                    >
                      <svg viewBox="0 0 12 12" aria-hidden="true">
                        <path d="M3 3l6 6M9 3l-6 6" />
                      </svg>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="video-rail__foot">
            <button
              type="button"
              className="video-rail__item video-rail__match is-on"
              aria-pressed
              aria-label={t('video.matchColours')}
            >
              <svg className="video-rail__icon" viewBox="0 0 16 16" aria-hidden>
                <path d="M8 2.1c-1.9 2.2-4.4 5.2-4.4 7.5a4.4 4.4 0 0 0 8.8 0C12.4 7.3 9.9 4.3 8 2.1z" />
              </svg>
              <span className="video-rail__label studio-rail__word">
                {t('video.matchColours')}
              </span>
              <small
                className="video-rail__state studio-rail__word"
                aria-hidden
              >
                {t('video.matchOn')}
              </small>
            </button>
            <VideoSignOut />
          </div>
        </div>
      </StudioRail>
      <div className="video-browser__main">
        <VideoTopBar
          canGoBack
          canGoForward={false}
          isLoading={false}
          onBack={nothing}
          onForward={nothing}
          onReloadOrStop={nothing}
          currentUrl="https://www.youtube.com/watch"
          query=""
          onQueryChange={nothing}
          onRunSearch={nothing}
          siteName={site?.name ?? ''}
        />
        <div className="video-browser__stage">
          <img
            className="video-browser__view"
            src={playerAurora}
            alt=""
            style={{ objectFit: 'cover' }}
          />
        </div>
      </div>
    </div>
  );
};

export default OnlineMediaDrawing;
