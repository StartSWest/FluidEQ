import { useRef, type ReactNode } from 'react';
import type { TranslationKey } from 'common/i18n';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useExitAnimation from '../utils/useExitAnimation';
import GalleryListNotice from './GalleryListNotice';
import GallerySkeleton from './GallerySkeleton';
import type { IGalleryList, TGalleryListFailure } from './galleryStore';

const ERROR_KEYS: Record<TGalleryListFailure, TranslationKey> = {
  offline: 'plus.gallery.error.offline',
  'signed-out': 'plus.gallery.error.signedOut',
  server: 'plus.gallery.error.server',
};

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
  const skeletonRef = useRef<HTMLDivElement>(null);
  // The placeholders stay while they fade out over the cards that replace
  // them (`GallerySkeleton`).
  const skeleton = useExitAnimation(
    firstLoad,
    'gallery-skeleton-out',
    skeletonRef,
  );

  return (
    <>
      {/* Only over a list with nothing to show. A refresh that failed over
          scenes already on screen leaves them there, as they were a moment
          ago, and is asked again the next time the tab opens; a notice saying
          the gallery could not be loaded, over the gallery, was the wrong
          thing to say. */}
      {list.error && list.scenes.length === 0 && (
        <GalleryListNotice text={t(ERROR_KEYS[list.error])} onRetry={onRetry} />
      )}

      {/* One box for the placeholders and the cards, so the placeholders can
          leave from exactly where they stood, over the cards arriving there,
          instead of holding their row and pushing the cards down under them. */}
      {(skeleton.present || list.scenes.length > 0) && (
        <div className="gallery-list-body">
          {skeleton.present && (
            <GallerySkeleton
              ref={skeletonRef}
              closing={skeleton.closing}
              onAnimationEnd={skeleton.onAnimationEnd}
            />
          )}
          {list.scenes.length > 0 && (
            <div className="gallery-grid">{children}</div>
          )}
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
          {/* Where the next page would have been, and the button beside it
              asks again. */}
          {list.moreError && !list.loading && (
            <p className="gallery-more__error" role="status">
              {list.moreError === 'offline'
                ? t(ERROR_KEYS.offline)
                : t('plus.gallery.moreError')}
            </p>
          )}
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
