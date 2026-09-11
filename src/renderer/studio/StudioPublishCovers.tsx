import { useId } from 'react';
import Glyph from '../community/Glyph';
import { useTranslation } from '../utils/I18nContext';
import { MAX_SHOTS, type IPublishShot } from './useStudioPublish';

interface IStudioPublishCoversProps {
  shots: readonly IPublishShot[];
  chosen: number;
  /** The last capture could not be drawn. */
  missed: boolean;
  /** Publishing: the cover is settled while it runs. */
  locked: boolean;
  onChoose: (id: number) => void;
}

/**
 * The covers to choose between: the one the dialog opened with, then every
 * capture as it is drawn, the ticked one being what the gallery gets. The
 * places still free are drawn too, so the row says how many it keeps.
 */
export default function StudioPublishCovers({
  shots,
  chosen,
  missed,
  locked,
  onChoose,
}: IStudioPublishCoversProps) {
  const { t } = useTranslation();
  const labelId = useId();
  const room = Math.max(0, MAX_SHOTS - shots.length);

  return (
    <div className="studio-publish__covers">
      <span className="gallery-dialog__label" id={labelId}>
        {t('studio.publish.cover')}
      </span>
      <div
        className="studio-publish__shots"
        role="radiogroup"
        aria-labelledby={labelId}
      >
        {shots.map((shot, index) =>
          shot.picture ? (
            <button
              key={shot.id}
              type="button"
              role="radio"
              aria-checked={shot.id === chosen}
              className="studio-publish__shot"
              disabled={locked}
              onClick={() => onChoose(shot.id)}
            >
              <img
                src={shot.picture.url}
                alt={t('studio.publish.shot', { number: index + 1 })}
              />
              {shot.kind === 'auto' && (
                <span className="studio-publish__shot-tag">
                  {t('studio.publish.auto')}
                </span>
              )}
              {shot.id === chosen && (
                <span className="studio-publish__shot-check">
                  <Glyph name="check" />
                </span>
              )}
            </button>
          ) : (
            <span
              key={shot.id}
              className="studio-publish__shot is-drawing"
              role="status"
              aria-label={t('studio.publish.capturing')}
            >
              <span className="gallery-preview__spinner" aria-hidden="true" />
            </span>
          ),
        )}
        {Array.from({ length: room }, (_, index) => (
          <span
            // Free places: identical, and never reordered among themselves.
            // eslint-disable-next-line react/no-array-index-key
            key={`room-${index}`}
            className="studio-publish__shot is-empty"
            aria-hidden="true"
          />
        ))}
      </div>
      <span
        className={`studio-publish__covers-hint${missed ? ' is-missed' : ''}`}
        role={missed ? 'alert' : undefined}
      >
        {missed ? t('studio.publish.missed') : t('studio.publish.coverHint')}
      </span>
    </div>
  );
}
