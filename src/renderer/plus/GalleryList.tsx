import type { ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import GalleryListNotice from './GalleryListNotice';
import type { IGalleryList, TGalleryListFailure } from './galleryStore';

const ERROR_KEYS: Record<TGalleryListFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
  'not-entitled': 'plus.gallery.error.server',
};

/** Placeholder cards while the first answer is on its way. */
const SKELETON_CARDS = 6;

interface IGalleryListProps {
  list: IGalleryList;
  onMore: () => void;
  onRetry: () => void;
  /** What an answered, empty list says. */
  empty: ReactNode;
  children: ReactNode;
}

/**
 * The grid every gallery page shares, with everything a list can be besides
 * full: loading for the first time, failed, answered with nothing, or longer
 * than one page.
 */
export default function GalleryList({
  list,
  onMore,
  onRetry,
  empty,
  children,
}: IGalleryListProps) {
  const { t } = useTranslation();
  const firstLoad = list.loading && list.scenes.length === 0;

  return (
    <>
      {list.error && (
        <GalleryListNotice text={t(ERROR_KEYS[list.error])} onRetry={onRetry} />
      )}

      {firstLoad && (
        <div
          className="gallery-grid"
          role="status"
          aria-label={t('plus.gallery.loading')}
        >
          {Array.from({ length: SKELETON_CARDS }, (_, index) => (
            <span
              key={index}
              className="gallery-card gallery-card--skeleton"
              aria-hidden="true"
            >
              <span className="gallery-card__ghost-picture" />
              <span className="gallery-card__ghost-line" />
              <span className="gallery-card__ghost-line gallery-card__ghost-line--short" />
            </span>
          ))}
        </div>
      )}

      {list.scenes.length > 0 && (
        <div className={`gallery-grid${list.loading ? ' is-refreshing' : ''}`}>
          {children}
        </div>
      )}

      {list.loaded &&
        !list.loading &&
        !list.error &&
        list.scenes.length === 0 && (
          <div className="community__empty gallery-empty">
            <span className="community__empty-mark" aria-hidden="true">
              <Glyph name="plus" />
            </span>
            {empty}
          </div>
        )}

      {list.more && list.scenes.length > 0 && (
        <div className="gallery-more">
          <button
            type="button"
            className={`button small subtle${list.loading ? ' is-running' : ''}`}
            aria-busy={list.loading}
            onClick={onMore}
          >
            {t('plus.gallery.more')}
          </button>
        </div>
      )}
    </>
  );
}
