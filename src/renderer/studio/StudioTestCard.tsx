import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import type { TStudioSize } from './StudioStage';
import { STUDIO_SIGNALS, type TStudioSignal } from './studioSignals';

const SIZES: readonly TStudioSize[] = ['graph', 'narrow', 'wide', 'full'];

interface IStudioTestCardProps {
  signal: TStudioSignal;
  onSignal: (signal: TStudioSignal) => void;
  size: TStudioSize;
  onSize: (size: TStudioSize) => void;
  /** Nothing is on the stage: the controls stay where they will be, unlit. */
  idle: boolean;
  /** How the scene is running, when it is. */
  cost?: TranslationKey;
  percent: number;
}

/**
 * What to play the scene with and at which size, and how well it keeps up —
 * everything that judges the scene rather than changes it.
 */
export default function StudioTestCard({
  signal,
  onSignal,
  size,
  onSize,
  idle,
  cost,
  percent,
}: IStudioTestCardProps) {
  const { t } = useTranslation();
  return (
    <div className="studio-card studio-test">
      <span className="studio-card__eyebrow">{t('studio.signals.title')}</span>
      <div
        className="studio-segments"
        role="group"
        aria-label={t('studio.signals.title')}
      >
        {STUDIO_SIGNALS.map((entry) => (
          <button
            key={entry}
            type="button"
            className="studio-segment"
            aria-pressed={signal === entry}
            disabled={idle}
            onClick={() => onSignal(entry)}
          >
            {t(`studio.signal.${entry}` as TranslationKey)}
          </button>
        ))}
      </div>
      <span className="studio-test__hint">{t('studio.signals.hint')}</span>
      <span className="studio-card__eyebrow">{t('studio.size.title')}</span>
      <div
        className="studio-segments"
        role="group"
        aria-label={t('studio.size.title')}
      >
        {SIZES.map((entry) => (
          <button
            key={entry}
            type="button"
            className="studio-segment"
            aria-pressed={size === entry}
            disabled={idle}
            onClick={() => onSize(entry)}
          >
            {t(`studio.size.${entry}` as TranslationKey)}
          </button>
        ))}
      </div>
      {cost && (
        <span className={`studio-cost studio-cost--${cost.split('.').pop()}`}>
          <span className="studio-cost__dot" aria-hidden="true" />
          {t(cost, { percent })}
        </span>
      )}
    </div>
  );
}
