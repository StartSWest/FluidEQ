import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import {
  MAX_GALLERY_QUERY,
  PLUS_CATEGORIES,
  type IGalleryScene,
  type TGallerySort,
  type TPlusCategory,
} from 'common/plusGallery';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import useGalleryLocalScenes from './useGalleryLocalScenes';
import GalleryCard from './GalleryCard';
import GalleryList from './GalleryList';
import { useGalleryList } from './galleryStore';
import { categoryKey } from './GalleryParts';
import {
  openGalleryPage,
  openPlusPlace,
  setBrowseFilters,
  usePlusNavigation,
  type IBrowseFilters,
} from './plusNavigation';

const SORTS: readonly TGallerySort[] = ['liked', 'week', 'new'];

const SORT_KEYS: Record<TGallerySort, TranslationKey> = {
  liked: 'plus.gallery.sort.liked',
  week: 'plus.gallery.sort.week',
  new: 'plus.gallery.sort.new',
};

interface IGalleryViewProps {
  me: string | undefined;
}

/**
 * The gallery's front page: every scene members published, by category and
 * by how much it is liked, with a search over names and makers.
 *
 * The search asks the server as the member types, but never more than one
 * question at a time: while an answer is on its way the typing piles up, and
 * the moment it lands the latest text is asked. The network sets the pace,
 * not a guess at how fast somebody types.
 */
export default function GalleryView({ me }: IGalleryViewProps) {
  const { t } = useTranslation();
  // Kept with the rest of where the member is, so a scene's page and back
  // finds the gallery sorted and filtered as it was left.
  const { filters } = usePlusNavigation();
  const setFilters = (next: (current: IBrowseFilters) => IBrowseFilters) =>
    setBrowseFilters(next(filters));
  const [asked, setAsked] = useState(filters.text.trim());
  const localById = useGalleryLocalScenes();

  const query = {
    sort: filters.sort,
    ...(filters.category ? { category: filters.category } : {}),
    ...(asked ? { query: asked } : {}),
  };
  const { list, loadMore, reload } = useGalleryList(query);

  const wanted = filters.text.trim();
  useEffect(() => {
    if (!list.loading && wanted !== asked) {
      setAsked(wanted);
    }
  }, [list.loading, wanted, asked]);

  const open = (scene: IGalleryScene) =>
    openGalleryPage({ kind: 'scene', scene, from: query });

  const pickCategory = (category: TPlusCategory | undefined) =>
    setFilters((current) => ({
      sort: current.sort,
      text: current.text,
      ...(category ? { category } : {}),
    }));

  let empty: { title: TranslationKey; body?: TranslationKey } = {
    title: 'plus.gallery.empty.title',
    body: 'plus.gallery.empty.body',
  };
  if (asked) {
    empty = { title: 'plus.gallery.empty.search' };
  } else if (filters.category) {
    empty = { title: 'plus.gallery.empty.category' };
  }

  return (
    <div className="gallery-page gallery-gallery">
      <div className="gallery-toolbar">
        <div className="gallery-search">
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.5" />
            <path d="M10.5 10.5L14 14" />
          </svg>
          <input
            type="search"
            value={filters.text}
            maxLength={MAX_GALLERY_QUERY}
            placeholder={t('plus.gallery.search')}
            aria-label={t('plus.gallery.search')}
            onChange={(event) =>
              setFilters((current) => ({
                ...current,
                text: event.target.value,
              }))
            }
          />
        </div>
        <div
          className="segmented gallery-sorts"
          role="group"
          aria-label={t('plus.gallery.sort')}
        >
          {SORTS.map((sort) => (
            <button
              key={sort}
              type="button"
              className={`segmented__option${filters.sort === sort ? ' is-selected' : ''}`}
              aria-pressed={filters.sort === sort}
              onClick={() => setFilters((current) => ({ ...current, sort }))}
            >
              {t(SORT_KEYS[sort])}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="button small subtle gallery-toolbar__mine"
          onClick={() => openGalleryPage({ kind: 'mine' })}
        >
          <Glyph name="upload" />
          {t('plus.gallery.mine')}
        </button>
      </div>

      <div
        className="gallery-chips"
        role="group"
        aria-label={t('plus.gallery.categories')}
      >
        <button
          type="button"
          className="gallery-chip"
          aria-pressed={!filters.category}
          onClick={() => pickCategory(undefined)}
        >
          {t('plus.gallery.all')}
        </button>
        {PLUS_CATEGORIES.map((category) => (
          <button
            key={category}
            type="button"
            className="gallery-chip"
            aria-pressed={filters.category === category}
            onClick={() =>
              pickCategory(filters.category === category ? undefined : category)
            }
          >
            {t(categoryKey(category))}
          </button>
        ))}
      </div>

      <GalleryList
        list={list}
        onMore={loadMore}
        onRetry={reload}
        empty={
          <>
            <p className="community__empty-title">
              {t(empty.title, { query: asked })}
            </p>
            {empty.body && (
              <>
                <p className="community__empty-hint">{t(empty.body)}</p>
                <button
                  type="button"
                  className="button small"
                  onClick={() => openPlusPlace('studio')}
                >
                  {t('plus.gallery.empty.openStudio')}
                </button>
              </>
            )}
          </>
        }
      >
        {list.scenes.map((scene) => (
          <GalleryCard
            key={scene.lookId}
            scene={scene}
            me={me}
            local={localById.get(scene.lookId)}
            onOpen={open}
            onMaker={(maker) => openGalleryPage({ kind: 'maker', maker })}
          />
        ))}
      </GalleryList>
    </div>
  );
}
