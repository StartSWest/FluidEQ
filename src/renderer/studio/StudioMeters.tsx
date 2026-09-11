import { useEffect, useRef, type MutableRefObject } from 'react';
import type { TranslationKey } from 'common/i18n';
import { isNeutralResponse, type ISceneResponse } from 'common/sceneResponse';
import { SPECTRUM_TEXELS } from 'common/sceneUniformContract';
import type { ISceneFrame } from '../graph/sceneGl';
import { useTranslation } from '../utils/I18nContext';
import type { TStageDrawn } from './StudioStage';

type TMeterKey = 'level' | 'beat' | 'bass' | 'mid' | 'treble' | 'accent';

/**
 * Each meter, the line saying what that part of the music is, and — for the
 * ones the response bends — where to read it in a frame. The accent is the
 * scene's own envelope, made after the response, so it has nothing heard to
 * compare with.
 */
const METERS: ReadonlyArray<{
  key: TMeterKey;
  label: TranslationKey;
  hint: TranslationKey;
  read?: (frame: ISceneFrame) => number;
  /** Where the response's gate sits on this meter's scale. */
  gated?: boolean;
}> = [
  {
    key: 'level',
    label: 'studio.meter.level',
    hint: 'studio.hears.level',
    read: (frame) => frame.level,
    gated: true,
  },
  {
    key: 'beat',
    label: 'studio.meter.beat',
    hint: 'studio.hears.beat',
    read: (frame) => frame.beat,
  },
  {
    key: 'bass',
    label: 'studio.meter.bass',
    hint: 'studio.hears.bass',
    read: (frame) => frame.bands[0],
    gated: true,
  },
  {
    key: 'mid',
    label: 'studio.meter.mid',
    hint: 'studio.hears.mid',
    read: (frame) => frame.bands[1],
    gated: true,
  },
  {
    key: 'treble',
    label: 'studio.meter.treble',
    hint: 'studio.hears.treble',
    read: (frame) => frame.bands[2],
    gated: true,
  },
  { key: 'accent', label: 'studio.meter.accent', hint: 'studio.hears.accent' },
];

/** Bars in the spectrum strip: enough to read its shape, few enough to draw. */
const SPECTRUM_BARS = 32;

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

interface IStudioMetersProps {
  /** The stage calls this after every frame it draws. */
  feed: MutableRefObject<TStageDrawn | undefined>;
  /** The ladder's scale changes rarely; the cost line follows it. */
  onScale: (scale: number) => void;
  /** How the scene answers the music now, to show what it does. */
  response: ISceneResponse;
}

/**
 * What the scene heard on the frame just drawn — so a creator can see WHY
 * something moved, or why it did not.
 *
 * With a response set, each bent meter shows both: faint, the music as it
 * is played; bright, what the scene got from it; and a mark where the
 * threshold cuts in, on the music's own scale. A slider moved beside it
 * shows its effect here in the same second.
 *
 * Written straight to the elements, not through React state: a meter that
 * re-rendered its component sixty times a second would cost more than the
 * scene it describes. React draws the rows once; the stage's frame callback
 * moves the bars.
 */
export default function StudioMeters({
  feed,
  onScale,
  response,
}: IStudioMetersProps) {
  const { t } = useTranslation();
  const fills = useRef<Partial<Record<TMeterKey, HTMLSpanElement | null>>>({});
  const ghosts = useRef<Partial<Record<TMeterKey, HTMLSpanElement | null>>>({});
  const values = useRef<Partial<Record<TMeterKey, HTMLSpanElement | null>>>({});
  const bars = useRef<Array<HTMLElement | null>>([]);
  const lastScale = useRef(-1);
  const scaleRef = useRef(onScale);
  scaleRef.current = onScale;
  const bent = !isNeutralResponse(response);
  // Where the gate shuts, in what is heard: below this, the scene gets
  // nothing. Past the end of the scale when the sensitivity makes it so.
  const gateAt = Math.min(1, response.threshold / response.sensitivity);

  useEffect(() => {
    const write = (key: TMeterKey, value: number, heard: number) => {
      const fill = fills.current[key];
      const ghost = ghosts.current[key];
      const text = values.current[key];
      if (fill) {
        fill.style.transform = `scaleX(${clamp01(value)})`;
      }
      if (ghost) {
        ghost.style.transform = `scaleX(${clamp01(heard)})`;
      }
      if (text) {
        text.textContent = clamp01(value).toFixed(2);
      }
    };
    feed.current = (frame, scale, musicAccent, heard) => {
      METERS.forEach(({ key, read }) => {
        if (read) {
          write(key, read(frame), read(heard));
        }
      });
      write('accent', musicAccent, 0);
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
    <div
      className={`studio-card studio-meters${bent ? ' is-bent' : ''}`}
      aria-live="off"
    >
      <span className="studio-card__eyebrow">{t('studio.meters.title')}</span>
      {METERS.map(({ key, label, hint, read, gated }) => (
        <div
          key={key}
          className={`studio-meter studio-meter--${key}`}
          role="presentation"
          title={t(hint)}
        >
          <span className="studio-meter__label">{t(label)}</span>
          <span className="studio-meter__track">
            {read && (
              <span
                className="studio-meter__heard"
                ref={(element) => {
                  ghosts.current[key] = element;
                }}
              />
            )}
            <span
              className="studio-meter__fill"
              ref={(element) => {
                fills.current[key] = element;
              }}
            />
            {gated && response.threshold > 0 && (
              <span
                className="studio-meter__gate"
                style={{ left: `${gateAt * 100}%` }}
              />
            )}
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
      {bent && (
        <span className="studio-meters__legend">
          <span className="studio-meters__swatch is-heard" aria-hidden="true" />
          {t('studio.meters.heard')}
          <span className="studio-meters__swatch" aria-hidden="true" />
          {t('studio.meters.got')}
        </span>
      )}
    </div>
  );
}
