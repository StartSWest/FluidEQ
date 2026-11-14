import { useTranslation } from '../utils/I18nContext';
import {
  READING_SIZE_STEPS,
  largerReadingText,
  resetReadingText,
  smallerReadingText,
  useReadingSize,
} from './readingSize';
import '../styles/ReadingSize.scss';

/**
 * The reading text's size, in the Forum's and Help's headings: smaller, the
 * size now (pressed, back to 100%) and larger. A small A and a large A, the
 * marks every reader knows from a browser or an e-reader, with their names
 * spoken and the new size said aloud after each press. The same size on both
 * pages (`readingSize.ts`).
 */
export default function ReadingSizeControl() {
  const { t, locale } = useTranslation();
  const size = useReadingSize();
  const percent = new Intl.NumberFormat(locale, { style: 'percent' }).format(
    size,
  );
  const smallest = size === READING_SIZE_STEPS[0];
  const largest = size === READING_SIZE_STEPS[READING_SIZE_STEPS.length - 1];

  return (
    <div
      className="reading-size"
      role="group"
      aria-label={t('reading.textSize.label')}
    >
      <span className="reading-size__label" aria-hidden="true">
        {t('reading.textSize.label')}
      </span>
      <span className="reading-size__steps">
        <button
          type="button"
          className="reading-size__step"
          aria-label={t('reading.textSize.smaller')}
          title={t('reading.textSize.smallerKeys')}
          disabled={smallest}
          onClick={smallerReadingText}
        >
          <span className="reading-size__a is-small" aria-hidden="true">
            A
          </span>
        </button>
        <button
          type="button"
          className="reading-size__value"
          aria-label={t('reading.textSize.reset', { percent })}
          title={t('reading.textSize.resetKeys')}
          disabled={smallest}
          onClick={resetReadingText}
        >
          {percent}
        </button>
        <button
          type="button"
          className="reading-size__step"
          aria-label={t('reading.textSize.larger')}
          title={t('reading.textSize.largerKeys')}
          disabled={largest}
          onClick={largerReadingText}
        >
          <span className="reading-size__a is-large" aria-hidden="true">
            A
          </span>
        </button>
      </span>
      <span className="reading-size__said" role="status">
        {t('reading.textSize.now', { percent })}
      </span>
    </div>
  );
}
