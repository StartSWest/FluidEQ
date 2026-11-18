import { useEffect, useLayoutEffect, useRef } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import { useAccount } from '../account/accountStore';
import { useTranslation } from '../utils/I18nContext';
import { WallpaperStatus } from '../wallpaper/WallpaperControls';
import { useGalleryNotice, type IGalleryNotice } from './galleryActions';
import { refreshGalleryOnShow } from './galleryStore';
import GalleryView from './GalleryView';
import MakerPage from './MakerPage';
import PlusToastStack from './PlusToastStack';
import {
  galleryPageKey,
  galleryScrollOf,
  goBackInGallery,
  rememberGalleryScroll,
  usePlusNavigation,
  type TGalleryPage,
} from './plusNavigation';
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
  const { page } = usePlusNavigation();
  const account = useAccount();
  const notice = useGalleryNotice();
  const me = account.identity?.id;
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

  // What the gallery says back, under the bar that stays on top: the search
  // on the front page, the way back on the others.
  const notices = (
    <>
      <WallpaperStatus />
      {/* Hung from the pinned bar, which stays put: Add and the heart are
          pressed on cards far down the list, where a line at its top is
          not. */}
      <PlusToastStack<IGalleryNotice>
        sources={{ gallery: notice }}
        text={(entry) => t(entry.key, entry.vars)}
      />
    </>
  );

  let content = <GalleryView me={me} notices={notices} />;
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
    // No big "Gallery" title over the page (Ivan, 2026-11-17: "not even sure
    // we need the Gallery title there like that"): the rail beside it names
    // the place, and the head pushed the search and the scenes down. The
    // name stays for screen readers.
    <div
      ref={scrollRef}
      className="gallery-visualizers"
      onScroll={(event) =>
        rememberGalleryScroll(pageKey, event.currentTarget.scrollTop)
      }
    >
      <h2 className="gallery-place-name">{t('plus.visualizers.title')}</h2>
      {page.kind !== 'browse' && (
        <div className="gallery-pinned">
          <PageBar page={page} />
          {notices}
        </div>
      )}
      {content}
    </div>
  );
}
