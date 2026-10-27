import type { TranslationKey } from 'common/i18n';
import {
  MAX_GALLERY_QUERY,
  PLUS_CATEGORIES,
  type TGallerySort,
  type TPlusCategory,
} from 'common/plusGallery';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { categoryKey } from './GalleryParts';
import type { IBrowseFilters } from './plusNavigation';

const SORTS: readonly TGallerySort[] = ['liked', 'week', 'new'];

const SORT_KEYS: Record<TGallerySort, TranslationKey> = {
  liked: 'plus.gallery.sort.liked',
  week: 'plus.gallery.sort.week',
  new: 'plus.gallery.sort.new',
};

interface IGalleryToolbarProps {
  filters: IBrowseFilters;
  onFilters: (filters: IBrowseFilters) => void;
  /** Opens the member's own scenes. */
  onMine: () => void;
}

/**
 * The gallery's search, its sort, the way to the member's own scenes, and a
 * chip per category over the cards (`GalleryView`).
 *
 * Its own component, handed the filters rather than reading them, because
 * Help draws it too, over made-up scenes (`help/live/plusFigures`).
 */
export default function GalleryToolbar({
  filters,
  onFilters,
  onMine,
}: IGalleryToolbarProps) {
  const { t } = useTranslation();

  const pickCategory = (category: TPlusCategory | undefined) =>
    onFilters({
      sort: filters.sort,
      text: filters.text,
      ...(category ? { category } : {}),
    });

  return (
    <>
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
              onFilters({ ...filters, text: event.target.value })
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
              onClick={() => onFilters({ ...filters, sort })}
            >
              {t(SORT_KEYS[sort])}
            </button>
          ))}
        </div>
        <span className="gallery-toolbar__own">
          <button
            type="button"
            className="button small subtle"
            onClick={onMine}
          >
            <Glyph name="upload" />
            {t('plus.gallery.mine')}
          </button>
        </span>
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
    </>
  );
}
