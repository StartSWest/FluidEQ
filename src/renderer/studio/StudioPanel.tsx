import { useEffect } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { holdDaylightToBrightness } from '../utils/sceneDaylightSetting';
import StudioBench from './StudioBench';
import { openStudioSession, useStudio } from './studioStore';
import '../styles/Studio.scss';
import '../styles/StudioStage.scss';
import '../styles/StudioMaker.scss';
import '../styles/StudioWork.scss';

/**
 * The Studio, as the main area of the Plus tab.
 *
 * Opening it opens the session — which is what starts the main process
 * watching the open project's folder — and leaving it closes the session, so
 * a folder is watched only while somebody is looking at what it builds, and
 * only the one project on the bench is ever watched or played.
 *
 * The Studio is every signed-in member's, with as many projects as they
 * like (Ivan, 2026-10-18): what is sold is a scene, never the right to make
 * one. A scene made here plays outside the Studio once it is published; on
 * the stage until then it wears the draft's mark (`StudioDraftMark`). What
 * each member may do is the main process's answer, never this page's.
 */
export default function StudioPanel() {
  const { t } = useTranslation();
  const view = useStudio();

  useEffect(() => openStudioSession(), []);
  // Its Brightness row tries a scene from night to day, whatever the window's
  // time of day is set to follow (`holdDaylightToBrightness`).
  useEffect(() => holdDaylightToBrightness(), []);

  // A moment, the first time only: the store keeps what it last heard.
  const body = view.loaded ? <StudioBench view={view} /> : null;

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
