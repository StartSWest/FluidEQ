/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>
SPDX-License-Identifier: GPL-3.0-or-later
*/

import { useTranslation } from '../utils/I18nContext';
import VideoSearch from './VideoSearch';

/**
 * Where the page is, as the address bar would say it: the site's own host
 * and the first step of its path ("youtube.com", "watch"). Nothing for an
 * address that is not one, such as the blank page before the first load.
 */
const addressOf = (url: string) => {
  try {
    const { hostname, pathname } = new URL(url);
    if (!hostname) {
      return undefined;
    }
    const [first] = pathname.split('/').filter(Boolean);
    let place: string | undefined;
    try {
      place = first ? decodeURIComponent(first) : undefined;
    } catch {
      // A path that is not valid percent-encoding is shown as it came.
      place = first;
    }
    return { host: hostname.replace(/^www\./, ''), place };
  } catch {
    return undefined;
  }
};

interface IVideoTopBarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  isLoading: boolean;
  onBack: () => void;
  onForward: () => void;
  /** Reload, or stop while a page is loading. */
  onReloadOrStop: () => void;
  currentUrl: string;
  query: string;
  onQueryChange: (query: string) => void;
  onRunSearch: (terms: string) => void;
  /** The site a search runs on, named in the field's placeholder. */
  siteName: string;
}

/**
 * THE PAGE'S BAR, THE LIBRARY'S (`.library-top`): back, forward and reload
 * as the Library's bare squares, the search in its quiet field, and at the
 * far end where the page is. The sites that crowded the bar as a row of
 * pills live in the rail (`VideoRail`).
 */
const VideoTopBar = ({
  canGoBack,
  canGoForward,
  isLoading,
  onBack,
  onForward,
  onReloadOrStop,
  currentUrl,
  query,
  onQueryChange,
  onRunSearch,
  siteName,
}: IVideoTopBarProps) => {
  const { t } = useTranslation();
  const address = addressOf(currentUrl);
  const reloadLabel = isLoading ? t('video.stop') : t('video.reload');
  return (
    <div className="video-browser__bar">
      <div className="video-browser__nav">
        <button
          type="button"
          className="video-browser__nav-button"
          aria-label={t('video.back')}
          title={t('video.back')}
          disabled={!canGoBack}
          onClick={onBack}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M10 3L5 8l5 5" />
          </svg>
        </button>
        <button
          type="button"
          className="video-browser__nav-button"
          aria-label={t('video.forward')}
          title={t('video.forward')}
          disabled={!canGoForward}
          onClick={onForward}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6 3l5 5-5 5" />
          </svg>
        </button>
        <button
          type="button"
          className="video-browser__nav-button"
          aria-label={reloadLabel}
          title={reloadLabel}
          onClick={onReloadOrStop}
        >
          <svg viewBox="0 0 16 16" aria-hidden="true">
            {isLoading ? (
              <path d="M4 4l8 8M12 4l-8 8" />
            ) : (
              <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2v3h-3" />
            )}
          </svg>
        </button>
      </div>
      <div className="video-browser__search">
        <VideoSearch
          query={query}
          onQueryChange={onQueryChange}
          onRun={onRunSearch}
          siteName={siteName}
        />
      </div>
      {address && (
        <span className="video-browser__address" title={currentUrl}>
          <span className="video-browser__host">{address.host}</span>
          {address.place && (
            <span className="video-browser__place">{address.place}</span>
          )}
        </span>
      )}
    </div>
  );
};

export default VideoTopBar;
