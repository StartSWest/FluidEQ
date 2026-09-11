import { useEffect, useRef, type MutableRefObject } from 'react';
import type { TranslationKey } from 'common/i18n';
import { SPECTRUM_TEXELS } from 'common/sceneUniformContract';
import { useTranslation } from '../utils/I18nContext';
import type { TStageDrawn } from './StudioStage';

/** Each meter, and the line saying what that part of the music is. */
const METERS: ReadonlyArray<{
  key: string;
  label: TranslationKey;
  hint: TranslationKey;
}> = [
  { key: 'level', label: 'studio.meter.level', hint: 'studio.hears.level' },
  { key: 'beat', label: 'studio.meter.beat', hint: 'studio.hears.beat' },
  { key: 'bass', label: 'studio.meter.bass', hint: 'studio.hears.bass' },
  { key: 'mid', label: 'studio.meter.mid', hint: 'studio.hears.mid' },
  { key: 'treble', label: 'studio.meter.treble', hint: 'studio.hears.treble' },
  { key: 'accent', label: 'studio.meter.accent', hint: 'studio.hears.accent' },
];

/** Bars in the spectrum strip: enough to read its shape, few enough to draw. */
const SPECTRUM_BARS = 32;

interface IStudioMetersProps {
  /** The stage calls this after every frame it draws. */
  feed: MutableRefObject<TStageDrawn | undefined>;
  /** The ladder's scale changes rarely; the cost line follows it. */
  onScale: (scale: number) => void;
}

/**
 * What the scene heard on the frame just drawn — so a creator can see WHY
 * something moved, or why it did not.
 *
 * Written straight to the elements, not through React state: a meter that
 * re-rendered its component sixty times a second would cost more than the
 * scene it describes. React draws the rows once; the stage's frame callback
 * moves the bars.
 */
export default function StudioMeters({ feed, onScale }: IStudioMetersProps) {
  const { t } = useTranslation();
  const fills = useRef<Record<string, HTMLSpanElement | null>>({});
  const values = useRef<Record<string, HTMLSpanElement | null>>({});
  const bars = useRef<Array<HTMLElement | null>>([]);
  const lastScale = useRef(-1);
  const scaleRef = useRef(onScale);
  scaleRef.current = onScale;

  useEffect(() => {
    const write = (key: string, value: number) => {
      const fill = fills.current[key];
      const text = values.current[key];
      const clamped = Math.max(0, Math.min(1, value));
      if (fill) {
        fill.style.transform = `scaleX(${clamped})`;
      }
      if (text) {
        text.textContent = clamped.toFixed(2);
      }
    };
    feed.current = (frame, scale, musicAccent) => {
      write('level', frame.level);
      write('beat', frame.beat);
      write('bass', frame.bands[0]);
      write('mid', frame.bands[1]);
      write('treble', frame.bands[2]);
      write('accent', musicAccent);
      const step = SPECTRUM_TEXELS / SPECTRUM_BARS;
      bars.current.forEach((bar, index) => {
        if (bar) {
          const texel = frame.spectrum[Math.floor(index * step + step / 2)];
          bar.style.transform = `scaleY(${Math.max(0.03, texel / 255)})`;
        }
      });
      if (scale !== lastScale.current) {
        lastScale.current = scale;
        scaleRef.current(scale);
      }
    };
    return () => {
      feed.current = undefined;
    };
  }, [feed]);

  return (
    <div className="studio-card studio-meters" aria-live="off">
      <span className="studio-card__eyebrow">{t('studio.meters.title')}</span>
      {METERS.map(({ key, label, hint }) => (
        <div
          key={key}
          className={`studio-meter studio-meter--${key}`}
          role="presentation"
          title={t(hint)}
        >
          <span className="studio-meter__label">{t(label)}</span>
          <span className="studio-meter__track">
            <span
              className="studio-meter__fill"
              ref={(element) => {
                fills.current[key] = element;
              }}
            />
          </span>
          <span
            className="studio-meter__value"
            ref={(element) => {
              values.current[key] = element;
            }}
          >
            0.00
          </span>
        </div>
      ))}
      <div
        className="studio-meters__spectrum"
        aria-hidden="true"
        title={t('studio.hears.spectrum')}
      >
        {Array.from({ length: SPECTRUM_BARS }, (_, index) => (
          <i
            // The bars are positions on a fixed axis, never reordered.
            // eslint-disable-next-line react/no-array-index-key
            key={index}
            ref={(element) => {
              bars.current[index] = element;
            }}
          />
        ))}
      </div>
    </div>
  );
}
