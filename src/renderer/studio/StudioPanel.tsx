import { useEffect, type ReactNode } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import StudioBench from './StudioBench';
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
 * Open to every member, with or without Plus. Without it the Studio keeps
 * one project and everything that would take a scene out of this window is
 * locked (`StudioShipLocked`, `StudioProjects`) — which is a thing to try,
 * not a wall to read. What each member may actually do is the main process's
 * answer, never this page's: it says what is locked, and refuses anyway.
 */
export default function StudioPanel() {
  const { t } = useTranslation();
  const view = useStudio();

  useEffect(() => openStudioSession(), []);

  // A moment, the first time only: the store keeps what it last heard.
  const body: ReactNode = view.loaded ? <StudioBench view={view} /> : null;

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
