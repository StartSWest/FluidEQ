import type { TranslationKey } from 'common/i18n';
import { useTranslation } from '../utils/I18nContext';
import type { TStudioSize } from './StudioStage';
import { STUDIO_SIGNALS, type TStudioSignal } from './studioSignals';
import { SIGNAL_ICONS, SIZE_ICONS } from './studioTestIcons';
import StudioGridSwitch from './StudioGridSwitch';
import StudioTintSwitch from './StudioTintSwitch';
import StudioWaveControls from './StudioWaveControls';
import type { IStudioWave } from './studioWave';

const SIZES: readonly TStudioSize[] = ['graph', 'narrow', 'wide', 'full'];

interface IStudioTestCardProps {
  signal: TStudioSignal;
  onSignal: (signal: TStudioSignal) => void;
  size: TStudioSize;
  onSize: (size: TStudioSize) => void;
  wave: IStudioWave;
  onWave: (wave: IStudioWave) => void;
  /** The scene reserves its own band for the spectrum. */
  isWaveFixed: boolean;
  /** Nothing is on the stage: the controls stay where they will be, unlit. */
  idle: boolean;
  /** How the scene is running, when it is. */
  cost?: TranslationKey;
  percent: number;
}

/**
 * What to play the scene with, at which size and under which wave, and how
 * well it keeps up — everything that judges the scene rather than changes it.
 *
 * The choices are tiles in a fixed grid of four, each drawing what it is over
 * its name. They were pills that wrapped: eight of different widths broke
 * into three ragged rows in the Studio's side column, and where each row
 * broke moved with the language. Four equal columns hold the same shape in
 * every language, and a long name takes a second line inside its own tile
 * instead of pushing its neighbours down. In the narrowest column the names
 * give way to the drawings alone, and the readout under the signals names
 * the one that is playing.
 */
export default function StudioTestCard({
  signal,
  onSignal,
  size,
  onSize,
  wave,
  onWave,
  isWaveFixed,
  idle,
  cost,
  percent,
}: IStudioTestCardProps) {
  const { t } = useTranslation();
  const signalName = (entry: TStudioSignal) =>
    t(`studio.signal.${entry}` as TranslationKey);
  const sizeName = (entry: TStudioSize) =>
    t(`studio.size.${entry}` as TranslationKey);
  return (
    <div className="studio-card studio-test">
      <span className="studio-card__eyebrow">{t('studio.signals.title')}</span>
      <div
        className="studio-tiles"
        role="group"
        aria-label={t('studio.signals.title')}
      >
        {STUDIO_SIGNALS.map((entry) => (
          <button
            key={entry}
            type="button"
            className="studio-tile"
            aria-pressed={signal === entry}
            aria-label={signalName(entry)}
            title={`${signalName(entry)}: ${t(
              `studio.signalHint.${entry}` as TranslationKey,
            )}`}
            disabled={idle}
            onClick={() => onSignal(entry)}
          >
            {SIGNAL_ICONS[entry]}
            <span className="studio-tile__name">{signalName(entry)}</span>
          </button>
        ))}
      </div>
      <span className="studio-test__now" role="status">
        <span className="studio-test__now-name">{signalName(signal)}</span>
        {t(`studio.signalHint.${signal}` as TranslationKey)}
      </span>
      <span className="studio-test__hint">{t('studio.signals.hint')}</span>
      <span className="studio-card__eyebrow">{t('studio.size.title')}</span>
      <div
        className="studio-tiles studio-tiles--sizes"
        role="group"
        aria-label={t('studio.size.title')}
      >
        {SIZES.map((entry) => (
          <button
            key={entry}
            type="button"
            className="studio-tile"
            aria-pressed={size === entry}
            aria-label={sizeName(entry)}
            title={sizeName(entry)}
            disabled={idle}
            onClick={() => onSize(entry)}
          >
            {SIZE_ICONS[entry]}
            <span className="studio-tile__name">{sizeName(entry)}</span>
          </button>
        ))}
      </div>
      <StudioWaveControls
        wave={wave}
        onWave={onWave}
        isFixedByScene={isWaveFixed}
        idle={idle}
      />
      <StudioGridSwitch />
      <StudioTintSwitch />
      {cost && (
        <span className={`studio-cost studio-cost--${cost.split('.').pop()}`}>
          <span className="studio-cost__dot" aria-hidden="true" />
          {t(cost, { percent })}
        </span>
      )}
    </div>
  );
}
