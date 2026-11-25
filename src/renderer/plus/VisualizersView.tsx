import { useEffect, useLayoutEffect, useRef } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import { useAccount } from '../account/accountStore';
import { useTranslation } from '../utils/I18nContext';
import { WallpaperStatus } from '../wallpaper/WallpaperControls';
import { useGalleryNotice, type IGalleryNotice } from './galleryActions';
import { refreshGalleryOnShow } from './galleryStore';
import GalleryToolbar from './GalleryToolbar';
import GalleryView from './GalleryView';
import MakerPage from './MakerPage';
import { useMyScenesCount } from './myScenesCount';
import PlusToastStack from './PlusToastStack';
import {
  galleryPageKey,
  galleryScrollOf,
  goBackInGallery,
  openGalleryPage,
  rememberGalleryScroll,
  setBrowseFilters,
  usePlusNavigation,
  type TGalleryPage,
} from './plusNavigation';
import { ClipSlotsScope } from './clipSlots';
import ScenePage from './ScenePage';
import YourScenes from './YourScenes';
import '../styles/Gallery.scss';

interface IVisualizersViewProps {
  /** Shows the graph, for "Play on the graph". */
  onShowGraph: () => void;
}

/** A gallery page's own line under the head, with the way back. */
function PageBar({
  page,
}: {
  page: Exclude<TGalleryPage, { kind: 'browse' }>;
}) {
  const { t, locale } = useTranslation();
  let title = t('plus.mine.title');
  if (page.kind === 'scene') {
    title = resolveSceneName(page.scene, locale);
  } else if (page.kind === 'maker') {
    title = page.maker.name ?? page.maker.handle ?? t('plus.card.anonymous');
  }
  return (
    <div className="gallery-pagebar">
      <button
        type="button"
        className="library-hero__button gallery-back"
        onClick={goBackInGallery}
      >
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M10 3.5 5.5 8l4.5 4.5" />
        </svg>
        {t('plus.scene.back')}
      </button>
      <span className="gallery-pagebar__title">{title}</span>
    </div>
  );
}

/**
 * Visualizers: the gallery of scenes Plus members publish, found by category,
 * by maker or by name, added to one's looks, and liked.
 *
 * Only one scene plays here at a time, on its own page; the cards are
 * pictures, so browsing costs pictures and nothing else. Any member can
 * browse; playing, adding and liking are Plus.
 */
export default function VisualizersView({
  onShowGraph,
}: IVisualizersViewProps) {
  const { t } = useTranslation();
  const { page, filters } = usePlusNavigation();
  const account = useAccount();
  const notice = useGalleryNotice();
  const me = account.identity?.id;
  // Asked again each time the front page, where its button is, shows.
  const mineCount = useMyScenesCount(page.kind === 'browse' ? me : undefined);
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageKey = galleryPageKey(page);

  // Coming here is when the gallery is worth asking again, once what it
  // shows is a minute old; what was on screen stays there while it does.
  // What the gallery said back is cleared by the tab, which also knows when
  // a page sent somebody to another place with its answer to show.
  useEffect(() => {
    refreshGalleryOnShow();
  }, []);

  // Each page opens where it was left — the gallery at the card that was
  // opened, a page never seen at its top. Before paint, so it never shows
  // at the wrong place first. The lists are kept, so the height is there.
  useLayoutEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = galleryScrollOf(pageKey);
    }
  }, [pageKey]);

  let content = <GalleryView me={me} />;
  if (page.kind === 'scene') {
    content = (
      <ScenePage
        key={page.scene.lookId}
        scene={page.scene}
        from={page.from}
        context={page.context}
        me={me}
        onShowGraph={onShowGraph}
      />
    );
  } else if (page.kind === 'maker') {
    content = (
      <MakerPage key={page.maker.authorId} maker={page.maker} me={me} />
    );
  } else if (page.kind === 'mine') {
    // Taking one's own scene down needs no Plus.
    content = <YourScenes me={me} />;
  }

  return (
    <>
      {/* The bar over the page, which stays put while the cards scroll: the
          search on the front page, the way back on the others, and what
          the gallery says back hanging from it, so a heart pressed far down
          the list still answers where it is seen. No big "Gallery" title
          over it (Ivan, 2026-11-17: "not even sure we need the Gallery
          title there like that", "move the search to the top"): the rail
          beside it names the place; the name stays for screen readers.
          Above the scroller rather than pinned inside it, with no face of
          its own: a see-through bar laid over the cards made every frame of
          a scroll repaint the cards under it. */}
      <div className="gallery-pinned">
        <h2 className="gallery-place-name">{t('plus.visualizers.title')}</h2>
        {page.kind === 'browse' ? (
          <GalleryToolbar
            filters={filters}
            onFilters={setBrowseFilters}
            onMine={() => openGalleryPage({ kind: 'mine' })}
            mineCount={me === undefined ? undefined : (mineCount ?? null)}
            signedIn={me !== undefined}
          />
        ) : (
          <PageBar page={page} />
        )}
        <WallpaperStatus />
        <PlusToastStack<IGalleryNotice>
          sources={{ gallery: notice }}
          text={(entry) => t(entry.key, entry.vars)}
        />
      </div>
      <div
        ref={scrollRef}
        className="gallery-visualizers"
        onScroll={(event) =>
          rememberGalleryScroll(pageKey, event.currentTarget.scrollTop)
        }
      >
        {/* Every card in this scroller plays its clip while in view, within
            one bound for the page (`clipSlots.tsx`). */}
        <ClipSlotsScope scroller=".gallery-visualizers">
          {content}
        </ClipSlotsScope>
      </div>
    </>
  );
}
