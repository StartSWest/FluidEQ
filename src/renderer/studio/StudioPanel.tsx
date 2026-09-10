import { useEffect } from 'react';
import { requestAccountPanel } from '../account/accountPanel';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import StudioBench from './StudioBench';
import StudioStart from './StudioStart';
import { openStudioSession, useStudio } from './studioStore';
import '../styles/Studio.scss';

/**
 * The Studio, as the main area of the Community tab.
 *
 * Opening it opens the session — which is what starts the main process
 * watching the linked folder — and leaving it closes the session, so a folder
 * is watched only while somebody is looking at what it builds.
 */
export default function StudioPanel() {
  const { t } = useTranslation();
  const view = useStudio();

  useEffect(() => openStudioSession(), []);

  const { state } = view;
  let body = <StudioStart />;
  if (!state.entitled) {
    body = (
      <div className="studio-gate">
        <span className="studio-gate__mark" aria-hidden="true">
          <Glyph name="studio" />
        </span>
        <span className="studio-gate__eyebrow">
          {t('account.plus.eyebrow')}
        </span>
        <h3 className="studio-gate__title">{t('studio.gate.title')}</h3>
        <p className="studio-gate__body">{t('studio.gate.body')}</p>
        <button
          type="button"
          className="button small"
          onClick={() => requestAccountPanel('subscribe')}
        >
          {t('studio.gate.cta')}
        </button>
      </div>
    );
  } else if (state.folder) {
    body = <StudioBench view={view} />;
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
