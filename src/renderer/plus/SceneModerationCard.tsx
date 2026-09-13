import { useId, useState } from 'react';
import type { IReportedScene, TModerationAction } from 'common/plusModeration';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { moderateReportedScene } from './moderationStore';
import { openGalleryPage } from './plusNavigation';
import { REASON_LABELS, reportedReasons } from './ReportedSceneRow';
import '../styles/GalleryModeration.scss';

interface ISceneModerationCardProps {
  entry: IReportedScene;
  name: string;
}

/**
 * The queue's answers on the scene's own page, for the admin who opened it
 * from the queue to watch it play: what it was reported for, and dismiss or
 * take down without walking back to the list first. Either answer returns to
 * the queue, where the next one waits.
 */
export default function SceneModerationCard({
  entry,
  name,
}: ISceneModerationCardProps) {
  const { t, locale } = useTranslation();
  const [confirming, setConfirming] = useState(false);
  const [working, setWorking] = useState<TModerationAction>();
  const numbers = new Intl.NumberFormat(locale);
  const dates = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const busy = working !== undefined;
  const titleId = useId();

  const act = (action: TModerationAction) => {
    setWorking(action);
    moderateReportedScene(entry, action, name)
      .then((done) => {
        setWorking(undefined);
        if (done) {
          openGalleryPage({ kind: 'reported' });
        }
        return undefined;
      })
      .catch(() => setWorking(undefined));
  };

  return (
    <section className="gallery-scene-moderation" aria-labelledby={titleId}>
      <header className="gallery-scene-moderation__head">
        <span className="gallery-moderation__mark" aria-hidden="true">
          <Glyph name="report" />
        </span>
        <span className="gallery-scene-moderation__title" id={titleId}>
          {t('plus.moderation.cardTitle')}
        </span>
        <span className="gallery-scene-moderation__total">
          {numbers.format(entry.reports)}
        </span>
      </header>
      <span className="gallery-report__reasons">
        {reportedReasons(entry).map((reason) => (
          <span
            key={reason}
            className={`gallery-report__reason gallery-report__reason--${reason}`}
          >
            {t(REASON_LABELS[reason])}
            <span className="gallery-report__times">
              {numbers.format(entry.reasons[reason])}
            </span>
          </span>
        ))}
      </span>
      {entry.lastReportedAt && (
        <span className="gallery-report__when">
          {t('plus.moderation.lastReport', {
            date: dates.format(new Date(entry.lastReportedAt)),
          })}
        </span>
      )}
      {confirming ? (
        <div className="gallery-scene-moderation__confirm">
          <p className="gallery-fine">{t('plus.moderation.confirm')}</p>
          <div className="gallery-scene-moderation__actions">
            <button
              type="button"
              className="button small subtle"
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              {t('plus.moderation.confirmNo')}
            </button>
            <button
              type="button"
              className={`button small gallery-danger${working === 'take-down' ? ' is-running' : ''}`}
              aria-busy={working === 'take-down'}
              onClick={() => {
                if (!busy) {
                  act('take-down');
                }
              }}
            >
              {t('plus.moderation.takeDown')}
            </button>
          </div>
        </div>
      ) : (
        <div className="gallery-scene-moderation__actions">
          <button
            type="button"
            className={`button small subtle${working === 'dismiss' ? ' is-running' : ''}`}
            aria-busy={working === 'dismiss'}
            disabled={busy}
            onClick={() => act('dismiss')}
          >
            {t('plus.moderation.dismiss')}
          </button>
          <button
            type="button"
            className="button small subtle gallery-report__take-down"
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            {t('plus.moderation.takeDown')}
          </button>
        </div>
      )}
    </section>
  );
}
