import { useEffect, useLayoutEffect, useRef } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import { requestAccountPanel } from '../account/accountPanel';
import { useAccount } from '../account/accountStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import {
  setGalleryNotice,
  useGalleryNotice,
  type IGalleryNotice,
} from './galleryActions';
import { usePlusEntitled } from './GalleryParts';
import { markGalleryStale } from './galleryStore';
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
import { refreshModeration } from './moderationStore';
import ReportedScenes from './ReportedScenes';
import ScenePage from './ScenePage';
import YourScenes from './YourScenes';
import '../styles/Gallery.scss';

interface IVisualizersViewProps {
  /** Shows the graph, for "Play on the graph". */
  onShowGraph: () => void;
}

/**
 * What a member without Plus reads over the gallery they are browsing: what
 * Plus would let them do with it, and the way in — one line, not a wall in
 * front of the scenes, because the scenes are the best argument for it.
 */
function PlusBar() {
  const { t } = useTranslation();
  return (
    <div className="gallery-plusbar">
      <span className="gallery-plusbar__mark" aria-hidden="true">
        <Glyph name="plus" />
      </span>
      <span className="gallery-plusbar__text">{t('plus.browse.text')}</span>
      <button
        type="button"
        className="button small"
        onClick={() => requestAccountPanel('subscribe')}
      >
        {t('plus.gate.cta')}
      </button>
    </div>
  );
}

/** A gallery page's own line under the head, with the way back. */
function PageBar({
  page,
}: {
  page: Exclude<TGalleryPage, { kind: 'browse' }>;
}) {
  const { t, locale } = useTranslation();
  let title = t('plus.mine.title');
  if (page.kind === 'reported') {
    title = t('plus.moderation.title');
  } else if (page.kind === 'scene') {
    title = resolveSceneName(page.scene, locale);
  } else if (page.kind === 'maker') {
    title = page.maker.name ?? page.maker.handle ?? t('plus.card.anonymous');
  }
  return (
    <div className="gallery-pagebar">
      <button type="button" className="gallery-back" onClick={goBackInGallery}>
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
 * by maker or by name, added to one's looks, and liked — each like points on
 * the leaderboard for whoever made it.
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
  const entitled = usePlusEntitled();
  const me = account.identity?.id;
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageKey = galleryPageKey(page);

  // Coming here is when the gallery is worth asking again; what was on
  // screen stays there while it does.
  useEffect(() => {
    markGalleryStale();
    return () => setGalleryNotice(undefined);
  }, []);

  // Whether to offer the reported scenes, asked on the same occasion and
  // again whenever a different account signs in.
  useEffect(() => {
    refreshModeration(me).catch(() => undefined);
  }, [me]);

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
        report={page.report}
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
  } else if (page.kind === 'reported') {
    content = <ReportedScenes me={me} />;
  }

  return (
    <>
      <header className="community__head gallery-head">
        <span className="community__head-mark" aria-hidden="true">
          <Glyph name="looks" />
        </span>
        <span className="community__head-text">
          <span className="community__head-name">
            {t('plus.visualizers.title')}
          </span>
          <span className="community__head-description">
            {t('plus.visualizers.description')}
          </span>
        </span>
        {/* Under the head, which stays put: Add and the heart are pressed
            on cards far down the list, where a line at its top is not. */}
        <PlusToastStack<IGalleryNotice>
          sources={{ gallery: notice }}
          text={(entry) => t(entry.key, entry.vars)}
        />
      </header>
      <div
        ref={scrollRef}
        className="gallery-visualizers"
        onScroll={(event) =>
          rememberGalleryScroll(pageKey, event.currentTarget.scrollTop)
        }
      >
        {page.kind !== 'browse' && <PageBar page={page} />}
        {!entitled && page.kind !== 'mine' && page.kind !== 'reported' && (
          <PlusBar />
        )}
        {content}
      </div>
    </>
  );
}
