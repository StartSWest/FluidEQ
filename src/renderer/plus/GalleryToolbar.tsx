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
import GallerySortMenu, { type IGallerySortItem } from './GallerySortMenu';
import { useGalleryServerViews } from './galleryStore';
import type { IBrowseFilters } from './plusNavigation';

/** The orders every server answers, side by side as they always were. */
const BASIC_SORTS = ['liked', 'week', 'new'] as const;

const SORT_KEYS: Record<(typeof BASIC_SORTS)[number], TranslationKey> = {
  liked: 'plus.gallery.sort.liked',
  week: 'plus.gallery.sort.week',
  new: 'plus.gallery.sort.new',
};

interface IGalleryToolbarProps {
  filters: IBrowseFilters;
  onFilters: (filters: IBrowseFilters) => void;
  /** Opens the member's own scenes. */
  onMine: () => void;
  /** "Not mine yet" is offered only to somebody signed in. */
  signedIn?: boolean;
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
  signedIn = false,
}: IGalleryToolbarProps) {
  const { t } = useTranslation();
  // The week's new and updated scenes, Most used and "Not mine yet" are
  // offered only once the server has shown it answers them.
  const views = useGalleryServerViews();
  const pick = (sort: TGallerySort) => onFilters({ ...filters, sort });

  const likedItems: IGallerySortItem[] = [
    {
      sort: 'liked',
      name: t('plus.gallery.sort.liked'),
      chosen: t('plus.gallery.sort.liked'),
    },
    {
      sort: 'added',
      name: t('plus.gallery.sort.added'),
      chosen: t('plus.gallery.sort.added'),
      hint: t('plus.gallery.sort.addedHint'),
    },
  ];
  const weekItems: IGallerySortItem[] = [
    {
      sort: 'week',
      name: t('plus.gallery.sort.weekLiked'),
      chosen: t('plus.gallery.sort.week'),
    },
    {
      sort: 'week-new',
      name: t('plus.gallery.sort.weekNew'),
      chosen: t('plus.gallery.sort.weekNewChosen'),
      hint: t('plus.gallery.sort.weekNewHint'),
    },
    {
      sort: 'week-updated',
      name: t('plus.gallery.sort.weekUpdated'),
      chosen: t('plus.gallery.sort.weekUpdatedChosen'),
      hint: t('plus.gallery.sort.weekUpdatedHint'),
    },
  ];
  const plain = (sort: (typeof BASIC_SORTS)[number]) => (
    <button
      key={sort}
      type="button"
      className={`segmented__option${filters.sort === sort ? ' is-selected' : ''}`}
      aria-pressed={filters.sort === sort}
      onClick={() => pick(sort)}
    >
      {t(SORT_KEYS[sort])}
    </button>
  );

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
          {views ? (
            <>
              <GallerySortMenu
                items={likedItems}
                label={t('plus.gallery.sort.liked')}
                sort={filters.sort}
                onPick={pick}
              />
              <GallerySortMenu
                items={weekItems}
                label={t('plus.gallery.sort.week')}
                sort={filters.sort}
                onPick={pick}
              />
              {plain('new')}
            </>
          ) : (
            BASIC_SORTS.map(plain)
          )}
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
        {/* Beside the categories, not among the orders: it narrows whatever
            order and category are chosen, rather than being one more way to
            order them. Only for somebody signed in: there is nothing of
            theirs to compare with otherwise. */}
        {views && signedIn && (
          <button
            type="button"
            className="gallery-chip gallery-chip--switch"
            aria-pressed={filters.notMine === true}
            onClick={() => onFilters({ ...filters, notMine: !filters.notMine })}
          >
            {filters.notMine && <Glyph name="check" />}
            {t('plus.gallery.notMine')}
          </button>
        )}
      </div>
    </>
  );
}
