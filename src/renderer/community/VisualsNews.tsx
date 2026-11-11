/*
<FluidEQ: System-wide parametric audio equalizer interface>
Copyright (C) <2026>  <Ivan Carmenates Garcia>

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License version 3 or later.
*/

import { useSyncExternalStore } from 'react';
import { PRODUCT_VERSION } from 'common/branding';
import { featureTourKey, isVisualsNewsUnseen } from 'common/featureTour';
import { requestFeatureTour } from '../components/featureTour/featureTourRequests';
import { featureTourFor, newInPart } from '../components/featureTour/slides';
import MenuIcon from '../icons/MenuIcon';
import { useTranslation } from '../utils/I18nContext';

/** The release whose visualizers' news was opened or put aside, `major.minor`. */
export const VISUALS_NEWS_SEEN_KEY = 'fluideq.visualsNewsSeen';

const NEW_HERE = newInPart(
  featureTourFor(PRODUCT_VERSION),
  'visuals',
  PRODUCT_VERSION,
);

const listeners = new Set<() => void>();

const readSeen = (): string | null => {
  try {
    return localStorage.getItem(VISUALS_NEWS_SEEN_KEY);
  } catch {
    // Storage refused (a locked profile): the news reads as unseen.
    return null;
  }
};

// The rail's mark and the notice read one memory: putting the notice aside
// takes the mark off the rail in the same frame.
const markSeen = () => {
  try {
    localStorage.setItem(
      VISUALS_NEWS_SEEN_KEY,
      featureTourKey(PRODUCT_VERSION),
    );
  } catch {
    // Storage refused: nothing to keep beyond this visit.
  }
  listeners.forEach((listener) => listener());
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

const useUnseen = () =>
  useSyncExternalStore(subscribe, () =>
    isVisualsNewsUnseen(PRODUCT_VERSION, NEW_HERE.length > 0, readSeen()),
  );

const openNews = () => {
  markSeen();
  requestFeatureTour('visuals');
};

/**
 * The Visualizers tab's way into its own What's New, under its places in the
 * rail, marked new until a release's news is opened or put aside. The
 * What's New that opens after an update is the sound's alone; this is the
 * only door to the visualizers', the Studio's and lighting's.
 */
export function VisualsNewsEntry() {
  const { t } = useTranslation();
  const unseen = useUnseen();
  return (
    <button
      type="button"
      className="community__channel visuals-news__entry"
      title={t('visuals.news.open')}
      onClick={openNews}
    >
      <span className="community__channel-mark">
        <MenuIcon name="gift" />
      </span>
      <span className="community__channel-text">
        {/* The mark beside the name, where the line has room: in the
            row's end column it cut the line under it short. */}
        <span className="community__channel-name">
          {t('visuals.news.open')}
          {unseen && (
            <span className="visuals-news__new">{t('tour.newBadge')}</span>
          )}
        </span>
        <span className="community__channel-blurb">
          {t('visuals.news.blurb')}
        </span>
      </span>
    </button>
  );
}

/**
 * The visualizers' news, named at the top of the Visualizers tab the first
 * time it is opened after a release that brought them something.
 */
export default function VisualsNewsNotice() {
  const { t } = useTranslation();
  const unseen = useUnseen();
  if (!unseen) {
    return null;
  }
  return (
    <section className="visuals-news" aria-labelledby="visuals-news-title">
      <span className="visuals-news__mark" aria-hidden="true">
        <MenuIcon name="gift" />
      </span>
      <div className="visuals-news__text">
        <h2 id="visuals-news-title" className="visuals-news__title">
          {t('visuals.news.title', {
            version: featureTourKey(PRODUCT_VERSION),
          })}
        </h2>
        <ul className="visuals-news__list">
          {NEW_HERE.map((slide) => (
            <li key={slide.id}>{t(slide.titleKey)}</li>
          ))}
        </ul>
      </div>
      <div className="visuals-news__actions">
        <button
          type="button"
          className="button small subtle"
          onClick={markSeen}
        >
          {t('visuals.news.later')}
        </button>
        <button type="button" className="button small" onClick={openNews}>
          {t('visuals.news.see')}
        </button>
      </div>
    </section>
  );
}
