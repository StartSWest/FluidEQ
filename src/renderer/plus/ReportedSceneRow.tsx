import type { TranslationKey } from 'common/i18n';
import { REPORT_REASONS, type TReportReason } from 'common/plusGallery';
import type { IReportedScene, TModerationAction } from 'common/plusModeration';
import { resolveSceneName } from 'common/scenePacks';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { categoryKey, ScenePicture } from './GalleryParts';

export const REASON_LABELS: Record<TReportReason, TranslationKey> = {
  rights: 'plus.moderation.reason.rights',
  flashing: 'plus.moderation.reason.flashing',
  offensive: 'plus.moderation.reason.offensive',
  broken: 'plus.moderation.reason.broken',
};

/** The reasons a scene was reported for, the one said most often first. */
export const reportedReasons = (entry: IReportedScene): TReportReason[] =>
  REPORT_REASONS.filter((reason) => entry.reasons[reason] > 0).sort(
    (left, right) => entry.reasons[right] - entry.reasons[left],
  );

interface IReportedSceneRowProps {
  entry: IReportedScene;
  /** Which answer is being sent for this row, if any. */
  working?: TModerationAction;
  confirming: boolean;
  onConfirm: (confirming: boolean) => void;
  onAct: (action: TModerationAction) => void;
  onOpen: () => void;
}

/**
 * One reported scene: its picture, who made it, what it was reported for and
 * how often, and the answers. Taking down asks first, in the row itself —
 * it reaches every member who kept the scene. Dismissing and restoring do
 * not: both are undone by the other answer.
 */
export default function ReportedSceneRow({
  entry,
  working,
  confirming,
  onConfirm,
  onAct,
  onOpen,
}: IReportedSceneRowProps) {
  const { t, locale } = useTranslation();
  const { scene } = entry;
  const name = resolveSceneName(scene, locale);
  const numbers = new Intl.NumberFormat(locale);
  const dates = new Intl.DateTimeFormat(locale, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
  const takenDown = entry.takenDownAt !== undefined;
  const busy = working !== undefined;
  const maker =
    scene.authorName ?? scene.authorHandle ?? t('plus.card.anonymous');
  const reasons = reportedReasons(entry);

  return (
    <li
      className={`gallery-row gallery-report${takenDown ? ' is-blocked' : ''}${confirming ? ' is-confirming' : ''}`}
    >
      <ScenePicture className="gallery-row__picture" scene={scene} />
      <span className="gallery-row__text">
        <span className="gallery-row__name">{name}</span>
        <span className="gallery-row__meta">
          {t('plus.card.by', { name: maker })} ·{' '}
          {t(categoryKey(scene.category))} ·{' '}
          {t('plus.mine.version', { version: String(scene.version) })}
        </span>
        {reasons.length > 0 && (
          <span className="gallery-report__reasons">
            {reasons.map((reason) => (
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
        )}
        <span className="gallery-report__when">
          {takenDown && entry.takenDownAt && (
            <span className="gallery-row__blocked">
              {t('plus.moderation.takenDownOn', {
                date: dates.format(new Date(entry.takenDownAt)),
              })}
            </span>
          )}
          {entry.authorBanned && (
            <span className="gallery-row__blocked">
              {t('plus.moderation.makerBanned')}
            </span>
          )}
          {!takenDown && entry.lastReportedAt && (
            <span>
              {t('plus.moderation.lastReport', {
                date: dates.format(new Date(entry.lastReportedAt)),
              })}
            </span>
          )}
        </span>
      </span>
      <dl className="gallery-row__numbers">
        <div className="gallery-report__count">
          <dt>{t('plus.moderation.reports')}</dt>
          <dd>{numbers.format(entry.reports)}</dd>
        </div>
        <div>
          <dt>{t('plus.scene.adds')}</dt>
          <dd>{numbers.format(scene.adds)}</dd>
        </div>
      </dl>
      <span className="gallery-row__actions">
        {confirming && (
          <>
            <span className="gallery-row__confirm">
              {t('plus.moderation.confirm')}
            </span>
            <button
              type="button"
              className="button small subtle"
              disabled={busy}
              onClick={() => onConfirm(false)}
            >
              {t('plus.moderation.confirmNo')}
            </button>
            <button
              type="button"
              className={`button small gallery-danger${working === 'take-down' ? ' is-running' : ''}`}
              aria-busy={working === 'take-down'}
              onClick={() => {
                if (!busy) {
                  onAct('take-down');
                }
              }}
            >
              {t('plus.moderation.takeDown')}
            </button>
          </>
        )}
        {!confirming && takenDown && (
          <button
            type="button"
            className={`button small subtle${working === 'restore' ? ' is-running' : ''}`}
            aria-busy={working === 'restore'}
            disabled={busy}
            onClick={() => onAct('restore')}
          >
            <Glyph name="refresh" />
            {t('plus.moderation.restore')}
          </button>
        )}
        {!confirming && !takenDown && (
          <>
            <button
              type="button"
              className="button small subtle"
              disabled={busy}
              onClick={onOpen}
            >
              {t('plus.moderation.view')}
            </button>
            <button
              type="button"
              className={`button small subtle${working === 'dismiss' ? ' is-running' : ''}`}
              aria-busy={working === 'dismiss'}
              disabled={busy}
              onClick={() => onAct('dismiss')}
            >
              {t('plus.moderation.dismiss')}
            </button>
            <button
              type="button"
              className="button small subtle gallery-report__take-down"
              disabled={busy}
              onClick={() => onConfirm(true)}
            >
              {t('plus.moderation.takeDown')}
            </button>
          </>
        )}
      </span>
    </li>
  );
}
