import { useEffect } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import StudioBench from './StudioBench';
import StudioLocked from './StudioLocked';
import { openStudioSession, useStudio } from './studioStore';
import '../styles/Studio.scss';
import '../styles/StudioStage.scss';
import '../styles/StudioMaker.scss';

/**
 * The Studio, as the main area of the Plus tab.
 *
 * Opening it opens the session — which is what starts the main process
 * watching the open project's folder — and leaving it closes the session, so
 * a folder is watched only while somebody is looking at what it builds, and
 * only the one project on the bench is ever watched or played.
 *
 * The Studio is Plus's, reached first through the free trial. A member with
 * neither Plus nor a scene of their own already approved is met by what it
 * is and how to get in (`StudioLocked`), not by a bench that refuses every
 * press. A maker whose month has run out keeps one project and Publish,
 * which is how they earn the next month, with everything else that would
 * take a scene out of this window locked (`StudioShipMaker`,
 * `StudioProjects`) — a thing to try, not a wall to read. What each member
 * may actually do is the main process's answer, never this page's: it says
 * what is locked, and refuses anyway.
 *
 * The session opens for both, because opening it is how the page learns
 * which of the two this member is; with no project it may use, nothing is
 * watched and nothing plays.
 */
export default function StudioPanel() {
  const { t } = useTranslation();
  const view = useStudio();

  useEffect(() => openStudioSession(), []);

  // A moment, the first time only: the store keeps what it last heard.
  let body = null;
  if (view.loaded) {
    body =
      view.state.entitled || view.state.maker ? (
        <StudioBench view={view} />
      ) : (
        <StudioLocked />
      );
  }

  return (
    <>
      <header className="community__head">
        <span className="community__head-mark" aria-hidden="true">
          <Glyph name="studio" />
        </span>
        <span className="community__head-text">
          <span className="community__head-name">{t('studio.title')}</span>
          <span className="community__head-description">
            {t('studio.description')}
          </span>
        </span>
      </header>
      <div className="studio">{body}</div>
    </>
  );
}
