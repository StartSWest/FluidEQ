import { useEffect } from 'react';
import { resolveSceneName } from 'common/scenePacks';
import { requestAccountPanel } from '../account/accountPanel';
import { useAccount } from '../account/accountStore';
import { useEntitlement } from '../account/entitlementStore';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { setGalleryNotice, useGalleryNotice } from './galleryActions';
import { markGalleryStale } from './galleryStore';
import GalleryView from './GalleryView';
import MakerPage from './MakerPage';
import {
  goBackInGallery,
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

/** What members without Plus find here: what it is, and the way in. */
function PlusGate() {
  const { t } = useTranslation();
  return (
    <div className="gallery-gate">
      <span className="gallery-gate__mark" aria-hidden="true">
        <Glyph name="plus" />
      </span>
      <span className="gallery-gate__eyebrow">{t('account.plus.eyebrow')}</span>
      <h3 className="gallery-gate__title">{t('plus.gate.title')}</h3>
      <ul className="gallery-gate__points">
        <li>{t('plus.gate.point1')}</li>
        <li>{t('plus.gate.point2')}</li>
        <li>{t('plus.gate.point3')}</li>
      </ul>
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
  if (page.kind === 'scene') {
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
 * pictures, so browsing costs pictures and nothing else.
 */
export default function VisualizersView({
  onShowGraph,
}: IVisualizersViewProps) {
  const { t } = useTranslation();
  const { page } = usePlusNavigation();
  const entitlement = useEntitlement();
  const account = useAccount();
  const notice = useGalleryNotice();
  const entitled = entitlement.state !== 'none';
  const me = account.identity?.id;

  // Coming here is when the gallery is worth asking again; what was on
  // screen stays there while it does.
  useEffect(() => {
    markGalleryStale();
    return () => setGalleryNotice(undefined);
  }, []);

  let content = <PlusGate />;
  if (entitled) {
    content = <GalleryView me={me} />;
    if (page.kind === 'scene') {
      content = (
        <ScenePage
          key={page.scene.lookId}
          scene={page.scene}
          me={me}
          onShowGraph={onShowGraph}
        />
      );
    } else if (page.kind === 'maker') {
      content = (
        <MakerPage key={page.maker.authorId} maker={page.maker} me={me} />
      );
    }
  }
  // Taking one's own scene down needs no Plus.
  if (page.kind === 'mine') {
    content = <YourScenes me={me} />;
  }

  return (
    <>
      <header className="community__head">
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
      </header>
      <div className="gallery-visualizers">
        {page.kind !== 'browse' && (entitled || page.kind === 'mine') && (
          <PageBar page={page} />
        )}
        {notice && entitled && (
          <p
            className={`studio-notice gallery-notice${notice.ok ? ' studio-notice--ok' : ''}`}
            role="status"
          >
            {t(notice.key, notice.vars)}
          </p>
        )}
        {content}
      </div>
    </>
  );
}
