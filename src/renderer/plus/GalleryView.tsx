import { useEffect, useState } from 'react';
import type { TranslationKey } from 'common/i18n';
import type { IGalleryScene } from 'common/plusGallery';
import { useTranslation } from '../utils/I18nContext';
import useGalleryLocalScenes from './useGalleryLocalScenes';
import GalleryCard from './GalleryCard';
import GalleryList from './GalleryList';
import GalleryToolbar from './GalleryToolbar';
import { useGalleryList } from './galleryStore';
import {
  openGalleryPage,
  openPlusPlace,
  setBrowseFilters,
  usePlusNavigation,
} from './plusNavigation';

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
      <GalleryToolbar
        filters={filters}
        onFilters={setBrowseFilters}
        onMine={() => openGalleryPage({ kind: 'mine' })}
      />

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
